from django.contrib import admin
from .models import State, District, Branch, Center, Area, Role, User, LoginLog


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
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'employee_id', 'email', 'role', 'is_active')
    search_fields = ('username', 'employee_id', 'email')
    list_filter = ('role', 'is_active')

    fieldsets = (
        ('Basic Info', {
            'fields': ('username', 'password', 'email', 'phone', 'employee_id')
        }),
        ('Role & Status', {
            'fields': ('role', 'is_active', 'is_verified', 'force_password_change')
        }),
        ('Hierarchy', {
            'fields': ('state', 'district', 'branch', 'center', 'area')
        }),
        ('Profile', {
            'fields': ('designation', 'department', 'profile_picture')
        }),
    )


@admin.register(LoginLog)
class LoginLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'login_time', 'ip_address')
    search_fields = ('user__username', 'ip_address')
