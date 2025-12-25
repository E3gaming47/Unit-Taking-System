from typing import Iterable, Set
from django.core.exceptions import ValidationError
from .models import Prerequisite, Course

def _dfs_prereq_graph(
    course: Course,
    graph: dict[int, Set[int]],
    visiting: Set[int],
    visited: Set[int],
) -> None:
    if course.id in visiting:
        raise ValidationError("Prerequisite graph contains a cycle.")

    if course.id in visited:
        return

    visiting.add(course.id)

    for prereq_id in graph.get(course.id, set()):
        prereq_course = Course(id=prereq_id)
        _dfs_prereq_graph(prereq_course, graph, visiting, visited)

    visiting.remove(course.id)
    visited.add(course.id)


def prerequisites_valid(course: Course, candidate_prereqs: Iterable[Course]) -> None:
    candidate_ids = {c.id for c in candidate_prereqs}

    if course.id in candidate_ids:
        raise ValidationError("A course cannot be a prerequisite of itself.")

    edges = Prerequisite.objects.all().values_list("course_id", "prerequisite_course_id")
    graph: dict[int, Set[int]] = {}
    for c_id, p_id in edges:
        graph.setdefault(c_id, set()).add(p_id)

    for prereq_id in candidate_ids:
        graph.setdefault(course.id, set()).add(prereq_id)

    visiting: Set[int] = set()
    visited: Set[int] = set()
    _dfs_prereq_graph(course, graph, visiting, visited)