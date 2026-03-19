from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Notification(models.Model):
    """System notifications"""
    TYPE_CHOICES = [
        ('ALLOWANCE_APPROVED', 'Allowance Approved'),
        ('ALLOWANCE_REJECTED', 'Allowance Rejected'),
        ('ALLOWANCE_PENDING', 'Allowance Pending Review'),
        ('PUNCH_REMINDER', 'Punch Reminder'),
        ('LOAN_FOLLOW_UP', 'Loan Follow-up'),
        ('SYSTEM', 'System'),
    ]

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_object_id = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.employee_id} - {self.notification_type}"
