from datetime import date

from django.core.exceptions import ValidationError
from django.db import models


class Term(models.Model):
    class TermStatus(models.TextChoices):
        PLANNING = "planning", "Planning"
        READY = "ready", "Ready"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"
        

    name = models.CharField(max_length=64, unique=True)

    start_date = models.DateField(null=False, blank=False)
    end_date = models.DateField(null=False, blank=False)
    registration_start = models.DateField(null=False, blank=False, default=date.today)
    registration_end = models.DateField(null=False, blank=False, default=date.today)

    status = models.CharField(
        max_length=16,
        choices=TermStatus.choices,
        default=TermStatus.PLANNING,
        db_index=True,
    )

    is_active = models.BooleanField(default=False, null=False, blank=False)

    min_units = models.PositiveSmallIntegerField(default=0, null=False, blank=False)
    max_units = models.PositiveSmallIntegerField(default=20, null=False, blank=False)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name

    def clean(self):
        errors = {}

        if self.start_date >= self.end_date:
            errors["end_date"] = "پایان ترم باید بعد از شروع ترم باشد."

        if self.registration_start >= self.registration_end:
            errors["registration_end"] = "پایان انتخاب واحد باید بعد از شروع آن باشد."

        if self.min_units > self.max_units:
            errors["max_units"] = "حداکثر واحد باید بیشتر یا مساوی حداقل واحد باشد."

        if not (self.start_date <= self.registration_start <= self.end_date):
            errors["registration_start"] = "شروع انتخاب واحد باید داخل بازه ترم باشد."

        if not (self.start_date <= self.registration_end <= self.end_date):
            errors["registration_end"] = "پایان انتخاب واحد باید داخل بازه ترم باشد."

        if self.status == Term.TermStatus.ACTIVE:
            qs = Term.objects.filter(status=Term.TermStatus.ACTIVE)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["status"] = "فقط یک ترم می‌تواند فعال باشد."

            qs = Term.objects.all()
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            overlap = qs.filter(
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
            )
            if overlap.exists():
                errors["start_date"] = "بازه این ترم با ترم دیگری هم‌پوشانی دارد."
 
            today = date.today()

            if self.status == Term.TermStatus.ACTIVE:
                if not (self.start_date <= today <= self.end_date):
                    errors["status"] = "فعال‌سازی ترم فقط داخل بازه ترم مجاز است."

            if self.status == Term.TermStatus.READY:
                if today >= self.start_date:
                    errors["status"] = "وضعیت READY فقط قبل از شروع ترم مجاز است."

            if self.status == Term.TermStatus.ARCHIVED:
                if today <= self.end_date:
                    errors["status"] = "وضعیت ARCHIVED فقط بعد از پایان ترم مجاز است."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.is_active and self.status != Term.TermStatus.ACTIVE:
            self.status = Term.TermStatus.ACTIVE

        if self.status == Term.TermStatus.ACTIVE:
            self.is_active = True
        else:
            self.is_active = False

        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.is_active:
            raise ValidationError("امکان حذف ترم فعال وجود ندارد.")
        return super().delete(*args, **kwargs)