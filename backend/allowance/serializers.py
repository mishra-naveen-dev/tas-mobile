from rest_framework import serializers
from .models import AllowanceRequest


class AllowanceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowanceRequest
        fields = [
            "id",
            "request_date",
            "total_distance",
            "reason",
            "loan_id",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "request_date",    
            "total_distance",
            "status",
            "created_at",
        ]