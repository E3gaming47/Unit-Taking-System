from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'student_id', 'professor_id']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            raise serializers.ValidationError("Username and password are required")

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError("The username or password is incorrect")

        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated")

        # رول رو همراه خروجی می‌دیم
        data["user"] = user
        return data
