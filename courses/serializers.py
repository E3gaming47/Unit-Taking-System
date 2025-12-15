# courses/serializers.py
from rest_framework import serializers

from departments.models import Department
from departments.serializers import DepartmentSerializer

from .models import Course

class CourseSerializer(serializers.ModelSerializer):
    departments = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        many=True,
        required=False
    )
    department_details = DepartmentSerializer(
        source="departments", many=True, read_only=True
    )

    class Meta:
        model = Course
        fields = [
            "id",
            "code",
            "title",
            "units",
            "departments",
            "department_details",
            "created_at",
            "updated_at",
        ]

    def validate_code(self, value):
        queryset = Course.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A course with this code already exists.")
        return value

    def validate_title(self, value):
        queryset = Course.objects.filter(title__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A course with this title already exists."
            )
        return value

    def validate_units(self, value):
        if value not in range(1, 5):
            raise serializers.ValidationError("Units must be between 1 and 4.")
        return value

    def validate_departments(self, value):

        if not value:
            return value

        unique_ids = set()
        for dept in value:
            if dept.id in unique_ids:
                raise serializers.ValidationError(
                    "Duplicate departments selected for this course."
                )
            unique_ids.add(dept.id)
        return value
