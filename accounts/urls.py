from django.urls import path
from accounts import views

app_name = 'accounts'

urlpatterns = [
    path('admin/login/', views.admin_login, name='admin-login'),
    path('admin/profile/', views.admin_profile, name='admin-profile'),
    path('professors/', views.professor_list, name='professor-list'),
]