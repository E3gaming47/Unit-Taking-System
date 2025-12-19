from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from api.pagination import StandardResultsSetPagination
from terms.models import Term
from .models import Prerequisite, Section
from .serializers import (
    PrerequisiteSerializer,
    SectionCreateSerializer,
    SectionDetailSerializer,
)
from .services import prerequisites_valid


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

    def get_queryset(self):

        qs = super().get_queryset()
        request = self.request
        user = request.user

        term_id = request.query_params.get("term")
        department_id = request.query_params.get("department")
        professor_id = request.query_params.get("professor")

        # For non-admin users (students and professors), only show sections from active terms
        if user.is_authenticated and user.role != "admin":
            active_terms = Term.objects.filter(is_active=True)
            if not active_terms.exists():
                # No active term, return empty queryset for students/professors
                return qs.none()
            
            # If term_id is provided, verify it's an active term
            if term_id:
                try:
                    term = Term.objects.get(id=term_id, is_active=True)
                    qs = qs.filter(term=term)
                except Term.DoesNotExist:
                    # Requested term is not active, return empty queryset
                    return qs.none()
            else:
                # No term_id specified, filter by all active terms
                qs = qs.filter(term__in=active_terms)
        else:
            # Admin users can see all sections
            if term_id:
                qs = qs.filter(term_id=term_id)
            else:
                # For admin, if no term specified, default to active term
                active_term = Term.objects.filter(is_active=True).first()
                if active_term:
                    qs = qs.filter(term=active_term)

        if department_id:
            qs = qs.filter(course__departments__id=department_id)

        if professor_id:
            qs = qs.filter(professor_id=professor_id)

        return qs.distinct()


class PrerequisiteViewSet(viewsets.ModelViewSet):

    queryset = Prerequisite.objects.all().select_related("section", "section__course", "prerequisite_course")
    serializer_class = PrerequisiteSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        section_id = self.request.query_params.get("section")
        course_id = self.request.query_params.get("course")  # For backward compatibility, filter by section's course
        
        if section_id:
            qs = qs.filter(section_id=section_id)
        elif course_id:
            # Filter by section's course (for backward compatibility)
            qs = qs.filter(section__course_id=course_id)
        
        return qs

    @action(detail=False, methods=["post"], url_path="add_prerequisite")
    def add_prerequisite(self, request):

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    @action(detail=False, methods=["post"], url_path="remove_prerequisite")
    def remove_prerequisite(self, request):

        section_id = request.data.get("section")
        prereq_id = request.data.get("prerequisite_course")

        if not section_id or not prereq_id:
            return Response(
                {"detail": "section and prerequisite_course are required."},
                status=400,
            )

        Prerequisite.objects.filter(
            section_id=section_id,
            prerequisite_course_id=prereq_id,
        ).delete()

        return Response(status=204)

