from __future__ import annotations

from typing import Iterable, Set

from django.core.exceptions import ValidationError
from django.db.models import Q

from accounts.models import User
from courses.models import Course
from terms.models import Term
from .models import Prerequisite, Section, SectionExam, SectionSchedule


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
            start_time__lt=sch.end_time,
            end_time__gt=sch.start_time,
        )
        if overlapping.exists():
            raise ValidationError(
                "Professor has another class at the same time (schedule conflict detected)."
            )


def check_exam_conflict(section: Section) -> None:

    if not section.professor_id or not section.term_id or not hasattr(section, "exam"):
        return

    exam = section.exam

    other_exams = SectionExam.objects.filter(
        section__professor_id=section.professor_id,
        section__term_id=section.term_id,
    ).exclude(section_id=section.id)

    if other_exams.filter(exam_datetime=exam.exam_datetime).exists():
        raise ValidationError("Professor has another exam at the same time.")


def is_capacity_available(section: Section, enrolled_count: int) -> bool:

    return enrolled_count < section.capacity


def _dfs_prereq_graph(
    course_id: int,
    graph: dict[int, Set[int]],
    visiting: Set[int],
    visited: Set[int],
) -> None:
    """
    DFS helper to detect cycles in prerequisite graph.
    Uses course_id directly instead of Course object for efficiency.
    """
    if course_id in visiting:
        raise ValidationError("Prerequisite graph contains a cycle.")

    if course_id in visited:
        return

    visiting.add(course_id)

    for prereq_id in graph.get(course_id, set()):
        _dfs_prereq_graph(prereq_id, graph, visiting, visited)

    visiting.remove(course_id)
    visited.add(course_id)


def prerequisites_valid(course: Course, candidate_prereqs: Iterable[Course], exclude_prerequisite_id: int = None) -> None:
    """
    Validate that adding candidate_prereqs as prerequisites for course doesn't create cycles.
    
    Args:
        course: The course for which prerequisites are being added
        candidate_prereqs: Iterable of Course objects that are candidate prerequisites
        exclude_prerequisite_id: Optional ID of existing prerequisite to exclude (for updates)
    """
    candidate_ids = {c.id for c in candidate_prereqs}

    if course.id in candidate_ids:
        raise ValidationError("A course cannot be a prerequisite of itself.")
    
    # Build graph from existing prerequisites, excluding the one being updated if provided
    edges_query = Prerequisite.objects.all()
    if exclude_prerequisite_id:
        edges_query = edges_query.exclude(id=exclude_prerequisite_id)
    
    edges = edges_query.values_list("course_id", "prerequisite_course_id")
    graph: dict[int, Set[int]] = {}
    for c_id, p_id in edges:
        graph.setdefault(c_id, set()).add(p_id)

    # Add the new candidate prerequisites to the graph
    for prereq_id in candidate_ids:
        graph.setdefault(course.id, set()).add(prereq_id)
    
    # Check if any of the candidate prerequisites would create a direct reverse dependency
    # (i.e., course is already a prerequisite of any candidate)
    for candidate_id in candidate_ids:
        # Check if course is already a prerequisite of the candidate (reverse dependency)
        if candidate_id in graph:
            # Check if course.id is in the prerequisites of candidate_id
            if course.id in graph.get(candidate_id, set()):
                raise ValidationError(
                    f"Circular dependency detected: Course {course.id} cannot be a prerequisite of "
                    f"course {candidate_id} because course {candidate_id} is already a prerequisite of course {course.id}."
                )

    # Use DFS to detect cycles in the entire graph
    visiting: Set[int] = set()
    visited: Set[int] = set()
    _dfs_prereq_graph(course.id, graph, visiting, visited)

