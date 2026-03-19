from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AttendancePunch(models.Model):
    """GPS-based attendance punch record"""
    employee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='attendance_punches')
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy = models.FloatField(
        null=True, blank=True, help_text="GPS accuracy in meters")
    punch_date = models.DateField(auto_now_add=True)
    punched_at = models.DateTimeField(auto_now_add=True)
    punch_type = models.CharField(
        max_length=20,
        choices=[('PUNCH_IN', 'Punch In'), ('PUNCH_OUT', 'Punch Out')],
        default='PUNCH_IN'
    )
    distance_from_last = models.FloatField(
        null=True, blank=True, help_text="Distance in km from last punch")
    notes = models.TextField(blank=True)
    device_info = models.CharField(max_length=255, blank=True)
    is_valid = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-punched_at']
        indexes = [
            models.Index(fields=['employee', 'punch_date']),
            models.Index(fields=['punch_date']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.punch_date} ({self.punch_type})"


class TravelSession(models.Model):
    """Travel session tracking"""
    employee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='travel_sessions')
    session_date = models.DateField(auto_now_add=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    total_distance = models.FloatField(
        default=0, help_text="Total distance in km")
    stop_count = models.IntegerField(
        default=0, help_text="Number of locations visited")
    is_completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-session_date']

    def __str__(self):
        return f"{self.employee.employee_id} - {self.session_date}"


class TravelRoute(models.Model):
    """Detailed travel route record"""
    travel_session = models.ForeignKey(
        TravelSession, on_delete=models.CASCADE, related_name='routes')
    from_latitude = models.FloatField()
    from_longitude = models.FloatField()
    to_latitude = models.FloatField()
    to_longitude = models.FloatField()
    distance_km = models.FloatField()
    travel_time_minutes = models.IntegerField()
    purpose = models.CharField(max_length=250, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.travel_session.employee.employee_id} - {self.distance_km}km"


class PunchCorrectionRequest(models.Model):
    """Request for correcting missed or incorrect punch records"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    CORRECTION_TYPE_CHOICES = [
        ('ADD_PUNCH', 'Add Missing Punch'),
        ('EDIT_PUNCH', 'Edit Existing Punch'),
        ('DELETE_PUNCH', 'Delete Incorrect Punch'),
    ]

    employee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='punch_correction_requests')
    correction_type = models.CharField(
        max_length=20, choices=CORRECTION_TYPE_CHOICES, default='ADD_PUNCH')

    # For ADD_PUNCH: new punch details
    # For EDIT_PUNCH: existing punch to modify
    # For DELETE_PUNCH: existing punch to remove
    existing_punch = models.ForeignKey(
        AttendancePunch, on_delete=models.CASCADE,
        null=True, blank=True, related_name='correction_requests')

    # Requested punch details
    requested_date = models.DateField()
    requested_time = models.TimeField()
    requested_latitude = models.FloatField(null=True, blank=True)
    requested_longitude = models.FloatField(null=True, blank=True)
    requested_punch_type = models.CharField(
        max_length=20,
        choices=[('PUNCH_IN', 'Punch In'), ('PUNCH_OUT', 'Punch Out')],
        default='PUNCH_IN'
    )

    reason = models.TextField(help_text="Reason for the correction request")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Approval details
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_correction_requests')
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.correction_type} ({self.status})"

    def approve(self, reviewer, notes=''):
        """Approve the correction request and apply the changes"""
        from django.utils import timezone

        self.status = 'APPROVED'
        self.reviewed_by = reviewer
        self.review_notes = notes
        self.reviewed_at = timezone.now()
        self.save()

        # Apply the correction based on type
        if self.correction_type == 'ADD_PUNCH':
            # Create new punch record
            AttendancePunch.objects.create(
                employee=self.employee,
                latitude=self.requested_latitude or 0,
                longitude=self.requested_longitude or 0,
                punch_date=self.requested_date,
                punched_at=timezone.datetime.combine(
                    self.requested_date, self.requested_time),
                punch_type=self.requested_punch_type,
                notes=f"Added via correction request #{self.id}",
                is_valid=True
            )
        elif self.correction_type == 'EDIT_PUNCH' and self.existing_punch:
            # Update existing punch
            self.existing_punch.punch_date = self.requested_date
            self.existing_punch.punched_at = timezone.datetime.combine(
                self.requested_date, self.requested_time)
            self.existing_punch.latitude = self.requested_latitude or self.existing_punch.latitude
            self.existing_punch.longitude = self.requested_longitude or self.existing_punch.longitude
            self.existing_punch.punch_type = self.requested_punch_type
            self.existing_punch.save()
        elif self.correction_type == 'DELETE_PUNCH' and self.existing_punch:
            # Mark punch as invalid (soft delete)
            self.existing_punch.is_valid = False
            self.existing_punch.notes += f" Marked invalid via correction request #{self.id}"
            self.existing_punch.save()

    def reject(self, reviewer, notes=''):
        """Reject the correction request"""
        from django.utils import timezone

        self.status = 'REJECTED'
        self.reviewed_by = reviewer
        self.review_notes = notes
        self.reviewed_at = timezone.now()
        self.save()
