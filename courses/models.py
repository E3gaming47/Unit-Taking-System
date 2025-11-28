from django.db import models
from django.core.exceptions import ValidationError


class Course(models.Model):
    code = models.CharField(
        max_length=20,
        unique=True
    )

    title = models.CharField(
        max_length=200
    )

    units = models.PositiveSmallIntegerField(
        choices=[(i, i) for i in range(1, 5)]
    )

    # اتصال به اپ دپارتمان
    departments = models.ManyToManyField(
        "departments.Department",
        blank=True,
        related_name="courses"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["title"],
                name="unique_course_title"
            )
        ]

    def clean(self):
        if not (1 <= self.units <= 4):
            raise ValidationError("Units must be between 1 and 4.")

    def __str__(self):
        return f"{self.code} - {self.title}"
