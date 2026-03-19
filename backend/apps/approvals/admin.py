from django.contrib import admin
from .models import ApprovalWorkflow


@admin.register(ApprovalWorkflow)
class ApprovalWorkflowAdmin(admin.ModelAdmin):
    list_display = ('workflow_type', 'name', 'approval_levels', 'is_active')
    list_filter = ('workflow_type', 'is_active')
