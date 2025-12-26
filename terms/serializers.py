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
            "status",
            "is_active",
            "min_units",
            "max_units",
        ]

    def validate(self, data):
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        reg_start = data.get("registration_start")
        reg_end = data.get("registration_end")
        min_units = data.get("min_units")
        max_units = data.get("max_units")

        errors = {}

        if start_date and end_date and start_date >= end_date:
            errors["end_date"] = "پایان ترم باید بعد از شروع ترم باشد."

        if reg_start and reg_end and reg_start >= reg_end:
            errors["registration_end"] = "پایان انتخاب واحد باید بعد از شروع آن باشد."

        if start_date and reg_start and not (start_date <= reg_start <= end_date):
            errors["registration_start"] = "شروع انتخاب واحد باید داخل بازه ترم باشد."

        if start_date and reg_end and not (start_date <= reg_end <= end_date):
            errors["registration_end"] = "پایان انتخاب واحد باید داخل بازه ترم باشد."

        if min_units is not None and max_units is not None and min_units > max_units:
            errors["max_units"] = "حداکثر واحد باید بیشتر یا مساوی حداقل واحد باشد."

        if errors:
            raise serializers.ValidationError(errors)

        return data