from django.contrib import admin
from django.urls import path, include
from accounts.views import login_page, admin_departments, admin_courses
from django.urls import path, re_path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="Unit Taking System API",
        default_version="v1",
        description="سیستم جامع انتخاب واحد دانشگاهی - API Documentation",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@university.local"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)


urlpatterns = [
    path("django-admin/", admin.site.urls),  # Changed to avoid conflict
    
    path("", login_page, name="login_page"),
    path("admin/departments/", admin_departments, name="admin_departments"),
    path("admin/courses/", admin_courses, name="admin_courses"),
    
    path("api/accounts/", include("accounts.urls")),
    path("api/departments/", include("departments.urls")),
    path("api/courses/", include("courses.urls")),
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]


