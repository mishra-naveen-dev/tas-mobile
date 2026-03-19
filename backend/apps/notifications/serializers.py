from rest_framework import serializers
from .models import Notification
from apps.organization.serializers import UserListSerializer


class NotificationSerializer(serializers.ModelSerializer):
    recipient_details = UserListSerializer(source='recipient', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'recipient_details', 'notification_type', 'title',
                  'message', 'related_object_id', 'is_read', 'read_at', 'created_at']
        read_only_fields = ['created_at', 'read_at']
