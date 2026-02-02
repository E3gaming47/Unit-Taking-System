from django.contrib import admin
from .models import Section, SectionSchedule, SectionExam

class SectionScheduleInline(admin.TabularInline):
    model = SectionSchedule
    extra = 1

class SectionExamInline(admin.StackedInline):
    model = SectionExam
    extra = 0

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('course', 'term', 'section_number', 'professor', 'capacity')
    list_filter = ('term', 'course')
    search_fields = ('course__title', 'professor__last_name')
    inlines = [SectionScheduleInline, SectionExamInline]

@admin.register(SectionSchedule)
class SectionScheduleAdmin(admin.ModelAdmin):
    list_display = ('section', 'day_of_week', 'time_slot', 'classroom', 'location')
    list_filter = ('day_of_week', 'time_slot')

@admin.register(SectionExam)
class SectionExamAdmin(admin.ModelAdmin):
    list_display = ('section', 'exam_datetime', 'classroom', 'exam_hall', 'location')