from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    login_page,
    dashboard_redirect,
    admin_dashboard,
    admin_departments,
    admin_courses,
    admin_students,
    admin_professors,
    student_dashboard,
    professor_dashboard,
)
from .views import UserViewSet, AuthViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    # Specific routes first (before router)
    path('student/dashboard/', student_dashboard, name='student-dashboard'),
    path('professor/dashboard/', professor_dashboard, name='professor-dashboard'),
    
    path('login-page/', login_page, name='login_page'),
    path('dashboard/', dashboard_redirect, name='dashboard-redirect'),
    path('admin/dashboard/', admin_dashboard, name='admin-dashboard'),
    path('admin/departments/', admin_departments, name='admin-departments'),
    path('admin/courses/', admin_courses, name='admin-courses'),
    path('admin/students/', admin_students, name='admin-students'),
    path('admin/professors/', admin_professors, name='admin-professors'),

    # Router URLs last
    path('', include(router.urls)),
]
