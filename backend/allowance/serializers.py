from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Role, Client, Facility, Employee, UserRole, Task,
    PunchRecord, DailyPunchSummary, DistanceRecord,
    AllowanceRequest, DailyWorkUpdate, Allowance
)


# User Serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined')
        read_only_fields = ('id', 'date_joined')


class UserDetailSerializer(serializers.ModelSerializer):
    user_role = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined', 'user_role', 'employee')
        read_only_fields = ('id', 'date_joined')

    def get_user_role(self, obj):
        try:
            role = obj.user_role
            return RoleSerializer(role.role).data
        except:
            return None

    def get_employee(self, obj):
        try:
            employee = obj.employee
            return EmployeeBasicSerializer(employee).data
        except:
            return None


# Role Serializers
class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ('id', 'name', 'description', 'permissions', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class UserRoleSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    role = RoleSerializer()

    class Meta:
        model = UserRole
        fields = ('id', 'user', 'role', 'assigned_at', 'assigned_by')
        read_only_fields = ('id', 'assigned_at', 'assigned_by')


# Client Serializers
class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ('id', 'name', 'description', 'contact_person', 'email', 'phone', 'address', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class ClientDetailSerializer(serializers.ModelSerializer):
    facilities_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ('id', 'name', 'description', 'contact_person', 'email', 'phone', 'address', 'status', 'facilities_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_facilities_count(self, obj):
        return obj.facilities.count()


# Facility Serializers
class FacilitySerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Facility
        fields = ('id', 'client', 'client_name', 'name', 'description', 'location', 'latitude', 'longitude', 
                 'contact_person', 'phone', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


# Employee Serializers
class EmployeeBasicSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    facility_name = serializers.CharField(source='facility.name', read_only=True)

    class Meta:
        model = Employee
        fields = ('id', 'user', 'user_details', 'employee_id', 'designation', 'department', 
                 'client', 'client_name', 'facility', 'facility_name', 'status')
        read_only_fields = ('id', 'user_details')


class EmployeeSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    facility_name = serializers.CharField(source='facility.name', read_only=True)

    class Meta:
        model = Employee
        fields = ('id', 'user', 'user_details', 'employee_id', 'designation', 'department', 
                 'phone', 'address', 'date_of_joining', 'date_of_birth', 'profile_picture',
                 'client', 'client_name', 'facility', 'facility_name', 'status', 
                 'created_at', 'updated_at')
        read_only_fields = ('id', 'user_details', 'created_at', 'updated_at')


# Task Serializers
class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.user.get_full_name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True)
    facility_name = serializers.CharField(source='facility.name', read_only=True)

    class Meta:
        model = Task
        fields = ('id', 'title', 'description', 'assigned_to', 'assigned_to_name', 'assigned_by', 
                 'assigned_by_name', 'facility', 'facility_name', 'priority', 'status', 
                 'start_date', 'end_date', 'estimated_hours', 'completion_notes', 
                 'created_at', 'updated_at')
        read_only_fields = ('id', 'assigned_to_name', 'assigned_by_name', 'facility_name', 'created_at', 'updated_at')


# Punch Record Serializers
class PunchRecordSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)

    class Meta:
        model = PunchRecord
        fields = ('id', 'employee', 'employee_id', 'employee_name', 'punch_date', 'punch_type', 
                 'timestamp', 'location', 'latitude', 'longitude', 'distance_from_office_m', 
                 'notes')
        read_only_fields = ('id', 'employee_id', 'employee_name', 'timestamp')


# Daily Punch Summary Serializers
class DailyPunchSummarySerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)

    class Meta:
        model = DailyPunchSummary
        fields = ('id', 'employee', 'employee_id', 'employee_name', 'punch_date', 
                 'check_in_time', 'check_out_time', 'total_hours', 'total_distance_km', 
                 'work_status', 'notes', 'created_at', 'updated_at')
        read_only_fields = ('id', 'employee_id', 'employee_name', 'created_at', 'updated_at')


# Distance Record Serializers
class DistanceRecordSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source_facility.name', read_only=True)
    destination_name = serializers.CharField(source='destination_facility.name', read_only=True)

    class Meta:
        model = DistanceRecord
        fields = ('id', 'source_facility', 'source_name', 'destination_facility', 
                 'destination_name', 'distance_km', 'estimated_time_minutes', 'notes', 
                 'created_at', 'updated_at')
        read_only_fields = ('id', 'source_name', 'destination_name', 'created_at', 'updated_at')


# Allowance Request Serializers
class AllowanceRequestSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = AllowanceRequest
        fields = ('id', 'employee', 'employee_id', 'employee_name', 'month', 'year', 
                 'travel_days', 'total_distance_km', 'daily_allowance_amount', 
                 'distance_allowance_amount', 'miscellaneous_amount', 'total_amount', 
                 'status', 'submitted_date', 'approved_date', 'approved_by', 'approved_by_name', 
                 'approval_notes', 'created_at', 'updated_at')
        read_only_fields = ('id', 'employee_id', 'employee_name', 'approved_by_name', 
                           'submitted_date', 'total_amount', 'created_at', 'updated_at')


# Daily Work Update Serializers
class DailyWorkUpdateSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by_user.get_full_name', read_only=True)

    class Meta:
        model = DailyWorkUpdate
        fields = ('id', 'employee', 'employee_id', 'employee_name', 'update_date', 
                 'work_summary', 'tasks_completed', 'challenges', 'next_day_plan', 
                 'distance_traveled_km', 'facilities_visited', 'submitted_by_user', 
                 'submitted_by_name', 'submitted_date', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'employee_id', 'employee_name', 'submitted_by_name', 
                           'submitted_date', 'created_at', 'updated_at')


# Allowance (Legacy) Serializers
class AllowanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance
        fields = ('id', 'officer_name', 'travel_date', 'amount', 'purpose', 'created_at')
        read_only_fields = ('id', 'created_at')
