from rest_framework import serializers
from .models import AttendancePunch, TravelSession, TravelRoute, PunchCorrectionRequest
from apps.organization.serializers import UserListSerializer


class AttendancePunchSerializer(serializers.ModelSerializer):
    employee_details = UserListSerializer(source='employee', read_only=True)
    location = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AttendancePunch
        fields = [
            'id',
            'employee',
            'employee_details',
            'latitude',
            'longitude',
            'accuracy',
            'location',
            'punch_date',
            'punched_at',
            'punch_type',
            'distance_from_last',
            'notes',
            'device_info',
            'is_valid',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'created_at',
            'updated_at',
            'punch_date',
            'punched_at',
            'employee',
            'distance_from_last'
        ]

    def get_location(self, obj):
        """Generate human-readable location from coordinates"""
        if obj.latitude and obj.longitude:
            return f"Lat: {obj.latitude:.6f}, Lng: {obj.longitude:.6f}"
        return None


class TravelRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelRoute
        fields = ['id', 'travel_session', 'from_latitude', 'from_longitude', 'to_latitude',
                  'to_longitude', 'distance_km', 'travel_time_minutes', 'purpose', 'created_at']
        read_only_fields = ['created_at']


class TravelSessionSerializer(serializers.ModelSerializer):
    routes = TravelRouteSerializer(many=True, read_only=True)
    employee_details = UserListSerializer(source='employee', read_only=True)

    class Meta:
        model = TravelSession
        fields = ['id', 'employee', 'employee_details', 'session_date', 'start_time', 'end_time',
                  'total_distance', 'stop_count', 'is_completed', 'routes', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'session_date']


class PunchCorrectionRequestSerializer(serializers.ModelSerializer):
    employee_details = UserListSerializer(source='employee', read_only=True)
    reviewed_by_details = UserListSerializer(
        source='reviewed_by', read_only=True)
    existing_punch_details = AttendancePunchSerializer(
        source='existing_punch', read_only=True)
    requested_datetime = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PunchCorrectionRequest
        fields = [
            'id',
            'employee',
            'employee_details',
            'correction_type',
            'existing_punch',
            'existing_punch_details',
            'requested_date',
            'requested_time',
            'requested_datetime',
            'requested_latitude',
            'requested_longitude',
            'requested_punch_type',
            'reason',
            'status',
            'reviewed_by',
            'reviewed_by_details',
            'review_notes',
            'reviewed_at',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id',
            'employee',
            'status',
            'reviewed_by',
            'reviewed_by_details',
            'review_notes',
            'reviewed_at',
            'created_at',
            'updated_at'
        ]

    def get_requested_datetime(self, obj):
        """Combine requested_date and requested_time into a datetime string"""
        if obj.requested_date and obj.requested_time:
            from datetime import datetime
            dt = datetime.combine(obj.requested_date, obj.requested_time)
            return dt.isoformat()
        return None

    def validate(self, data):
        """Custom validation for correction requests"""
        correction_type = data.get('correction_type')
        existing_punch = data.get('existing_punch')

        # For EDIT_PUNCH and DELETE_PUNCH, existing_punch is required
        if correction_type in ['EDIT_PUNCH', 'DELETE_PUNCH'] and not existing_punch:
            raise serializers.ValidationError(
                f"existing_punch is required for {correction_type} corrections"
            )

        # For ADD_PUNCH, existing_punch should not be provided
        if correction_type == 'ADD_PUNCH' and existing_punch:
            raise serializers.ValidationError(
                "existing_punch should not be provided for ADD_PUNCH corrections"
            )

        return data
