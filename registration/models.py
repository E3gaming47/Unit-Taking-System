from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class TermRegistration(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,          # خود دانشجو
        on_delete=models.CASCADE,          # اگر دانشجو حذف شود، ثبت‌نامش هم حذف شود
        related_name="term_registrations"
    )

    term = models.ForeignKey(
        Term,                              # کدام ترم؟
        on_delete=models.CASCADE,          # اگر ترم حذف شود، ثبت‌نام‌ها هم حذف شود
        related_name="registrations"
    )

    registered_at = models.DateTimeField(
        auto_now_add=True                  # زمان ثبت‌نام خودکار ذخیره می‌شود
    )

    class Meta:
        unique_together = ("student", "term")  # دانشجو در هر ترم فقط یک‌بار ثبت‌نام می‌شود
        ordering = ["-registered_at"]          # جدیدترین ثبت‌نام‌ها اول

    def __str__(self):
        return f"{self.student} → {self.term}"

    def clean(self):

        pass
