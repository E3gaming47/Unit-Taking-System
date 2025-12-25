from rest_framework import filters, viewsets
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from api.pagination import StandardResultsSetPagination
from .models import Course, Prerequisite
from .serializers import CourseSerializer, PrerequisiteSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().prefetch_related("departments")
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "title", "departments__name", "departments__code"]
    ordering_fields = ["code", "title", "units", "created_at"]
    ordering = ["code"]

    def get_queryset(self):
        queryset = super().get_queryset()
        department_id = self.request.query_params.get("department")
        units = self.request.query_params.get("units")

        if department_id:
            queryset = queryset.filter(departments__id=department_id)
        if units:
            queryset = queryset.filter(units=units)

        return queryset.distinct()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsAdmin])
    def units_choices(self, request):

        units_field = Course._meta.get_field("units")
        choices = [{"value": value, "label": str(label)} for value, label in units_field.choices]
        return Response({"units": choices})

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == "admin"


class PrerequisiteViewSet(viewsets.ModelViewSet):
    queryset = Prerequisite.objects.all().select_related("course", "prerequisite_course")
    serializer_class = PrerequisiteSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=["post"], url_path="add_prerequisite")
    def add_prerequisite(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    @action(detail=False, methods=["post"], url_path="remove_prerequisite")
    def remove_prerequisite(self, request):
        course_id = request.data.get("course")
        prereq_id = request.data.get("prerequisite_course")

        if not course_id or not prereq_id:
            return Response(
                {"detail": "course and prerequisite_course are required."},
                status=400,
            )

        Prerequisite.objects.filter(
            course_id=course_id,
            prerequisite_course_id=prereq_id,
        ).delete()

        return Response(status=204)

        