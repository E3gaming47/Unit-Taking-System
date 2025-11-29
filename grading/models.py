from django.db import models               # برای ساخت مدل‌ها
from django.conf import settings           # دسترسی به مدل User در صورت نیاز


class Grade(models.Model):
    STATUS_PASSED = "passed"               # وضعیت پاس شده
    STATUS_FAILED = "failed"               # وضعیت رد شده
    STATUS_INCOMPLETE = "incomplete"       # هنوز نمره ثبت نشده / ناقص

    STATUS_CHOICES = [
        (STATUS_PASSED, "Passed"),         # نمایش در ادمین
        (STATUS_FAILED, "Failed"),
        (STATUS_INCOMPLETE, "Incomplete"),
    ]

    enrollment = models.OneToOneField(     
        "registration.Enrollment",         # نمره فقط برای یک ثبت‌نام مشخص است
        on_delete=models.CASCADE,          # اگر ثبت‌نام حذف شود نمره‌اش هم حذف می‌شود
        related_name="grade_record"        # دسترسی: enrollment.grade_record
    )

    grade_value = models.FloatField(
        null=True,                         # نمره در ابتدا خالی است
        blank=True,                        # فرم‌ها اجازه خالی بودن می‌دهند
        help_text=" "            # توضیح برای ادمین
    )

    status = models.CharField(
        max_length=20,                     # طول رشته وضعیت
        choices=STATUS_CHOICES,            # انتخاب از بین وضعیت‌های تعریف‌شده
        default=STATUS_INCOMPLETE          # پیش‌فرض: نمره ثبت نشده
    )

    created_at = models.DateTimeField(
        auto_now_add=True                  # زمان ایجاد رکورد
    )

    updated_at = models.DateTimeField(
        auto_now=True                      # زمان آخرین تغییر (مثلاً هنگام تغییر نمره)
    )

    class Meta:
        ordering = ["-updated_at"]         # مرتب‌سازی بر اساس آخرین به‌روزرسانی (جدیدترین بالا)

    def __str__(self):
        return f"{self.enrollment.student} - {self.enrollment.course}: {self.grade_value}"
