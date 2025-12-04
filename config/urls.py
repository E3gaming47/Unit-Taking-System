from django.contrib import admin
from django.urls import path, include
from accounts.views import login_page, admin_departments, admin_courses

urlpatterns = [
    path("django-admin/", admin.site.urls),  # Changed to avoid conflict
    
    path("", login_page, name="login_page"),
    path("admin/departments/", admin_departments, name="admin_departments"),
    path("admin/courses/", admin_courses, name="admin_courses"),
    
    path("api/accounts/", include("accounts.urls")),
    path("api/departments/", include("departments.urls")),
    path("api/courses/", include("courses.urls")),
]
