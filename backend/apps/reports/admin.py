from django.contrib import admin
from .models import Report, ReportJob


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('report_type', 'name', 'is_public')
    list_filter = ('report_type', 'is_public')


@admin.register(ReportJob)
class ReportJobAdmin(admin.ModelAdmin):
    list_display = ('report', 'status', 'generated_at', 'created_at')
    list_filter = ('status', 'created_at')
    readonly_fields = ('created_at', 'generated_at')
