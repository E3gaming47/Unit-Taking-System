# courses/serializers.py
from rest_framework import serializers
from .models import Course
from departments.models import Department

class CourseSerializer(serializers.ModelSerializer):
    departments = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = Course
        fields = ["id", "code", "title", "units", "departments", "created_at", "updated_at"]
