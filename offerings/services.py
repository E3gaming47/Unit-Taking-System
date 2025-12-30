from __future__ import annotations

from django.core.exceptions import ValidationError
from accounts.models import User
from .models import Section, SectionExam, SectionSchedule


def assign_professor(section: Section, professor: User) -> None:
    if professor.role != "professor":
        raise ValidationError("Only users with role 'professor' can be assigned to a section.")

    section.professor = professor
    section.save(update_fields=["professor"])


def check_time_conflict(section: Section) -> None:

    if not section.professor_id or not section.term_id:
        return

    schedules = SectionSchedule.objects.filter(section=section)
    if not schedules.exists():
        return

    other_sections = (
        Section.objects.filter(
            professor_id=section.professor_id,
            term_id=section.term_id,
        )
        .exclude(id=section.id)
    )

    other_schedules = SectionSchedule.objects.filter(section__in=other_sections)

    for sch in schedules:
        overlapping = other_schedules.filter(
            day_of_week=sch.day_of_week,
            time_slot=sch.time_slot,
        )
        if overlapping.exists():
            raise ValidationError(
                "Professor has another class at the same time (schedule conflict detected)."
            )


def check_exam_conflict(section: Section) -> None:

    if not section.professor_id or not section.term_id:
        return
    try:
        exam = section.exam
    except SectionExam.DoesNotExist:
        return

    other_exams = SectionExam.objects.filter(
        section__professor_id=section.professor_id,
        section__term_id=section.term_id,
    ).exclude(section_id=section.id)

    if other_exams.filter(exam_datetime=exam.exam_datetime).exists():
        raise ValidationError("Professor has another exam at the same time.")


def is_capacity_available(section: Section, enrolled_count: int) -> bool:

    return enrolled_count < section.capacity
