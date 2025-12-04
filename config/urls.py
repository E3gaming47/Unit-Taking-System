from django.contrib import admin
from django.urls import path, include
from accounts.views import login_page, admin_departments, admin_courses, admin_students, admin_professors

urlpatterns = [
    path("django-admin/", admin.site.urls),  # Changed to avoid conflict
    
    path("", login_page, name="login_page"),
    path("admin/departments/", admin_departments, name="admin_departments"),
    path("admin/courses/", admin_courses, name="admin_courses"),
    path("admin/students/", admin_students, name="admin_students"),
    path("admin/professors/", admin_professors, name="admin_professors"),
    
    path("api/accounts/", include("accounts.urls")),
    path("api/departments/", include("departments.urls")),
    path("api/courses/", include("courses.urls")),
]
