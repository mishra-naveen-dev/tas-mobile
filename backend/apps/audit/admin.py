from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'table_name', 'record_id', 'created_at')
    list_filter = ('action', 'table_name', 'created_at')
    search_fields = ('user__username', 'table_name', 'record_id')
    readonly_fields = ('created_at', 'user', 'action', 'table_name',
                       'record_id', 'old_values', 'new_values', 'ip_address', 'user_agent')
    date_hierarchy = 'created_at'
