from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]

    def validate_name(self, value):
        queryset = Department.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("دپارتمانی با این نام قبلاً ثبت شده است.")
        return value

    def validate_code(self, value):
        queryset = Department.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("دپارتمانی با این کد قبلاً ثبت شده است.")
        return value
