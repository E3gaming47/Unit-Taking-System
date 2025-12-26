from rest_framework import serializers

from accounts.models import User
from courses.models import Course
from departments.models import Classroom
from terms.models import Term
from .models import Section, SectionExam, SectionSchedule
from .services import (
    check_exam_conflict,
    check_time_conflict,
)


class SectionScheduleSerializer(serializers.ModelSerializer):
    classroom = serializers.PrimaryKeyRelatedField(
        queryset=Classroom.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = SectionSchedule
        fields = ["id", "day_of_week", "start_time", "end_time", "classroom", "location"]
        read_only_fields = ["id"]


class SectionExamSerializer(serializers.ModelSerializer):
    classroom = serializers.PrimaryKeyRelatedField(
        queryset=Classroom.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = SectionExam
        fields = ["exam_datetime", "classroom", "location"]


class SectionCreateSerializer(serializers.ModelSerializer):
    schedules = SectionScheduleSerializer(many=True, required=False)
    exam = SectionExamSerializer(required=False)

    term = serializers.PrimaryKeyRelatedField(queryset=Term.objects.all())
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    professor = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role="professor"))

    class Meta:
        model = Section
        fields = [
            "id",
            "term",
            "course",
            "professor",
            "section_number",
            "capacity",
            "schedules",
            "exam",
        ]
        read_only_fields = ["id"]

    def validate_capacity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Capacity must be a positive integer.")
        return value

    def create(self, validated_data):
        schedules_data = validated_data.pop("schedules", [])
        exam_data = validated_data.pop("exam", None)

        section = Section.objects.create(**validated_data)

        for sch_data in schedules_data:
            if sch_data.get("classroom") and not sch_data.get("location"):
                sch_data["location"] = str(sch_data["classroom"])

            schedule = SectionSchedule(section=section, **sch_data)
            schedule.full_clean()
            schedule.save()

        if exam_data:
            if exam_data.get("classroom") and not exam_data.get("location"):
                exam_data["location"] = str(exam_data["classroom"])

            exam = SectionExam(section=section, **exam_data)
            exam.full_clean()
            exam.save()

        check_time_conflict(section)
        check_exam_conflict(section)

        return section

    def update(self, instance, validated_data):
        schedules_data = validated_data.pop("schedules", None)
        exam_data = validated_data.pop("exam", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if schedules_data is not None:
            instance.schedules.all().delete()
            for sch_data in schedules_data:
                if sch_data.get("classroom") and not sch_data.get("location"):
                    sch_data["location"] = str(sch_data["classroom"])

                schedule = SectionSchedule(section=instance, **sch_data)
                schedule.full_clean()
                schedule.save()

        if exam_data is not None:
            SectionExam.objects.filter(section=instance).delete()

            if exam_data:
                if exam_data.get("classroom") and not exam_data.get("location"):
                    exam_data["location"] = str(exam_data["classroom"])

                exam = SectionExam(section=instance, **exam_data)
                exam.full_clean()
                exam.save()

        check_time_conflict(instance)
        check_exam_conflict(instance)

        return instance


class SectionDetailSerializer(serializers.ModelSerializer):
    term = serializers.StringRelatedField()
    course = serializers.StringRelatedField()
    professor = serializers.StringRelatedField()

    schedules = SectionScheduleSerializer(many=True, read_only=True)
    exam = SectionExamSerializer(read_only=True)

    class Meta:
        model = Section
        fields = [
            "id",
            "term",
            "course",
            "professor",
            "section_number",
            "capacity",
            "schedules",
            "exam",
        ]