from datetime import date
from django.db import models
from django.core.exceptions import ValidationError


class Term(models.Model):
    name = models.CharField(max_length=64, unique=True)

    start_date = models.DateField(null=False, blank=False)     # تاریخ شروع ترم
    end_date = models.DateField(null=False, blank=False)     # تاریخ پایان سمی ترم
    registration_start = models.DateField(null=False, blank=False, default=date.today)     # تاریخ شروع بازه انتخاب واحد
    registration_end = models.DateField(null=False, blank=False, default=date.today)    # تاریخ پایان بازه انتخاب واحد


    is_active = models.BooleanField(default=False, null=False, blank=False)    # مشخص می‌کند آیا این ترم، ترم فعال سیستم است یا نه


    class Meta:
        # هنگام گرفتن لیست ترم‌ها، جدیدترین ترم‌ها اول نمایش داده می‌شوند
        ordering = ["-start_date"]
    def __str__(self):
        return self.name



    def clean(self):
        """
        اعتبارسنجی منطقی داده‌ها قبل از ذخیره در دیتابیس
        این متد جلوی ورود داده‌های غیرمنطقی را می‌گیرد
        
        """
        errors = {}
        if self.start_date >= self.end_date:
            errors["end_date"] = "پایان ترم باید بعد از شروع ترم باشد."

        if self.registration_start >= self.registration_end:
            errors["registration_end"] = "پایان انتخاب واحد باید بعد از شروع آن باشد."

        if not (self.start_date <= self.registration_start <= self.end_date):
            errors["registration_start"] = "شروع انتخاب واحد باید داخل بازه ترم باشد."

        if not (self.start_date <= self.registration_end <= self.end_date):
            errors["registration_end"] = "پایان انتخاب واحد باید داخل بازه ترم باشد."

        if self.is_active:
            # گرفتن تمام ترم‌های فعال
            qs = Term.objects.filter(is_active=True)

            # اگر در حال ویرایش ترم فعلی هستیم، خودش را از کوئری حذف می‌کنیم
            #«وقتی ترم فعال خودش را ویرایش می‌کنیم، سیستم فکر نکند ترم فعال دیگری وجود دارد»
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            # اگر ترم فعال دیگری وجود داشت → خطا
            if qs.exists():
                errors["is_active"] = "فقط یک ترم می‌تواند فعال باشد."

        # اگر حداقل یک خطا وجود داشت، کل عملیات ذخیره متوقف می‌شود
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs): #«قبل از اینکه این ترم ذخیره شود، اول چکش کن ببین منطقی هست یا نه»
        
        # اجرای full_clean برای اطمینان از اجرای متد clean
        # (حتی در API، shell، یا save مستقیم)
        self.full_clean()

        # ذخیره واقعی داده در دیتابیس
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        #  جلوگیری از حذف ترم فعال
        if self.is_active:
            raise ValidationError("امکان حذف ترم فعال وجود ندارد.")

        # حذف واقعی از دیتابیس
        return super().delete(*args, **kwargs)
