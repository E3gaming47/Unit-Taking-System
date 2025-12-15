from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from api.pagination import StandardResultsSetPagination
from courses.models import Course
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

    queryset = (
        Section.objects.all()
        .select_related("term", "course", "professor")
        .prefetch_related("schedules")
    )
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return SectionDetailSerializer
        return SectionCreateSerializer


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

