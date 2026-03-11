from django.conf import settings
from django.db import models


class AllowanceRequest(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="allowance_requests"
    )

    request_date = models.DateField()
    total_distance = models.DecimalField(max_digits=8, decimal_places=3)

    reason = models.TextField()
    loan_id = models.CharField(max_length=50, blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "request_date")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.employee_id} - {self.request_date} - {self.status}"
    
approved_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="approved_allowances"
)

approved_at = models.DateTimeField(null=True, blank=True)    