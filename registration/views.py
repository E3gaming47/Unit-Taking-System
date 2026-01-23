from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Registration
from .serializers import RegistrationSerializer, RegistrationListSerializer
from api.pagination import StandardResultsSetPagination
from accounts.permissions import IsStudent
from terms.models import Term


class RegistrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing student course registrations
    """
    serializer_class = RegistrationSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return registrations for the current student"""
        if self.request.user.role != "student":
            return Registration.objects.none()
        return Registration.objects.filter(student=self.request.user).select_related(
            "section__term",
            "section__course",
            "section__professor"
        ).prefetch_related(
            "section__schedules",
            "section__exam"
        )
    
    def get_serializer_class(self):
        if self.action == "list":
            return RegistrationListSerializer
        return RegistrationSerializer
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Register student for a section"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can register for courses."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            registration = serializer.save()
            return Response(
                RegistrationSerializer(registration).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            error_messages = []
            if hasattr(e, "error_dict"):
                for field, errors in e.error_dict.items():
                    for error in errors:
                        error_messages.append(str(error))
            else:
                error_messages.append(str(e))
            
            return Response(
                {"error": " ".join(error_messages) if error_messages else "Validation error"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=["get"], url_path="my-registrations")
    def my_registrations(self, request):
        """Get current student's registrations"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can view registrations."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        registrations = self.get_queryset()
        page = self.paginate_queryset(registrations)
        if page is not None:
            serializer = RegistrationListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = RegistrationListSerializer(registrations, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], url_path="total-units")
    def total_units(self, request):
        """Get total units for current student in active term"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can view total units."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get active term
        active_term = Term.objects.filter(is_active=True).first()
        if not active_term:
            return Response({"total_units": 0, "term": None})
        
        total_units = sum(
            reg.section.course.units
            for reg in Registration.objects.filter(
                student=request.user,
                section__term=active_term
            ).select_related("section__course")
        )
        
        return Response({
            "total_units": total_units,
            "term": {
                "id": active_term.id,
                "name": active_term.name,
                "min_units": active_term.min_units,
                "max_units": active_term.max_units
            }
        })
    
    @action(detail=False, methods=["get"], permission_classes=[IsStudent], url_path="weekly-schedule")
    def weekly_schedule(self, request):
        """
        Get visual weekly schedule for current student.
        Returns schedule organized by day and time slot for easy visualization.
        """
        # Get active term
        active_term = Term.objects.filter(is_active=True).first()
        if not active_term:
            return Response({
                "term": None,
                "schedule": {},
                "message": "No active term found."
            })
        
        # Get all registrations for active term
        registrations = Registration.objects.filter(
            student=request.user,
            section__term=active_term
        ).select_related(
            "section__term",
            "section__course",
            "section__professor"
        ).prefetch_related(
            "section__schedules__classroom"
        )
        
        # Organize schedule by day and time slot
        from offerings.models import SectionSchedule
        
        schedule_data = {}
        days = {
            0: "Saturday",
            1: "Sunday", 
            2: "Monday",
            3: "Tuesday",
            4: "Wednesday",
            5: "Thursday",
            6: "Friday"
        }
        
        # Initialize schedule structure
        for day_num, day_name in days.items():
            schedule_data[day_name] = {
                "day_number": day_num,
                "classes": []
            }
        
        # Populate schedule
        for reg in registrations:
            section = reg.section
            for schedule in section.schedules.all():
                day_name = days[schedule.day_of_week]
                start_time, end_time = SectionSchedule.SLOT_TO_TIMES.get(
                    schedule.time_slot, 
                    (None, None)
                )
                
                class_info = {
                    "section_id": section.id,
                    "course_code": section.course.code,
                    "course_title": section.course.title,
                    "section_number": section.section_number,
                    "professor": f"{section.professor.first_name} {section.professor.last_name}".strip() or section.professor.username,
                    "time_slot": schedule.time_slot,
                    "start_time": start_time.isoformat() if start_time else None,
                    "end_time": end_time.isoformat() if end_time else None,
                    "classroom": str(schedule.classroom) if schedule.classroom else schedule.location or "TBA",
                    "units": section.course.units,
                }
                
                schedule_data[day_name]["classes"].append(class_info)
        
        # Sort classes by time within each day
        for day_name in schedule_data:
            schedule_data[day_name]["classes"].sort(
                key=lambda x: x["start_time"] if x["start_time"] else ""
            )
        
        return Response({
            "term": {
                "id": active_term.id,
                "name": active_term.name,
                "start_date": active_term.start_date.isoformat(),
                "end_date": active_term.end_date.isoformat(),
            },
            "schedule": schedule_data,
            "total_units": sum(
                reg.section.course.units for reg in registrations
            )
        })
    
    def destroy(self, request, *args, **kwargs):
        """
        Override destroy to ensure student can only drop courses from current term.
        """
        registration = self.get_object()
        
        if request.user.role != "student":
            return Response(
                {"error": "Only students can drop courses."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify student owns this registration
        if registration.student != request.user:
            return Response(
                {"error": "You can only drop your own courses."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if term is current/active
        term = registration.section.term
        today = timezone.now().date()
        
        if term.status not in [Term.TermStatus.READY, Term.TermStatus.ACTIVE]:
            return Response(
                {"error": "Can only drop courses from Ready or Active terms."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if registration period is still open
        if today < term.registration_start or today > term.registration_end:
            return Response(
                {
                    "error": f"Registration period has ended. Drop deadline was {term.registration_end}."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
