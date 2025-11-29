from django.db import models
from django.core.exceptions import ValidationError


class Term(models.Model):
    name = models.CharField( #اسم ترم
        max_length=64, #حداکثر طول رشته ۶۴ کاراکتر است.
        unique=True,   #یونیک باشه               
    )
    
    start_date = models.DateField()   # تاریخ شروع ترم
    end_date = models.DateField()     # تاریخ پایان ترم

    class Meta:
        ordering = ["-start_date"]    # جدیدترین ترم‌ها اول نمایش داده شوند

    def __str__(self):
        return self.name              # نمایش خوانا در ادمین

    def clean(self):         # جلوگیری از اینکه تاریخ شروع بعد از پایان شود

        if self.start_date >= self.end_date:
            raise ValidationError("start_date must be before end_date.") #این ورودی اشتباهه، اجازه نمی‌دم توی دیتابیس بره
