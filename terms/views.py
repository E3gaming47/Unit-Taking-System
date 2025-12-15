from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Term
from .serializers import TermSerializer



class TermViewSet(viewsets.ModelViewSet):
    """
    مدیریت ترم‌ها (فقط ادمین اجازه تغییر دارد)
    """
    queryset = Term.objects.all()
    serializer_class = TermSerializer

    # کنترل دسترسی
    def get_permissions(self):
        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
            "activate",
            "deactivate",
        ]:
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    # -----------------------
    # اکشن فعال‌سازی ترم
    # POST /terms/{id}/activate/
    # -----------------------
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        term = self.get_object()

        # اگر همین ترم فعال است
        if term.is_active:
            return Response(
                {"detail": "این ترم از قبل فعال است."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # غیر فعال کردن سایر ترم‌ها
        Term.objects.filter(is_active=True).exclude(pk=term.pk).update(is_active=False)

        # فعال کردن این ترم
        term.is_active = True
        term.save()  # clean + full_clean اجرا می‌شود

        serializer = self.get_serializer(term)
        return Response(serializer.data)

    # -----------------------
    # اکشن غیرفعال‌سازی ترم
    # POST /terms/{id}/deactivate/
    # -----------------------
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        term = self.get_object()

        if not term.is_active:
            return Response(
                {"detail": "این ترم از قبل غیرفعال است."},
                status=status.HTTP_400_BAD_REQUEST
            )

        term.is_active = False
        term.save()

        serializer = self.get_serializer(term)
        return Response(serializer.data)
