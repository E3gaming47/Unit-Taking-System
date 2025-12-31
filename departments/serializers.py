from rest_framework import serializers
from .models import Classroom, Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]

    def validate_name(self, value):
        queryset = Department.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return value

    def validate_code(self, value):
        queryset = Department.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A department with this code already exists.")
        return value


class ClassroomSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Classroom
        fields = ["id", "department", "number", "capacity"]
        read_only_fields = ["id"]

    def validate_capacity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Capacity must be a positive integer.")
        return value
