from django.core.exceptions import ValidationError
from django.db import models


class Department(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
    )

    code = models.CharField(
        max_length=10,
        unique=True,
    )

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Classroom(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="classrooms",
    )

    number = models.CharField(max_length=32)

    capacity = models.PositiveIntegerField()

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "number"],
                name="unique_classroom_number_per_department",
            )
        ]

    def clean(self):
        if self.capacity <= 0:
            raise ValidationError({"capacity": "Capacity must be a positive integer."})

    def __str__(self):
        if self.department_id:
            return f"{self.department.code} - {self.number}"
        return self.number


class ExamHall(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="exam_halls",
    )

    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "name"],
                name="unique_exam_hall_name_per_department",
            )
        ]

    def clean(self):
        if self.capacity <= 0:
            raise ValidationError({"capacity": "Capacity must be a positive integer."})

    def __str__(self):
        if self.department_id:
            return f"{self.department.code} - {self.name}"
        return self.name        