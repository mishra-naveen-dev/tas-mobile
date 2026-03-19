from rest_framework import serializers
from .models import LoanAccount, LoanVisit
from apps.organization.serializers import UserListSerializer


class LoanAccountSerializer(serializers.ModelSerializer):
    responsibility_officer_details = UserListSerializer(
        source='responsibility_officer', read_only=True)

    class Meta:
        model = LoanAccount
        fields = ['id', 'loan_id', 'customer_name', 'customer_phone', 'customer_location',
                  'responsibility_officer', 'responsibility_officer_details', 'loan_amount',
                  'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class LoanVisitSerializer(serializers.ModelSerializer):
    loan_details = LoanAccountSerializer(source='loan_account', read_only=True)
    visited_by_details = UserListSerializer(
        source='visited_by', read_only=True)
    loan_id = serializers.CharField(
        write_only=True, required=False)  # For creating by loan_id

    class Meta:
        model = LoanVisit
        fields = [
            'id',
            'loan_account',
            'loan_id',  # Write-only field for frontend to send loan_id
            'loan_details',
            'visited_by',
            'visited_by_details',
            'visit_date',
            'visit_time',
            'visit_datetime',
            'visit_type',
            'transaction_type',
            'amount',
            'latitude',
            'longitude',
            'location',
            'accuracy',
            'distance_traveled',
            'purpose',
            'observations',
            'description',
            'outcome',
            'follow_up_required',
            'follow_up_date',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'visit_datetime',
                            'visited_by', 'loan_details', 'visited_by_details']

    def create(self, validated_data):
        """Handle loan_id to loan_account conversion"""
        loan_id = validated_data.pop('loan_id', None)

        # If loan_id provided, fetch or create the LoanAccount
        if loan_id and not validated_data.get('loan_account'):
            loan_account, _ = LoanAccount.objects.get_or_create(
                loan_id=loan_id,
                defaults={
                    'customer_name': validated_data.get('loan_account.customer_name', 'Unknown'),
                }
            )
            validated_data['loan_account'] = loan_account

        return super().create(validated_data)
