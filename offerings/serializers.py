from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

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
    time_slot = serializers.ChoiceField(
        choices=SectionSchedule.TIME_SLOT_CHOICES,
        required=False,
    )
    start_time = serializers.TimeField(required=False, write_only=True)
    end_time = serializers.TimeField(required=False, write_only=True)
    classroom = serializers.PrimaryKeyRelatedField(
        queryset=Classroom.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = SectionSchedule
        fields = ["id", "day_of_week", "time_slot", "start_time", "end_time", "classroom", "location"]
        read_only_fields = ["id"]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        start_time, end_time = SectionSchedule.SLOT_TO_TIMES.get(instance.time_slot, (None, None))
        rep["start_time"] = start_time.isoformat() if start_time else None
        rep["end_time"] = end_time.isoformat() if end_time else None
        return rep


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

    def _raise_django_validation_error(self, exc: DjangoValidationError) -> None:
        raise serializers.ValidationError(getattr(exc, "message_dict", {"detail": exc.messages}))

    @transaction.atomic
    def create(self, validated_data):
        schedules_data = validated_data.pop("schedules", [])
        exam_data = validated_data.pop("exam", None)

        section = Section(**validated_data)
        try:
            section.full_clean()
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)
        section.save()

        for sch_data in schedules_data:
            time_slot = sch_data.get("time_slot")
            if time_slot:
                sch_data.pop("start_time", None)
                sch_data.pop("end_time", None)
            else:
                start_time = sch_data.pop("start_time", None)
                end_time = sch_data.pop("end_time", None)
                if start_time is None or end_time is None:
                    raise serializers.ValidationError({"schedules": "time_slot is required for schedules."})
                slot = SectionSchedule.TIMES_TO_SLOT.get((start_time, end_time))
                if not slot:
                    raise serializers.ValidationError({"schedules": "Start/end time must match a fixed 2-hour time slot."})
                sch_data["time_slot"] = slot

            if sch_data.get("classroom") and not sch_data.get("location"):
                sch_data["location"] = str(sch_data["classroom"])

            schedule = SectionSchedule(section=section, **sch_data)
            try:
                schedule.full_clean()
            except DjangoValidationError as e:
                self._raise_django_validation_error(e)
            schedule.save()

        if exam_data:
            if exam_data.get("classroom") and not exam_data.get("location"):
                exam_data["location"] = str(exam_data["classroom"])

            exam = SectionExam(section=section, **exam_data)
            try:
                exam.full_clean()
            except DjangoValidationError as e:
                self._raise_django_validation_error(e)
            exam.save()

        try:
            section.full_clean()
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)

        try:
            check_time_conflict(section)
            check_exam_conflict(section)
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)

        return section

    @transaction.atomic
    def update(self, instance, validated_data):
        schedules_data = validated_data.pop("schedules", None)
        exam_data = validated_data.pop("exam", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.full_clean()
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)
        instance.save()

        if schedules_data is not None:
            instance.schedules.all().delete()
            for sch_data in schedules_data:
                time_slot = sch_data.get("time_slot")
                if time_slot:
                    sch_data.pop("start_time", None)
                    sch_data.pop("end_time", None)
                else:
                    start_time = sch_data.pop("start_time", None)
                    end_time = sch_data.pop("end_time", None)
                    if start_time is None or end_time is None:
                        raise serializers.ValidationError({"schedules": "time_slot is required for schedules."})
                    slot = SectionSchedule.TIMES_TO_SLOT.get((start_time, end_time))
                    if not slot:
                        raise serializers.ValidationError({"schedules": "Start/end time must match a fixed 2-hour time slot."})
                    sch_data["time_slot"] = slot

                if sch_data.get("classroom") and not sch_data.get("location"):
                    sch_data["location"] = str(sch_data["classroom"])

                schedule = SectionSchedule(section=instance, **sch_data)
                try:
                    schedule.full_clean()
                except DjangoValidationError as e:
                    self._raise_django_validation_error(e)
                schedule.save()

        if exam_data is not None:
            SectionExam.objects.filter(section=instance).delete()

            if exam_data:
                if exam_data.get("classroom") and not exam_data.get("location"):
                    exam_data["location"] = str(exam_data["classroom"])

                exam = SectionExam(section=instance, **exam_data)
                try:
                    exam.full_clean()
                except DjangoValidationError as e:
                    self._raise_django_validation_error(e)
                exam.save()

        try:
            instance.full_clean()
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)

        try:
            check_time_conflict(instance)
            check_exam_conflict(instance)
        except DjangoValidationError as e:
            self._raise_django_validation_error(e)

        return instance


class SectionDetailSerializer(serializers.ModelSerializer):
    term = serializers.StringRelatedField()
    course = serializers.StringRelatedField()
    course_id = serializers.IntegerField(read_only=True)
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
