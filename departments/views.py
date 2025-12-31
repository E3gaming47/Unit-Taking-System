from rest_framework import filters
from rest_framework.viewsets import ModelViewSet

from api.pagination import StandardResultsSetPagination

from .models import Classroom, Department
from .permissions import IsAdminOrReadOnly
from .serializers import ClassroomSerializer, DepartmentSerializer


class DepartmentViewSet(ModelViewSet):
    queryset = Department.objects.all().order_by("code")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "id"]
    ordering = ["code"]

    lookup_field = "id"


class ClassroomViewSet(ModelViewSet):
    queryset = Classroom.objects.all().select_related("department").order_by("number")
    serializer_class = ClassroomSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["number", "department__name", "department__code"]
    ordering_fields = ["number", "capacity", "id"]
    ordering = ["number"]

    lookup_field = "id"
