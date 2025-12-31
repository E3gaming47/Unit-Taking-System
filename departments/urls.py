from rest_framework.routers import DefaultRouter
from .views import ClassroomViewSet, DepartmentViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="departments")
router.register("classrooms", ClassroomViewSet, basename="classrooms")

urlpatterns = router.urls
