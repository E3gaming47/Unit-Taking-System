from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ValidationError

from .models import Registration
from .serializers import RegistrationSerializer, RegistrationListSerializer
from api.pagination import StandardResultsSetPagination


class RegistrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing student course registrations
    """
    serializer_class = RegistrationSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return registrations for the current student"""
        if self.request.user.role != "student":
            return Registration.objects.none()
        return Registration.objects.filter(student=self.request.user).select_related(
            "section__term",
            "section__course",
            "section__professor"
        ).prefetch_related(
            "section__schedules",
            "section__exam"
        )
    
    def get_serializer_class(self):
        if self.action == "list":
            return RegistrationListSerializer
        return RegistrationSerializer
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Register student for a section"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can register for courses."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            registration = serializer.save()
            return Response(
                RegistrationSerializer(registration).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            error_messages = []
            if hasattr(e, "error_dict"):
                for field, errors in e.error_dict.items():
                    for error in errors:
                        error_messages.append(str(error))
            else:
                error_messages.append(str(e))
            
            return Response(
                {"error": " ".join(error_messages) if error_messages else "Validation error"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=["get"], url_path="my-registrations")
    def my_registrations(self, request):
        """Get current student's registrations"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can view registrations."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        registrations = self.get_queryset()
        page = self.paginate_queryset(registrations)
        if page is not None:
            serializer = RegistrationListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = RegistrationListSerializer(registrations, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], url_path="total-units")
    def total_units(self, request):
        """Get total units for current student in active term"""
        if request.user.role != "student":
            return Response(
                {"error": "Only students can view total units."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from terms.models import Term
        
        # Get active term
        active_term = Term.objects.filter(is_active=True).first()
        if not active_term:
            return Response({"total_units": 0, "term": None})
        
        total_units = sum(
            reg.section.course.units
            for reg in Registration.objects.filter(
                student=request.user,
                section__term=active_term
            ).select_related("section__course")
        )
        
        return Response({
            "total_units": total_units,
            "term": {
                "id": active_term.id,
                "name": active_term.name,
                "min_units": active_term.min_units,
                "max_units": active_term.max_units
            }
        })
