from django.contrib import admin

from .models import Classroom, Department, ExamHall


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("number", "department", "capacity")
    list_filter = ("department",)
    search_fields = ("number", "department__code", "department__name")


@admin.register(ExamHall)
class ExamHallAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "capacity")
    list_filter = ("department",)
    search_fields = ("name", "department__code", "department__name")
