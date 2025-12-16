from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from api.pagination import StandardResultsSetPagination
from .models import Course
from .serializers import CourseSerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read access to all authenticated users,
    but write access only to admins.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == "admin"


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().prefetch_related("departments")
    serializer_class = CourseSerializer
    permission_classes = [IsAdminOrReadOnly]
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
