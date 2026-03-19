from rest_framework import serializers
from .models import AllowanceRequest, AllowanceApproval, AllowanceDocument
from apps.organization.serializers import UserListSerializer


class AllowanceDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowanceDocument
        fields = ['id', 'allowance_request',
                  'document_type', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class AllowanceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowanceRequest
        fields = [
            'id',
            'employee',
            'travel_date',
            'from_location',
            'to_location',
            'total_distance',
            'reason',
            'status',
            'created_at',
        ]
        read_only_fields = ['employee', 'status', 'created_at']
