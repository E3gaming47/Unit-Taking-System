#!/usr/bin/env python
"""
Script to create a test admin user for Unit Taking System
Run this once: python create_admin_user.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User

def create_admin_user():
    username = 'admin'
    password = 'admin123'
    email = 'admin@example.com'
    
    # Check if user already exists
    if User.objects.filter(username=username).exists():
        print(f"User '{username}' already exists!")
        print(f"You can login with:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        return
    
    # Create admin user
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        role='admin'
    )
    
    print("=" * 50)
    print("Admin user created successfully!")
    print("=" * 50)
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"Role: {user.role}")
    print("=" * 50)
    print("\nYou can now login at: http://127.0.0.1:8000/")

if __name__ == '__main__':
    create_admin_user()

