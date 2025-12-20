from rest_framework import serializers

from accounts.models import User
from courses.models import Course
from terms.models import Term
from .models import Prerequisite, Section, SectionExam, SectionSchedule
from .services import (
    check_exam_conflict,
    check_time_conflict,
    prerequisites_valid,
)


class SectionScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionSchedule
        fields = ["id", "day_of_week", "start_time", "end_time", "location"]
        read_only_fields = ["id"]


class SectionExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionExam
        fields = ["exam_datetime", "location"]


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

    def validate(self, attrs):

        term = attrs.get("term") or getattr(self.instance, "term", None)
        course = attrs.get("course") or getattr(self.instance, "course", None)
        professor = attrs.get("professor") or getattr(self.instance, "professor", None)

        if not all([term, course, professor]):
            return attrs
        return attrs

    def create(self, validated_data):
        schedules_data = validated_data.pop("schedules", [])
        exam_data = validated_data.pop("exam", None)

        section = Section.objects.create(**validated_data)

        schedule_instances = []
        for sch_data in schedules_data:
            schedule = SectionSchedule(section=section, **sch_data)
            schedule.full_clean()
            schedule.save()
            schedule_instances.append(schedule)

        if exam_data:
            exam = SectionExam(section=section, **exam_data)
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
                schedule = SectionSchedule(section=instance, **sch_data)
                schedule.full_clean()
                schedule.save()

        if exam_data is not None:
            SectionExam.objects.filter(section=instance).delete()
            exam = SectionExam(section=instance, **exam_data)
            exam.save()

        check_time_conflict(instance)
        check_exam_conflict(instance)

        return instance


class SectionDetailSerializer(serializers.ModelSerializer):
    term = serializers.StringRelatedField()
    course = serializers.StringRelatedField()
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    professor = serializers.StringRelatedField()

    schedules = SectionScheduleSerializer(many=True, read_only=True)
    exam = SectionExamSerializer(read_only=True)

    class Meta:
        model = Section
        fields = [
            "id",
            "term",
            "course",
            "course_id",
            "professor",
            "section_number",
            "capacity",
            "schedules",
            "exam",
        ]


class PrerequisiteSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=True)
    prerequisite_course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=True)

    class Meta:
        model = Prerequisite
        fields = ["id", "course", "prerequisite_course"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        course = attrs.get("course")
        prereq = attrs.get("prerequisite_course")

        if not course:
            raise serializers.ValidationError({"course": "Course is required."})
        
        if not prereq:
            raise serializers.ValidationError({"prerequisite_course": "Prerequisite course is required."})

        # Check if prerequisite course is the same as course
        if course.id == prereq.id:
            raise serializers.ValidationError("A course cannot be a prerequisite of itself.")

        # Validate prerequisites (exclude current instance if updating)
        exclude_id = self.instance.id if self.instance else None
        prerequisites_valid(course, [prereq], exclude_prerequisite_id=exclude_id)
        return attrs

