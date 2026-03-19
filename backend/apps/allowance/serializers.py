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
    employee_details = UserListSerializer(source='employee', read_only=True)
    approved_by_details = UserListSerializer(
        source='approved_by', read_only=True)
    documents = AllowanceDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = AllowanceRequest
        fields = [
            'id', 'employee', 'employee_details',
            'travel_date', 'from_location', 'to_location',
            'total_distance', 'reason', 'status', 'loan_id',
            'fixed_allowance', 'distance_allowance',
            'misc_amount', 'total_amount',
            'submitted_at', 'approved_by', 'approved_by_details',
            'approved_at', 'rejection_reason',
            'documents', 'created_at', 'updated_at'
        ]

        # 🔥 IMPORTANT FIX
        read_only_fields = [
            'employee',
            'fixed_allowance',
            'distance_allowance',
            'total_amount',
            'status',
            'approved_at',
            'submitted_at',
            'created_at',
            'updated_at'
        ]
