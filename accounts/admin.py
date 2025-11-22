from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from django.forms import ModelForm


class UserCreationForm(ModelForm):
    class Meta:
        model = User
        fields = ("username", "email", "role", "student_id", "professor_id")


class UserChangeForm(ModelForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User

    list_display = ("username", "email", "role", "is_staff")

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Role Info", {"fields": ("role", "student_id", "professor_id")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "username",
                "email",
                "password1",
                "password2",
                "role",
                "student_id",
                "professor_id",
            ),
        }),
    )
