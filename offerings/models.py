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

    def expected_sessions_per_week(self) -> int | None:
        if not self.course_id:
            return None
        return 2 if self.course.units >= 3 else 1

    def clean(self):
        errors = {}

        if self.course_id and self.professor_id and self.course.departments.exists():
            course_department_ids = self.course.departments.values_list("id", flat=True)
            if self.professor.department_id not in course_department_ids:
                errors["professor"] = "Professor must be a member of at least one course department."

        expected = self.expected_sessions_per_week()
        if expected is not None and self.pk:
            schedules_count = self.schedules.count()
            if schedules_count and schedules_count != expected:
                errors["schedules"] = f"Course requires exactly {expected} session(s) per week."

        if errors:
            raise ValidationError(errors)


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
    TIMES_TO_SLOT = {(start, end): code for code, start, end in TIME_SLOTS}

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    day_of_week = models.IntegerField(choices=WeekDay.choices)

    time_slot = models.CharField(
        max_length=8,
        choices=TIME_SLOT_CHOICES,
    )

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
        ordering = ["section", "day_of_week", "time_slot"]

    def clean(self):
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
    exam_hall = models.ForeignKey(
        "departments.ExamHall",
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
        if self.classroom and self.exam_hall:
            raise ValidationError("Choose either a Classroom or an Exam Hall, not both.")
    
        venue = self.classroom or self.exam_hall
        
        if venue and self.section_id and venue.capacity < self.section.capacity:
            raise ValidationError("Venue capacity cannot be less than section capacity.")
            
        if venue and self.section_id:
             course_dept_ids = self.section.course.departments.values_list('id', flat=True)
             if venue.department_id and venue.department_id not in course_dept_ids:
                 raise ValidationError("Exam venue must belong to one of the course departments.")        
