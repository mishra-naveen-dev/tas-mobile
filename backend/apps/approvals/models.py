from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class ApprovalWorkflow(models.Model):
    """Approval workflow configuration"""
    WORKFLOW_TYPE = [
        ('ALLOWANCE', 'Allowance Request'),
        ('LEAVE', 'Leave Request'),
        ('EXPENSE', 'Expense Claim'),
    ]

    workflow_type = models.CharField(max_length=50, choices=WORKFLOW_TYPE)
    name = models.CharField(max_length=255)
    approval_levels = models.IntegerField(default=2)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
