from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import datetime

# Role Choices
ROLE_CHOICES = [
    ('SUPER_ADMIN', 'Super Admin'),
    ('ADMIN', 'Admin'),
    ('EMPLOYEE', 'Employee'),
    ('GUEST', 'Guest'),
]

STATUS_CHOICES = [
    ('ACTIVE', 'Active'),
    ('INACTIVE', 'Inactive'),
    ('PENDING', 'Pending'),
    ('APPROVED', 'Approved'),
    ('REJECTED', 'Rejected'),
]

PUNCH_TYPE_CHOICES = [
    ('CHECK_IN', 'Check In'),
    ('CHECK_OUT', 'Check Out'),
]


class Role(models.Model):
    """Role model for role-based access control"""
    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True)
    description = models.TextField(blank=True, null=True)
    permissions = models.TextField(help_text="JSON string of permissions", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_name_display()

    class Meta:
        ordering = ['name']


class Client(models.Model):
    """Client model for managing clients"""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']


class Facility(models.Model):
    """Facility model for managing facilities/workplaces"""
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='facilities')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.client.name}"

    class Meta:
        ordering = ['-created_at']
        unique_together = ('client', 'name')


class Employee(models.Model):
    """Employee model extending User model"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    facility = models.ForeignKey(Facility, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    employee_id = models.CharField(max_length=50, unique=True)
    designation = models.CharField(max_length=100)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    date_of_joining = models.DateField()
    date_of_birth = models.DateField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='employee_profiles/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} - {self.designation}"

    class Meta:
        ordering = ['user__first_name', 'user__last_name']


class UserRole(models.Model):
    """User and Role mapping with permission enforcement"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_role')
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, 
                                    related_name='assigned_roles')

    def __str__(self):
        return f"{self.user.username} - {self.role.get_name_display()}"

    class Meta:
        unique_together = ('user', 'role')


class Task(models.Model):
    """Task model for assigning daily tasks to employees"""
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ]
    
    TASK_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ASSIGNED', 'Assigned'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    assigned_to = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='assigned_tasks')
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    facility = models.ForeignKey(Facility, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='PENDING')
    start_date = models.DateField()
    end_date = models.DateField()
    estimated_hours = models.FloatField(validators=[MinValueValidator(0.5)])
    completion_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.assigned_to.user.get_full_name()}"

    class Meta:
        ordering = ['-priority', 'start_date']


class PunchRecord(models.Model):
    """Daily punch records for employees (check-in/check-out)"""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='punch_records')
    punch_date = models.DateField()
    punch_type = models.CharField(max_length=20, choices=PUNCH_TYPE_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    location = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    distance_from_office_m = models.FloatField(blank=True, null=True, help_text="Distance in meters")
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.employee.employee_id} - {self.punch_date} - {self.punch_type}"

    class Meta:
        ordering = ['-punch_date', '-timestamp']
        unique_together = ('employee', 'punch_date', 'punch_type')


class DailyPunchSummary(models.Model):
    """Daily summary of punch records with calculated distance"""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='daily_summaries')
    punch_date = models.DateField()
    check_in_time = models.DateTimeField(blank=True, null=True)
    check_out_time = models.DateTimeField(blank=True, null=True)
    total_hours = models.FloatField(default=0)
    total_distance_km = models.FloatField(default=0)
    work_status = models.CharField(max_length=50, default='NO_PUNCH')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.employee_id} - {self.punch_date}"

    class Meta:
        ordering = ['-punch_date']
        unique_together = ('employee', 'punch_date')


class DistanceRecord(models.Model):
    """Track distances traveled between facilities"""
    source_facility = models.ForeignKey(Facility, on_delete=models.SET_NULL, null=True, 
                                       blank=True, related_name='distance_from')
    destination_facility = models.ForeignKey(Facility, on_delete=models.SET_NULL, null=True, 
                                            blank=True, related_name='distance_to')
    distance_km = models.FloatField(validators=[MinValueValidator(0)])
    estimated_time_minutes = models.IntegerField(blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.source_facility and self.destination_facility:
            return f"{self.source_facility.name} to {self.destination_facility.name} - {self.distance_km} km"
        return f"Distance: {self.distance_km} km"

    class Meta:
        ordering = ['source_facility', 'destination_facility']
        unique_together = ('source_facility', 'destination_facility')


class AllowanceRequest(models.Model):
    """Allowance request/submission by employees"""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='allowance_requests')
    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.IntegerField()
    travel_days = models.IntegerField(default=0)
    total_distance_km = models.FloatField(default=0)
    daily_allowance_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    distance_allowance_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    miscellaneous_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    submitted_date = models.DateTimeField(auto_now_add=True)
    approved_date = models.DateTimeField(blank=True, null=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='approved_allowances')
    approval_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.employee_id} - {self.month}/{self.year}"

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ('employee', 'month', 'year')


class DailyWorkUpdate(models.Model):
    """Daily work updates/logs by employees"""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='work_updates')
    update_date = models.DateField()
    work_summary = models.TextField()
    tasks_completed = models.TextField(blank=True, help_text="List of tasks completed")
    challenges = models.TextField(blank=True)
    next_day_plan = models.TextField(blank=True)
    distance_traveled_km = models.FloatField(blank=True, null=True)
    facilities_visited = models.TextField(blank=True, help_text="Comma-separated facility names")
    submitted_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    submitted_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.employee_id} - {self.update_date}"

    class Meta:
        ordering = ['-update_date']
        unique_together = ('employee', 'update_date')


class Allowance(models.Model):
    """Historical allowance records (legacy support)"""
    officer_name = models.CharField(max_length=100)
    travel_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    purpose = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.officer_name} - {self.travel_date}"

    class Meta:
        ordering = ['-travel_date']
