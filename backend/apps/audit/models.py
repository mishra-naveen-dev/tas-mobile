from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AuditLog(models.Model):
    """Audit trail for all actions"""
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('PUNCH_IN', 'Punch In'),
        ('PUNCH_OUT', 'Punch Out'),
        ('ALLOWANCE_REQUEST', 'Allowance Request'),
        ('ALLOWANCE_APPROVE', 'Allowance Approve'),
        ('ALLOWANCE_REJECT', 'Allowance Reject'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('OTHER', 'Other'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    table_name = models.CharField(max_length=100)
    record_id = models.CharField(max_length=255)
    old_values = models.TextField(
        blank=True, null=True, help_text="JSON of previous values")
    new_values = models.TextField(
        blank=True, null=True, help_text="JSON of new values")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} on {self.table_name}"
