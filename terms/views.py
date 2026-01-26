from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import date
from accounts.permissions import IsAdmin
from .models import Term
from .serializers import TermSerializer
from django.core.exceptions import ValidationError as DjangoValidationError



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

    def create(self, request, *args, **kwargs):
        """Override create to handle validation errors properly"""
        try:
            return super().create(request, *args, **kwargs)
        except DjangoValidationError as e:
            # Convert Django ValidationError to DRF format
            from rest_framework import status
            from rest_framework.response import Response
            if hasattr(e, 'message_dict'):
                return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Override update to handle validation errors properly"""
        try:
            return super().update(request, *args, **kwargs)
        except DjangoValidationError as e:
            # Convert Django ValidationError to DRF format
            from rest_framework import status
            from rest_framework.response import Response
            if hasattr(e, 'message_dict'):
                return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """Override destroy to handle validation errors properly"""
        try:
            instance = self.get_object()
            # Check if term is active before deletion
            if instance.is_active:
                return Response(
                    {"detail": "امکان حذف ترم فعال وجود ندارد. لطفاً ابتدا ترم را غیرفعال کنید."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return super().destroy(request, *args, **kwargs)
        except DjangoValidationError as e:
            # Convert Django ValidationError to DRF format
            if hasattr(e, 'message_dict'):
                return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        if term.status != Term.TermStatus.READY:
            return Response(
                {"detail": "فقط ترمی با وضعیت READY قابل فعال‌سازی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = date.today()
        if not (term.start_date <= today <= term.end_date):
            return Response(
                {"detail": "فعال‌سازی ترم فقط داخل بازه ترم مجاز است."},
                status=status.HTTP_400_BAD_REQUEST
            )    

        if Term.objects.filter(status=Term.TermStatus.ACTIVE).exclude(pk=term.pk).exists():
            return Response(
                {"detail": "ترم فعال دیگری وجود دارد."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        term.status = Term.TermStatus.ACTIVE
        try:
            term.save()
        except DjangoValidationError as e:
            return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)

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

        # Allow deactivating even if term is currently running
        # Admin should have the ability to deactivate terms when needed
        today = date.today()
        if today < term.start_date:
            new_status = Term.TermStatus.READY
        elif today <= term.end_date:
            # Term is currently running or has ended
            # Set to ARCHIVED if past end date, otherwise set to READY
            if today > term.end_date:
                new_status = Term.TermStatus.ARCHIVED
            else:
                # Currently running - allow deactivation but set to READY
                new_status = Term.TermStatus.READY
        else:
            new_status = Term.TermStatus.ARCHIVED
        
        # Set status and is_active explicitly
        term.status = new_status
        term.is_active = False  # Explicitly set to False when deactivating
        
        try:
            # Save the term - this will trigger model validation
            term.save()
            # Refresh from DB to get the final state
            term.refresh_from_db()
        except DjangoValidationError as e:
            return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)

        # Return complete term data with all fields
        serializer = self.get_serializer(term)
        response_data = serializer.data
        # Explicitly set these fields to ensure they're correct
        response_data['is_active'] = bool(term.is_active)
        response_data['status'] = str(term.status)
        return Response(response_data)
