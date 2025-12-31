from rest_framework import serializers
from .models import Registration
from offerings.serializers import SectionDetailSerializer


class RegistrationSerializer(serializers.ModelSerializer):
    section = SectionDetailSerializer(read_only=True)
    section_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Registration
        fields = ["id", "student", "section", "section_id", "registered_at"]
        read_only_fields = ["id", "student", "registered_at"]
    
    def create(self, validated_data):
        # Set student from request user
        validated_data["student"] = self.context["request"].user
        return super().create(validated_data)


class RegistrationListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing registrations"""
    section = SectionDetailSerializer(read_only=True)
    
    class Meta:
        model = Registration
        fields = ["id", "section", "registered_at"]

