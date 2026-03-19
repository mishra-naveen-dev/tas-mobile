from django.db import models
from django.contrib.auth.models import AbstractUser


# Organization Hierarchy Models
class State(models.Model):
    """State/Region model"""
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=250)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class District(models.Model):
    """District model"""
    state = models.ForeignKey(
        State, on_delete=models.CASCADE, related_name='districts')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=250)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('state', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.state.name}"


class Branch(models.Model):
    """Branch model"""
    district = models.ForeignKey(
        District, on_delete=models.CASCADE, related_name='branches')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=250)
    location = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('district', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.district.name}"


class Center(models.Model):
    """Center model"""
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name='centers')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=250)
    location = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('branch', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.branch.name}"


class Area(models.Model):
    """Area model"""
    center = models.ForeignKey(
        Center, on_delete=models.CASCADE, related_name='areas')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=250)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('center', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.center.name}"


# Role Model
class Role(models.Model):
    """User roles"""
    ROLE_CHOICES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('ADMIN', 'Admin'),
        ('MANAGER', 'Manager'),
        ('EMPLOYEE', 'Employee'),
    ]

    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True)
    permissions = models.TextField(
        blank=True, null=True, help_text="JSON for dynamic permissions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_name_display()


# Custom User Model
class User(AbstractUser):
    """Extended User model"""
    employee_id = models.CharField(
        max_length=50, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=15, blank=True)

    # Hierarchy
    area = models.ForeignKey(Area, on_delete=models.SET_NULL,
                             null=True, blank=True, related_name='employees')
    center = models.ForeignKey(
        Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    district = models.ForeignKey(
        District, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    state = models.ForeignKey(
        State, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')

    # Role
    role = models.ForeignKey(
        Role, on_delete=models.PROTECT, default=4)  # Default to EMPLOYEE

    # Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    force_password_change = models.BooleanField(default=True)  # First login

    # Profile
    profile_picture = models.ImageField(
        upload_to='profiles/', blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.get_full_name()} ({self.employee_id})"
