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

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    day_of_week = models.IntegerField(choices=WeekDay.choices)

    start_time = models.TimeField()
    end_time = models.TimeField()

    location = models.CharField(
        max_length=128,
        blank=True,
    )

    class Meta:
        ordering = ["section", "day_of_week", "start_time"]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("Class start_time must be before end_time.")


class SectionExam(models.Model):
    section = models.OneToOneField(
        Section,
        on_delete=models.CASCADE,
        related_name="exam",
    )

    exam_datetime = models.DateTimeField()
    location = models.CharField(
        max_length=128,
        blank=True,
    )

    class Meta:
        ordering = ["exam_datetime"]


class Prerequisite(models.Model):
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="prerequisites",
    )

    prerequisite_course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="is_prerequisite_of",
    )

    class Meta:
        unique_together = ("course", "prerequisite_course")

    def clean(self):
        # Check if prerequisite course is the same as course
        if self.course and self.prerequisite_course:
            if self.course_id == self.prerequisite_course_id:
                raise ValidationError("A course cannot be a prerequisite of itself.")

    def save(self, *args, **kwargs):
        # Ensure clean() is called before saving
        self.full_clean()
        return super().save(*args, **kwargs)

