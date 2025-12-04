from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, AuthViewSet
from .views import DepartmentsList
from accounts.views import login_page
from django.urls import path
from .views import (
    DepartmentsList,
    LoginView,
    CoursesList,
    RegisterView,
    SelectCourse,
    RemoveCourse,
    CourseDetail,
)


router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    # Router URLs
    path('', include(router.urls)),
    path('login-pge/', login_page, name='login_page'),
    path("departments/", DepartmentsList.as_view(), name="departments_list"),
    path("login/", LoginView.as_view(), name="login"),
    path("list/", CoursesList.as_view(), name="courses_list"),
    path("register/", RegisterView.as_view(), name="register"),
    path("select/", SelectCourse.as_view(), name="select_course"),
    path("remove/", RemoveCourse.as_view(), name="remove_course"),
    path("<int:id>/detail/", CourseDetail.as_view(), name="course_detail"),


]
