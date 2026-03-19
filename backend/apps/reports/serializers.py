from rest_framework import serializers
from .models import Report, ReportJob


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'report_type', 'name', 'description', 'filters', 'is_public',
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ReportJobSerializer(serializers.ModelSerializer):
    report_details = ReportSerializer(source='report', read_only=True)

    class Meta:
        model = ReportJob
        fields = ['id', 'report', 'report_details', 'status', 'file_path',
                  'error_message', 'generated_at', 'created_at']
        read_only_fields = ['created_at', 'generated_at']
