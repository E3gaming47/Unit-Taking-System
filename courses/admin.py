from django.contrib import admin
from .models import Course, Prerequisite

class PrerequisiteInline(admin.TabularInline):
    model = Prerequisite
    fk_name = 'course'
    extra = 1

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'units', 'created_at')
    search_fields = ('code', 'title')
    list_filter = ('units',)
    inlines = [PrerequisiteInline]

@admin.register(Prerequisite)
class PrerequisiteAdmin(admin.ModelAdmin):
    list_display = ('course', 'prerequisite_course')
    search_fields = ('course__title', 'prerequisite_course__title')