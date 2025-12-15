from django.contrib import admin
from .models import Term


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "start_date",
        "end_date",
        "registration_start",
        "registration_end",
        "min_units",
        "max_units",
        "is_active",
    )
    list_filter = ("is_active", "start_date")
    search_fields = ("name",)
    date_hierarchy = "start_date"
    fieldsets = (
        (
            "اطلاعات پایه",
            {
                "fields": ("name", "is_active"),
            },
        ),
        (
            "بازه زمانی ترم",
            {
                "fields": ("start_date", "end_date"),
            },
        ),
        (
            "بازه انتخاب واحد",
            {
                "fields": ("registration_start", "registration_end"),
            },
        ),
        (
            "محدودیت واحد",
            {
                "fields": ("min_units", "max_units"),
                "description": "حداقل و حداکثر تعداد واحد قابل اخذ در این ترم",
            },
        ),
    )
