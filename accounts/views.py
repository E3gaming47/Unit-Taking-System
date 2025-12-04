from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.shortcuts import render
from django.db.models import Q

from api.pagination import StandardResultsSetPagination
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, LoginSerializer
from .permissions import IsAdmin
from rest_framework.views import APIView


def login_page(request):
    """Render login page template"""
    return render(request, 'accounts/login.html')


def admin_departments(request):
    """Render admin departments page"""
    return render(request, 'admin/departments.html')


def admin_courses(request):
    """Render admin courses page"""
    return render(request, 'admin/courses.html')


def admin_students(request):
    """Render admin students page"""
    return render(request, 'admin/students.html')


def admin_professors(request):
    """Render admin professors page"""
    return render(request, 'admin/professors.html')


class UserViewSet(viewsets.ModelViewSet):

    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardResultsSetPagination
    
    def get_serializer_class(self):
        
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        
        queryset = User.objects.all()
        role = self.request.query_params.get('role', None)
        
        if role:
            queryset = queryset.filter(role=role)
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(student_id__icontains=search) |
                Q(professor_id__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        return queryset.order_by('-id')

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdmin])
    def students(self, request):
        students = User.objects.filter(role='student')
        serializer = self.get_serializer(students, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdmin])
    def professors(self, request):
        professors = User.objects.filter(role='professor')
        serializer = self.get_serializer(professors, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):

        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class AuthViewSet(viewsets.ViewSet):

    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
       
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response({
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token)
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "You have successfully logged out"}, 
                status=status.HTTP_200_OK
            )
        except TokenError as e:
            return Response(
                {"detail": f"Invalid or expired refresh token: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def refresh(self, request):

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)
            return Response({
                "access": str(refresh.access_token)
            }, status=status.HTTP_200_OK)
        except TokenError as e:
            return Response(
                {"detail": f"Invalid or expired refresh token: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
class DepartmentsList(APIView):

    @swagger_auto_schema(
        operation_description="دریافت لیست دانشکده‌ها",
        responses={200: "لیست دانشکده‌ها با موفقیت برگشت داده شد"}
    )
    def get(self, request):
        data = [
            {"id": 1, "name": "مهندسی"},
            {"id": 2, "name": "علوم پایه"},
        ]
        return Response(data)
    
    
class LoginView(APIView):

    @swagger_auto_schema(
        operation_description="ورود کاربر با شماره دانشجویی و رمز عبور",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "username": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
            },
            required=["username", "password"]
        ),
        responses={200: "ورود موفق", 401: "رمز یا نام کاربری اشتباه است"}
    )
    def post(self, request):
        return Response({"msg": "ok"}, status=200)  
    
class CoursesList(APIView):

    @swagger_auto_schema(
        operation_description="دریافت لیست تمام درس‌ها",
        responses={200: "لیست درس‌ها برگشت داده شد"}
    )
    def get(self, request):
        data = [
            {"id": 1, "title": "ریاضی ۱", "unit": 3},
            {"id": 2, "title": "برنامه‌سازی", "unit": 3},
        ]
        return Response(data)

class RegisterView(APIView):

    @swagger_auto_schema(
        operation_description="ثبت‌نام دانشجو",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "username": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
                "full_name": openapi.Schema(type=openapi.TYPE_STRING),
            },
            required=["username", "password"]
        ),
        responses={201: "ثبت‌نام موفق"}
    )
    def post(self, request):
        return Response({"msg": "ثبت‌نام شد"}, status=201)


class SelectCourse(APIView):

    @swagger_auto_schema(
        operation_description="انتخاب واحد درس توسط دانشجو",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "course_id": openapi.Schema(type=openapi.TYPE_INTEGER),
            },
            required=["course_id"]
        ),
        responses={200: "درس با موفقیت انتخاب شد"}
    )
    def post(self, request):
        return Response({"msg": "درس انتخاب شد"})


class RemoveCourse(APIView):

    @swagger_auto_schema(
        operation_description="حذف درس از انتخاب واحد",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "course_id": openapi.Schema(type=openapi.TYPE_INTEGER),
            },
            required=["course_id"]
        ),
        responses={200: "درس حذف شد"}
    )
    def post(self, request):
        return Response({"msg": "درس حذف شد"})


class CourseDetail(APIView):

    @swagger_auto_schema(
        operation_description="جزئیات یک درس",
        responses={200: "جزئیات درس"}
    )
    def get(self, request, id):
        data = {"id": id, "title": "مثال", "unit": 3}
        return Response(data)

