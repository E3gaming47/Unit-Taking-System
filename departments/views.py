from rest_framework.viewsets import ModelViewSet
from .models import Department
from .serializers import DepartmentSerializer
from .permissions import IsAdminOrReadOnly


class DepartmentViewSet(ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]

    lookup_field = "id"
