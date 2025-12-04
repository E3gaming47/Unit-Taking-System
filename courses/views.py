from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from accounts.permissions import IsAdmin
from .models import Course
from .serializers import CourseSerializer

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsAdmin])
    def units_choices(self, request):
        """
        برگرداندن لیست انتخابیِ تعداد واحدها برای استفاده در فرانت‌اند.
        """
        units_field = Course._meta.get_field("units")
        choices = [{"value": value, "label": str(label)} for value, label in units_field.choices]
        return Response({"units": choices})
