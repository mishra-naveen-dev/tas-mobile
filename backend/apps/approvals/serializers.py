from rest_framework import serializers
from .models import ApprovalWorkflow


class ApprovalWorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalWorkflow
        fields = ['id', 'workflow_type', 'name', 'approval_levels', 'description',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
