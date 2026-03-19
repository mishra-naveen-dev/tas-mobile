from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_details', 'action', 'table_name', 'record_id',
                  'old_values', 'new_values', 'ip_address', 'user_agent', 'created_at']
        read_only_fields = ['created_at']

    def get_user_details(self, obj):
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'email': obj.user.email,
                'employee_id': obj.user.employee_id
            }
        return None
