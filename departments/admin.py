from django.contrib import admin
from .models import Department, Classroom, ExamHall

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')

@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'department')
    list_filter = ('department',)

@admin.register(ExamHall)
class ExamHallAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'department')
    list_filter = ('department',)