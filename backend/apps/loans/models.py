from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class LoanAccount(models.Model):
    """CRM - Loan Account"""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
        ('DEFAULT', 'Default'),
        ('SUSPENDED', 'Suspended'),
    ]

    loan_id = models.CharField(max_length=50, unique=True)
    customer_name = models.CharField(max_length=250)
    customer_phone = models.CharField(max_length=15, blank=True)
    customer_location = models.CharField(max_length=500, blank=True)
    responsibility_officer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True)

    loan_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.loan_id} - {self.customer_name}"


class LoanVisit(models.Model):
    """CRM - Loan Visit Log"""
    VISIT_TYPE_CHOICES = [
        ('COLLECTION', 'Collection'),
        ('FOLLOW_UP', 'Follow Up'),
        ('DISBURSEMENT', 'Disbursement'),
        ('DOCUMENT_COLLECTION', 'Document Collection'),
        ('OTHER', 'Other'),
    ]

    TRANSACTION_TYPE_CHOICES = [
        ('RECOVERY', 'Loan Recovery'),
        ('DISBURSEMENT', 'Loan Disbursement'),
        ('PAYMENT', 'Payment'),
        ('OTHER', 'Other'),
    ]

    loan_account = models.ForeignKey(
        LoanAccount, on_delete=models.CASCADE, related_name='visits')
    visited_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True)
    visit_date = models.DateField()
    visit_time = models.TimeField()
    visit_datetime = models.DateTimeField(
        auto_now_add=True, help_text="Automatic timestamp")
    visit_type = models.CharField(max_length=50, choices=VISIT_TYPE_CHOICES)

    # Transaction details
    transaction_type = models.CharField(
        max_length=50,
        choices=TRANSACTION_TYPE_CHOICES,
        null=True,
        blank=True
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Transaction amount in ₹"
    )

    # Location tracking
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    location = models.CharField(
        max_length=500, blank=True, help_text="Human-readable location")
    accuracy = models.FloatField(
        blank=True,
        null=True,
        help_text="GPS accuracy in meters"
    )
    distance_traveled = models.FloatField(
        blank=True, null=True, help_text="Distance in km")

    purpose = models.TextField()
    observations = models.TextField(blank=True)
    description = models.TextField(
        blank=True, help_text="Additional notes or description")
    outcome = models.CharField(max_length=255, blank=True)

    # Follow-up
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-visit_datetime']
        indexes = [
            models.Index(fields=['visited_by', 'visit_date']),
            models.Index(fields=['visit_datetime']),
        ]

    def __str__(self):
        return f"{self.loan_account.loan_id} - {self.visit_datetime}"
