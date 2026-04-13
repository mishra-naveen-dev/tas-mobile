from rest_framework import serializers
from .models import State, District, Branch, Center, Area, Role, User
from django.contrib.auth.hashers import make_password


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


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'phone',
            'employee_id',
            'first_name',
            'last_name',
            'role',
            'state',
            'district',
            'branch',
            'center',
            'area',
            'designation',
            'department',
            'password'
        ]
        extra_kwargs = {
            'state': {'required': False, 'allow_null': True},
            'district': {'required': False, 'allow_null': True},
            'branch': {'required': False, 'allow_null': True},
            'center': {'required': False, 'allow_null': True},
            'area': {'required': False, 'allow_null': True},
            'designation': {'required': False, 'allow_null': True},
            'department': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        password = validated_data.pop('password', 'Temp@123')

        user = User.objects.create(
            **validated_data,
            password=make_password(password),
            force_password_change=True,
            is_active=True
        )

        return user


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
