from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('professor', 'Professor'),
        ('student', 'Student')
    ]

    role = models.CharField(max_length=15, choices=ROLE_CHOICES)
    student_id = models.CharField(max_length=20, blank=True, null=True)
    professor_id = models.CharField(max_length=20, blank=True, null=True)

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.role == "student" and not self.student_id:
            raise ValidationError("دانشجو باید شماره دانشجویی داشته باشد.")
        if self.role == "professor" and not self.professor_id:
            raise ValidationError("استاد باید شماره استادی داشته باشد.")
        if self.role == "admin" and (self.student_id or self.professor_id):
            raise ValidationError("مدیر نمی‌تواند شماره دانشجویی یا شماره استادی داشته باشد.")

    def __str__(self):
        return f"{self.username} ({self.role})"
