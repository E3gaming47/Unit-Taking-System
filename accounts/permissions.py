from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.allowed_roles


class IsAdmin(HasRole):
    allowed_roles = ["admin"]

class IsProfessor(HasRole):
    allowed_roles = ["professor"]

class IsStudent(HasRole):
    allowed_roles = ["student"]
