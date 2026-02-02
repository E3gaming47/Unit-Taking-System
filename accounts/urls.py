from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    login_page,
    dashboard_redirect,
    admin_dashboard,
    admin_departments,
    admin_classrooms,
    admin_courses,
    admin_students,
    admin_professors,
    admin_terms,
    admin_term_offerings,
    student_dashboard,
    student_offered_lessons,
    student_registration,
    student_weekly_schedule,
    professor_dashboard,
    professor_lessons,
)
from .views import UserViewSet, AuthViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    # Specific routes first (before router)
    path('student/dashboard/', student_dashboard, name='student-dashboard'),
    path('student/offered-lessons/', student_offered_lessons, name='student-offered-lessons'),
    path('student/registration/', student_registration, name='student-registration'),
    path('student/weekly-schedule/', student_weekly_schedule, name='student-weekly-schedule'),
    path('professor/dashboard/', professor_dashboard, name='professor-dashboard'),
    path('professor/lessons/', professor_lessons, name='professor-lessons'),
    
    path('login-page/', login_page, name='login_page'),
    path('dashboard/', dashboard_redirect, name='dashboard-redirect'),
    path('admin/dashboard/', admin_dashboard, name='admin-dashboard'),
    path('admin/departments/', admin_departments, name='admin-departments'),
    path('admin/classrooms/', admin_classrooms, name='admin-classrooms'),
    path('admin/courses/', admin_courses, name='admin-courses'),
    path('admin/students/', admin_students, name='admin-students'),
    path('admin/professors/', admin_professors, name='admin-professors'),
    path('admin/terms/', admin_terms, name='admin-terms'),
    path('admin/term-offerings/', admin_term_offerings, name='admin-term-offerings'),

    # Router URLs last
    path('', include(router.urls)),
]
