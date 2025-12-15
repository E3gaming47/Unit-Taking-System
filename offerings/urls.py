from rest_framework.routers import DefaultRouter
from .views import PrerequisiteViewSet, SectionViewSet

router = DefaultRouter()
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"prerequisites", PrerequisiteViewSet, basename="prerequisite")

urlpatterns = router.urls

