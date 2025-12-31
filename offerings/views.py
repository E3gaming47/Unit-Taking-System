from rest_framework import filters, permissions, viewsets
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.decorators import action

from api.pagination import StandardResultsSetPagination
from terms.models import Term
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

        return qs.distinct()
