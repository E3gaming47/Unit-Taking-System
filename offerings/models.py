from datetime import time

from django.db import models
from django.core.exceptions import ValidationError


class Section(models.Model):
    term = models.ForeignKey(
        "terms.Term",
        on_delete=models.CASCADE,
        related_name="sections",
    )

    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="sections",
    )

    professor = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="sections",
    )

    section_number = models.PositiveSmallIntegerField()

    capacity = models.PositiveIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["term", "course", "section_number"]
        unique_together = ("term", "course", "section_number")

    def __str__(self):
        return f"{self.term} - {self.course.code} ({self.section_number})"


class SectionSchedule(models.Model):
    class WeekDay(models.IntegerChoices):
        SATURDAY = 0, "Saturday"
        SUNDAY = 1, "Sunday"
        MONDAY = 2, "Monday"
        TUESDAY = 3, "Tuesday"
        WEDNESDAY = 4, "Wednesday"
        THURSDAY = 5, "Thursday"
        FRIDAY = 6, "Friday"

    TIME_SLOTS = [
        ("08_10", time(8, 0), time(10, 0)),
        ("10_12", time(10, 0), time(12, 0)),
        ("12_14", time(12, 0), time(14, 0)),
        ("14_16", time(14, 0), time(16, 0)),
        ("16_18", time(16, 0), time(18, 0)),
        ("18_20", time(18, 0), time(20, 0)),
    ]

    TIME_SLOT_CHOICES = [
        (code, f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}")
        for code, start, end in TIME_SLOTS
    ]
    SLOT_TO_TIMES = {code: (start, end) for code, start, end in TIME_SLOTS}
    START_TO_END = {start: end for _, start, end in TIME_SLOTS}
    START_TIME_CHOICES = [(start, start.strftime("%H:%M")) for _, start, _ in TIME_SLOTS]
    END_TIME_CHOICES = [(end, end.strftime("%H:%M")) for _, _, end in TIME_SLOTS]

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    day_of_week = models.IntegerField(choices=WeekDay.choices)

    start_time = models.TimeField(choices=START_TIME_CHOICES)
    end_time = models.TimeField(choices=END_TIME_CHOICES)

    classroom = models.ForeignKey(
        "departments.Classroom",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="section_schedules",
    )

    location = models.CharField(
        max_length=128,
        blank=True,
    )

    class Meta:
        ordering = ["section", "day_of_week", "start_time"]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("Class start_time must be before end_time.")

        expected_end = self.START_TO_END.get(self.start_time)
        if not expected_end:
            raise ValidationError({"start_time": "Start time must be one of the allowed time slots."})
        if self.end_time != expected_end:
            raise ValidationError({"end_time": "End time must match the selected 2-hour time slot."})

        if self.classroom and self.section_id and self.classroom.capacity < self.section.capacity:
            raise ValidationError("Classroom capacity cannot be less than section capacity.")


class SectionExam(models.Model):
    section = models.OneToOneField(
        Section,
        on_delete=models.CASCADE,
        related_name="exam",
    )

    exam_datetime = models.DateTimeField()

    classroom = models.ForeignKey(
        "departments.Classroom",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="section_exams",
    )

    location = models.CharField(
        max_length=128,
        blank=True,
    )

    class Meta:
        ordering = ["exam_datetime"]

    def clean(self):
        if self.classroom and self.section_id and self.classroom.capacity < self.section.capacity:
            raise ValidationError("Classroom capacity cannot be less than section capacity.")
