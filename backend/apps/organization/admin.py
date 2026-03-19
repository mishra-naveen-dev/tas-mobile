from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import State, District, Branch, Center, Area, Role, User


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('code', 'name')


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'state', 'is_active', 'created_at')
    list_filter = ('state', 'is_active', 'created_at')
    search_fields = ('code', 'name')


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'district',
                    'location', 'is_active', 'created_at')
    list_filter = ('district', 'is_active', 'created_at')
    search_fields = ('code', 'name', 'location')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Center)
class CenterAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'branch', 'location',
                    'is_active', 'created_at')
    list_filter = ('branch', 'is_active', 'created_at')
    search_fields = ('code', 'name', 'location')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'center', 'is_active', 'created_at')
    list_filter = ('center', 'is_active', 'created_at')
    search_fields = ('code', 'name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Organization', {'fields': ('employee_id',
         'state', 'district', 'branch', 'center', 'area')}),
        ('Profile', {'fields': ('phone', 'designation',
         'department', 'profile_picture', 'role')}),
        ('Status', {'fields': ('is_verified', 'force_password_change')}),
    )
    list_display = ('username', 'email', 'employee_id',
                    'get_role', 'is_active', 'is_verified')
    list_filter = ('role', 'is_active', 'is_verified', 'created_at')
    search_fields = ('username', 'email', 'employee_id',
                     'first_name', 'last_name')
    readonly_fields = ('created_at', 'updated_at', 'last_login', 'date_joined')

    def get_role(self, obj):
        return obj.role.get_name_display() if obj.role else 'N/A'
    get_role.short_description = 'Role'
