from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AllowanceRequest(models.Model):
    """Travel allowance request"""
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('PAID', 'Paid'),
    ]

    employee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='allowance_requests')
    travel_date = models.DateField()
    from_location = models.CharField(max_length=255)
    to_location = models.CharField(max_length=255)
    total_distance = models.FloatField(help_text="Distance in km")
    reason = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Optional CRM linking
    loan_id = models.CharField(max_length=50, blank=True, null=True)

    # Approval tracking
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_allowances')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-travel_date']
        indexes = [
            models.Index(fields=['employee', 'travel_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.travel_date}"


class AllowanceApproval(models.Model):
    """Approval workflow tracking"""
    allowance_request = models.OneToOneField(
        AllowanceRequest, on_delete=models.CASCADE, related_name='approval')
    approval_level = models.IntegerField(
        choices=[(1, 'Level 1'), (2, 'Level 2'), (3, 'Level 3')])
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True)
    is_approved = models.BooleanField(default=False)
    comments = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.allowance_request.employee.employee_id} - Level {self.approval_level}"


class AllowanceDocument(models.Model):
    """Supporting documents for allowance"""
    allowance_request = models.ForeignKey(
        AllowanceRequest, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(
        max_length=50,
        choices=[('RECEIPT', 'Receipt'),
                 ('INVOICE', 'Invoice'), ('OTHER', 'Other')]
    )
    file = models.FileField(upload_to='allowance_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.allowance_request.employee.employee_id} - {self.document_type}"


class AllowanceConfig(models.Model):
    per_km = models.DecimalField(max_digits=10, decimal_places=2, default=10)

    def __str__(self):
        return f"Per KM Rate: {self.per_km}"
