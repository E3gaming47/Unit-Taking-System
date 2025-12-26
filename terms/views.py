from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsAdmin
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
            return [IsAdmin()]
        return [permissions.AllowAny()]

    # -----------------------
    # اکشن فعال‌سازی ترم
    # POST /terms/{id}/activate/
    # -----------------------
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        term = self.get_object()

        if term.status == Term.TermStatus.ACTIVE:
            return Response(
                {"detail": "این ترم از قبل فعال است."},
                status=status.HTTP_400_BAD_REQUEST
            )
        today = date.today()
        if not (term.start_date <= today <= term.end_date):
            return Response(
                {"detail": "فعال‌سازی ترم فقط داخل بازه ترم مجاز است."},
                status=status.HTTP_400_BAD_REQUEST
            )    

        Term.objects.filter(status=Term.TermStatus.ACTIVE).exclude(pk=term.pk).update(
            status=Term.TermStatus.READY,
            is_active=False,
        )

        term.status = Term.TermStatus.ACTIVE
        term.save()

        serializer = self.get_serializer(term)
        return Response(serializer.data)
    # -----------------------
    # اکشن غیرفعال‌سازی ترم
    # POST /terms/{id}/deactivate/
    # -----------------------
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        term = self.get_object()

        if term.status != Term.TermStatus.ACTIVE:
            return Response(
                {"detail": "این ترم از قبل غیرفعال است."},
                status=status.HTTP_400_BAD_REQUEST
            )

        term.status = Term.TermStatus.READY
        term.save()

        serializer = self.get_serializer(term)
        return Response(serializer.data)