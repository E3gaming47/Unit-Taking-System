# courses/serializers.py
from rest_framework import serializers
from django.db import transaction
from departments.models import Department
from departments.serializers import DepartmentSerializer

from .models import Course, Prerequisite
from .services import prerequisites_valid



class CourseSerializer(serializers.ModelSerializer):
    departments = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        many=True,
        required=False
    )
    department_details = DepartmentSerializer(
        source="departments", many=True, read_only=True
    )
    prerequisites = serializers.PrimaryKeyRelatedField(
    queryset=Course.objects.all(),
    many=True,
    required=False,
    write_only=True,
)

    prerequisite_ids = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "code",
            "title",
            "units",
            "departments",
            "department_details",
            "prerequisites",
            "prerequisite_ids",
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
    def get_prerequisite_ids(self, obj: Course):
        return list(
            Prerequisite.objects.filter(course=obj)
            .order_by("prerequisite_course_id")
            .values_list("prerequisite_course_id", flat=True)
    )

class PrerequisiteSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    prerequisite_course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())

    class Meta:
        model = Prerequisite
        fields = ["id", "course", "prerequisite_course"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        course = attrs.get("course")
        prereq = attrs.get("prerequisite_course")

        if course == prereq:
            raise serializers.ValidationError("A course cannot be a prerequisite of itself.")

        prerequisites_valid(course, [prereq])
        return attrs


@transaction.atomic
def create(self, validated_data):
    departments = validated_data.pop("departments", [])
    prerequisite_courses = validated_data.pop("prerequisites", [])

    course = Course.objects.create(**validated_data)

    if departments:
        course.departments.set(departments)

    if prerequisite_courses:
        prerequisites_valid(course, prerequisite_courses)
        Prerequisite.objects.bulk_create(
            [Prerequisite(course=course, prerequisite_course=pr) for pr in prerequisite_courses]
        )

    return course


@transaction.atomic
def update(self, instance, validated_data):
    departments = validated_data.pop("departments", None)
    prerequisite_courses = validated_data.pop("prerequisites", None)

    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    instance.save()

    if departments is not None:
        instance.departments.set(departments)

    if prerequisite_courses is not None:
        prerequisites_valid(instance, prerequisite_courses)
        Prerequisite.objects.filter(course=instance).delete()
        if prerequisite_courses:
            Prerequisite.objects.bulk_create(
                [Prerequisite(course=instance, prerequisite_course=pr) for pr in prerequisite_courses]
            )

    return instance        