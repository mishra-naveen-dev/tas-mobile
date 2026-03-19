from rest_framework import serializers
from .models import State, District, Branch, Center, Area, Role, User


class StateSerializer(serializers.ModelSerializer):
    class Meta:
        model = State
        fields = ['id', 'code', 'name',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class DistrictSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source='state.name', read_only=True)

    class Meta:
        model = District
        fields = ['id', 'state', 'state_name', 'code',
                  'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BranchSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(
        source='district.name', read_only=True)
    state_name = serializers.CharField(
        source='district.state.name', read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'district', 'district_name', 'state_name', 'code', 'name', 'location',
                  'latitude', 'longitude', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CenterSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    district_name = serializers.CharField(
        source='branch.district.name', read_only=True)

    class Meta:
        model = Center
        fields = ['id', 'branch', 'branch_name', 'district_name', 'code', 'name', 'location',
                  'latitude', 'longitude', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class AreaSerializer(serializers.ModelSerializer):
    center_name = serializers.CharField(source='center.name', read_only=True)

    class Meta:
        model = Area
        fields = ['id', 'center', 'center_name', 'code',
                  'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class RoleSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(
        source='get_name_display', read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'role_display',
                  'permissions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserListSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(
        source='role.name', read_only=True)
    area_name = serializers.CharField(source='area.name', read_only=True)
    center_name = serializers.CharField(source='center.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'employee_id', 'first_name', 'last_name', 'phone',
                  'role', 'role_name', 'area', 'area_name', 'center', 'center_name',
                  'is_active', 'is_verified', 'created_at']
        read_only_fields = ['created_at']


class UserDetailSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(
        source='role.name', read_only=True)
    area_name = serializers.CharField(source='area.name', read_only=True)
    center_name = serializers.CharField(source='center.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    district_name = serializers.CharField(
        source='district.name', read_only=True)
    state_name = serializers.CharField(source='state.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'employee_id', 'first_name', 'last_name', 'phone',
                  'role', 'role_name', 'state', 'state_name', 'district', 'district_name',
                  'branch', 'branch_name', 'center', 'center_name', 'area', 'area_name',
                  'designation', 'department', 'profile_picture', 'is_active', 'is_verified',
                  'force_password_change', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'password': {'write_only': True}
        }
