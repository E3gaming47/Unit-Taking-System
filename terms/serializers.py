from rest_framework import serializers
from .models import Term


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = [
            "id",
            "name",
            "start_date",
            "end_date",
            "registration_start",
            "registration_end",
            "is_active",
            "min_units",
            "max_units",
        ]

    def validate(self, data): #قبل از اینکه این JSON ذخیره شود، بررسی‌اش کن ببین منطقی هست یا نه
       
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        reg_start = data.get("registration_start")
        reg_end = data.get("registration_end")
        min_units = data.get("min_units")
        max_units = data.get("max_units")
        is_active = data.get("is_active")

        errors = {}

        # شروع ترم باید قبل از پایان ترم باشد
        if start_date and end_date and start_date >= end_date:
            errors["end_date"] = "پایان ترم باید بعد از شروع ترم باشد."

        # بازه انتخاب واحد باید منطقی باشد
        if reg_start and reg_end and reg_start >= reg_end:
            errors["registration_end"] = "پایان انتخاب واحد باید بعد از شروع آن باشد."

        # انتخاب واحد باید داخل بازه ترم باشد
        if start_date and reg_start and not (start_date <= reg_start <= end_date):
            errors["registration_start"] = "شروع انتخاب واحد باید داخل بازه ترم باشد."

        if start_date and reg_end and not (start_date <= reg_end <= end_date):
            errors["registration_end"] = "پایان انتخاب واحد باید داخل بازه ترم باشد."

        # حداقل واحد باید کمتر یا مساوی حداکثر واحد باشد
        if min_units is not None and max_units is not None and min_units > max_units:
            errors["max_units"] = "حداکثر واحد باید بیشتر یا مساوی حداقل واحد باشد."

        # بررسی اینکه فقط یک ترم می‌تواند فعال باشد
        if is_active:
            # اگر is_active در data نیست، از instance استفاده می‌کنیم
            instance = self.instance
            active_terms = Term.objects.filter(is_active=True)
            
            # اگر در حال ویرایش هستیم، خود ترم فعلی را از لیست حذف می‌کنیم
            if instance and instance.pk:
                active_terms = active_terms.exclude(pk=instance.pk)
            
            # اگر ترم فعال دیگری وجود دارد
            if active_terms.exists():
                errors["is_active"] = "فقط یک ترم می‌تواند فعال باشد. لطفاً ابتدا ترم فعال فعلی را غیرفعال کنید."

        if errors:
            raise serializers.ValidationError(errors)

        return data
