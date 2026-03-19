from django.db import models


class Report(models.Model):
    """Report definitions"""
    REPORT_TYPE = [
        ('DAILY_ATTENDANCE', 'Daily Attendance'),
        ('MONTHLY_ALLOWANCE', 'Monthly Allowance'),
        ('TRAVEL_SUMMARY', 'Travel Summary'),
        ('CRM_VISIT_LOG', 'CRM Visit Log'),
        ('EMPLOYEE_TRACKING', 'Employee Tracking'),
    ]

    report_type = models.CharField(max_length=50, choices=REPORT_TYPE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    filters = models.TextField(blank=True, help_text="JSON filters")
    is_public = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ReportJob(models.Model):
    """Scheduled/generated reports"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    report = models.ForeignKey(
        Report, on_delete=models.CASCADE, related_name='jobs')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING')
    file_path = models.FileField(upload_to='reports/', blank=True, null=True)
    error_message = models.TextField(blank=True)

    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.report.name} - {self.status}"
