from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'student_id', 'professor_id', 'password', 'first_name', 'last_name']
        read_only_fields = ['id']
        extra_kwargs = {
            'username': {'required': True},
            'email': {'required': False},
        }

    def validate_username(self, value):
        
        if self.instance and self.instance.username == value:
            return value
        
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        
        if value:
            if self.instance and self.instance.email == value:
                return value
            
            if User.objects.filter(email=value).exists():
                raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_student_id(self, value):
        
        if value:
            if self.instance and self.instance.student_id == value:
                return value
            
            if User.objects.filter(student_id=value).exists():
                raise serializers.ValidationError("A user with this student_id already exists.")
        return value

    def validate_professor_id(self, value):
        
        if value:
            if self.instance and self.instance.professor_id == value:
                return value
            
            if User.objects.filter(professor_id=value).exists():
                raise serializers.ValidationError("A user with this professor_id already exists.")
        return value

    def validate(self, data):
        
        role = data.get('role', getattr(self.instance, 'role', None) if self.instance else None)
        student_id = data.get('student_id')
        professor_id = data.get('professor_id')

        if role == 'student':
            if not student_id:
                raise serializers.ValidationError({
                    'student_id': 'Student must have a student_id'
                })
            if professor_id:
                raise serializers.ValidationError({
                    'professor_id': 'Student cannot have a professor_id'
                })
        
        elif role == 'professor':
            if not professor_id:
                raise serializers.ValidationError({
                    'professor_id': 'Professor must have a professor_id'
                })
            if student_id:
                raise serializers.ValidationError({
                    'student_id': 'Professor cannot have a student_id'
                })
        
        elif role == 'admin':
            if student_id or professor_id:
                raise serializers.ValidationError({
                    'role': 'Admin cannot have student_id or professor_id'
                })

        return data

    def create(self, validated_data):
        
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        
        if password:
            user.set_password(password)
        else:
            
            user.set_unusable_password()
        
        user.save()
        return user

    def update(self, instance, validated_data):
        
        password = validated_data.pop('password', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class UserCreateSerializer(serializers.ModelSerializer):
    
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'student_id', 'professor_id', 'first_name', 'last_name']
        extra_kwargs = {
            'username': {'required': True},
            'role': {'required': True},
        }

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_student_id(self, value):
        if value and User.objects.filter(student_id=value).exists():
            raise serializers.ValidationError("A user with this student_id already exists.")
        return value

    def validate_professor_id(self, value):
        if value and User.objects.filter(professor_id=value).exists():
            raise serializers.ValidationError("A user with this professor_id already exists.")
        return value

    def validate(self, data):
        role = data.get('role')
        student_id = data.get('student_id')
        professor_id = data.get('professor_id')

        if role == 'student':
            if not student_id:
                raise serializers.ValidationError({
                    'student_id': 'Student must have a student_id'
                })
            if professor_id:
                raise serializers.ValidationError({
                    'professor_id': 'Student cannot have a professor_id'
                })
        
        elif role == 'professor':
            if not professor_id:
                raise serializers.ValidationError({
                    'professor_id': 'Professor must have a professor_id'
                })
            if student_id:
                raise serializers.ValidationError({
                    'student_id': 'Professor cannot have a student_id'
                })
        
        elif role == 'admin':
            if student_id or professor_id:
                raise serializers.ValidationError({
                    'role': 'Admin cannot have student_id or professor_id'
                })

        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(write_only=True, required=True, allow_blank=False)

    def validate_username(self, value):
        
        if not value or not value.strip():
            raise serializers.ValidationError("Username cannot be empty")
        return value.strip()

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

        data["user"] = user
        return data
