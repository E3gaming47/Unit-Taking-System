from django.contrib import admin
from django.urls import path, include
from accounts.views import login_page

urlpatterns = [
    path("admin/", admin.site.urls),
    
    path("", login_page, name="login_page"),
    path("api/accounts/", include("accounts.urls")),
    path("api/departments/", include("departments.urls")),
    path("api/courses/", include("courses.urls")),
]
