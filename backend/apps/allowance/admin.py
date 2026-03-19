from django.contrib import admin
from .models import AllowanceRequest, AllowanceApproval, AllowanceDocument
from django.contrib import admin
from .models import AllowanceConfig


admin.site.register(AllowanceConfig)


@admin.register(AllowanceRequest)
class AllowanceRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'travel_date', 'total_distance',
                    'total_amount', 'status', 'created_at')
    list_filter = ('status', 'travel_date', 'created_at')
    search_fields = ('employee__employee_id', 'employee__username')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'travel_date'


@admin.register(AllowanceApproval)
class AllowanceApprovalAdmin(admin.ModelAdmin):
    list_display = ('allowance_request', 'approval_level',
                    'is_approved', 'approved_by', 'approved_at')
    list_filter = ('approval_level', 'is_approved', 'approved_at')
    search_fields = ('allowance_request__employee__employee_id',)
    readonly_fields = ('created_at',)


@admin.register(AllowanceDocument)
class AllowanceDocumentAdmin(admin.ModelAdmin):
    list_display = ('allowance_request', 'document_type', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
