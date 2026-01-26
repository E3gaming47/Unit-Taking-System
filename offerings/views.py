from rest_framework import filters, permissions, viewsets, status
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.decorators import action

from api.pagination import StandardResultsSetPagination
from accounts.permissions import IsProfessor
from terms.models import Term
from registration.models import Registration
from .models import Section, SectionSchedule
from .serializers import (
    SectionCreateSerializer,
    SectionDetailSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == "admin"


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all().select_related("term", "course", "professor").prefetch_related(
        "schedules"
    )
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "course__code",
        "course__title",
        "professor__username",
        "professor__first_name",
        "professor__last_name",
        "term__name",
    ]
    ordering_fields = ["course__code", "course__title", "term__start_date", "section_number"]
    ordering = ["course__code"]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return SectionDetailSerializer
        return SectionCreateSerializer

    @action(detail=False, methods=["get"], url_path="time-slots")
    def time_slots(self, request):
        slots = []

        for code, start, end in SectionSchedule.TIME_SLOTS:
            slots.append({
                "code": code,
                "label": f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}",
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            })
        return Response({"time_slots": slots})

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request

        term_id = request.query_params.get("term")
        department_id = request.query_params.get("department")
        professor_id = request.query_params.get("professor")

        if request.user.role == "student":
            student_department_id = request.user.department_id
            if student_department_id:
                qs = qs.filter(
                    Q(course__departments__id=student_department_id)
                    | Q(course__departments__isnull=True)
                )
            else:
                qs = qs.filter(course__departments__isnull=True)

        if term_id:
            qs = qs.filter(term_id=term_id)
        else:
            active_term = Term.objects.filter(is_active=True).first()
            if active_term:
                qs = qs.filter(term=active_term)

        if department_id:
            if request.user.role == "student" and str(request.user.department_id) != str(department_id):
                return qs.none()
            qs = qs.filter(course__departments__id=department_id)

        if professor_id:
            qs = qs.filter(professor_id=professor_id)
        
        # Filter by current professor if they're viewing sections (admins can see all)
        if request.user.role == "professor":
            qs = qs.filter(professor=request.user)

        return qs.distinct()
    
    @action(detail=True, methods=["get"], permission_classes=[IsProfessor], url_path="enrolled-students")
    def enrolled_students(self, request, pk=None):
        """
        Get list of enrolled students for a section, sorted by last name.
        Only professors teaching this section can access.
        """
        section = self.get_object()
        
        # Verify professor owns this section
        if section.professor != request.user:
            return Response(
                {"error": "You can only view students for your own sections."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get registrations for this section, ordered by student last name
        registrations = Registration.objects.filter(
            section=section
        ).select_related("student").order_by("student__last_name", "student__first_name")
        
        # Serialize student data
        students_data = []
        for reg in registrations:
            students_data.append({
                "id": reg.student.id,
                "student_id": reg.student.student_id,
                "username": reg.student.username,
                "first_name": reg.student.first_name,
                "last_name": reg.student.last_name,
                "email": reg.student.email,
                "registered_at": reg.registered_at,
            })
        
        return Response({
            "section": {
                "id": section.id,
                "course": str(section.course),
                "section_number": section.section_number,
                "term": str(section.term),
            },
            "students": students_data,
            "total_count": len(students_data),
            "capacity": section.capacity,
            "available_spots": section.capacity - len(students_data)
        })
    
    @action(detail=True, methods=["post"], permission_classes=[IsProfessor], url_path="remove-student")
    def remove_student(self, request, pk=None):
        """
        Remove a student from a section.
        Only professors teaching this section can remove students.
        Only works if student is enrolled in current term.
        """
        section = self.get_object()
        
        # Verify professor owns this section
        if section.professor != request.user:
            return Response(
                {"error": "You can only remove students from your own sections."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        student_id = request.data.get("student_id")
        if not student_id:
            return Response(
                {"error": "student_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if term is current/active
        from django.utils import timezone
        today = timezone.now().date()
        
        if section.term.status not in [Term.TermStatus.READY, Term.TermStatus.ACTIVE]:
            return Response(
                {"error": "Can only remove students from sections in Ready or Active terms."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find and delete registration
        try:
            from accounts.models import User
            student = User.objects.get(id=student_id, role="student")
            registration = Registration.objects.get(
                student=student,
                section=section
            )
            registration.delete()
            
            return Response(
                {"message": f"Student {student.username} has been removed from {section.course.code}."},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Registration.DoesNotExist:
            return Response(
                {"error": "Student is not enrolled in this section."},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=["get"], permission_classes=[IsProfessor], url_path="my-sections")
    def my_sections(self, request):
        """
        Get all sections taught by the current professor.
        Returns sections for active term by default, or can filter by term_id.
        """
        term_id = request.query_params.get("term")
        
        queryset = Section.objects.filter(
            professor=request.user
        ).select_related("term", "course", "professor").prefetch_related(
            "schedules", "registrations"
        )
        
        if term_id:
            queryset = queryset.filter(term_id=term_id)
        else:
            # Default to active term
            active_term = Term.objects.filter(is_active=True).first()
            if active_term:
                queryset = queryset.filter(term=active_term)
        
        # Paginate
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SectionDetailSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = SectionDetailSerializer(queryset, many=True)
        return Response(serializer.data)
