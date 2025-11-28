from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]

    def validate_name(self, value):
        if Department.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return value

    def validate_code(self, value):
        if Department.objects.filter(code__iexact=value).exists():
            raise serializers.ValidationError("A department with this code already exists.")
        return value
