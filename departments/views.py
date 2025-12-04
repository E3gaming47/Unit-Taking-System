from rest_framework import filters
from rest_framework.viewsets import ModelViewSet

from api.pagination import StandardResultsSetPagination

from .models import Department
from .permissions import IsAdminOrReadOnly
from .serializers import DepartmentSerializer


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
