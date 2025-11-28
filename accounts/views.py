from rest_framework.generics import CreateAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from django.shortcuts import render


from .models import User
from .serializers import LoginSerializer, UserSerializer


def login_page(request):
    """Render login page template"""
    return render(request, 'accounts/login.html')


def admin_departments(request):
    """Render admin departments page"""
    return render(request, 'admin/departments.html')


def admin_courses(request):
    """Render admin courses page"""
    return render(request, 'admin/courses.html')


class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        try:
            serializer = LoginSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            user = serializer.validated_data["user"]

            refresh = RefreshToken.for_user(user)

            return Response({
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"detail": "There was a problem processing the request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

        except Exception:
            return Response(
                {"detail": "There was a problem retrieving user information"},
                status=status.HTTP_400_BAD_REQUEST
            )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")

            if not refresh_token:
                return Response(
                    {"detail": "Refresh token is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({"detail": "You have successfully logged out"}, status=status.HTTP_200_OK)

        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token"},
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception:
            return Response(
                {"detail": "There was a problem processing the logout request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
