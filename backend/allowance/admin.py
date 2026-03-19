from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Role, Client, Facility, Employee, UserRole, Task,
    PunchRecord, DailyPunchSummary, DistanceRecord,
    AllowanceRequest, DailyWorkUpdate, Allowance
)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_person', 'email', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'contact_person', 'email')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'status')
        }),
        ('Contact Information', {
            'fields': ('contact_person', 'email', 'phone', 'address')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'location', 'status', 'created_at')
    list_filter = ('client', 'status', 'created_at')
    search_fields = ('name', 'location', 'contact_person')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'client', 'description', 'status')
        }),
        ('Location Information', {
            'fields': ('location', 'latitude', 'longitude')
        }),
        ('Contact Information', {
            'fields': ('contact_person', 'phone')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'get_full_name', 'designation', 'client', 'facility', 'status', 'date_of_joining')
    list_filter = ('client', 'facility', 'status', 'date_of_joining')
    search_fields = ('employee_id', 'user__first_name', 'user__last_name', 'designation')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'employee_id')
        }),
        ('Basic Information', {
            'fields': ('designation', 'department', 'date_of_joining', 'date_of_birth', 'status')
        }),
        ('Organization', {
            'fields': ('client', 'facility')
        }),
        ('Contact Information', {
            'fields': ('phone', 'address')
        }),
        ('Profile', {
            'fields': ('profile_picture',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Name'


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'assigned_at', 'assigned_by')
    list_filter = ('role', 'assigned_at')
    search_fields = ('user__username', 'role__name')
    readonly_fields = ('assigned_at',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'assigned_to', 'priority', 'status', 'start_date', 'end_date')
    list_filter = ('priority', 'status', 'start_date', 'facility')
    search_fields = ('title', 'description', 'assigned_to__user__username')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Task Information', {
            'fields': ('title', 'description', 'priority', 'status')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'assigned_by', 'facility')
        }),
        ('Timeline', {
            'fields': ('start_date', 'end_date', 'estimated_hours')
        }),
        ('Completion', {
            'fields': ('completion_notes',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PunchRecord)
class PunchRecordAdmin(admin.ModelAdmin):
    list_display = ('employee', 'punch_date', 'get_punch_type_badge', 'timestamp', 'location', 'distance_from_office_m')
    list_filter = ('punch_type', 'punch_date', 'employee')
    search_fields = ('employee__employee_id', 'location')
    readonly_fields = ('timestamp', 'created_at')
    fieldsets = (
        ('Punch Information', {
            'fields': ('employee', 'punch_date', 'punch_type', 'timestamp')
        }),
        ('Location Information', {
            'fields': ('location', 'latitude', 'longitude', 'distance_from_office_m')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )

    def get_punch_type_badge(self, obj):
        if obj.punch_type == 'CHECK_IN':
            color = 'green'
        else:
            color = 'red'
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color,
            obj.get_punch_type_display()
        )
    get_punch_type_badge.short_description = 'Type'


@admin.register(DailyPunchSummary)
class DailyPunchSummaryAdmin(admin.ModelAdmin):
    list_display = ('employee', 'punch_date', 'total_hours', 'total_distance_km', 'work_status')
    list_filter = ('punch_date', 'work_status', 'employee')
    search_fields = ('employee__employee_id',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Summary Information', {
            'fields': ('employee', 'punch_date', 'work_status')
        }),
        ('Time Information', {
            'fields': ('check_in_time', 'check_out_time', 'total_hours')
        }),
        ('Distance Information', {
            'fields': ('total_distance_km',)
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DistanceRecord)
class DistanceRecordAdmin(admin.ModelAdmin):
    list_display = ('source_facility', 'destination_facility', 'distance_km', 'estimated_time_minutes')
    list_filter = ('source_facility', 'destination_facility')
    search_fields = ('source_facility__name', 'destination_facility__name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AllowanceRequest)
class AllowanceRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'year', 'total_amount', 'status', 'submitted_date')
    list_filter = ('status', 'month', 'year', 'submitted_date')
    search_fields = ('employee__employee_id', 'approved_by__username')
    readonly_fields = ('submitted_date', 'created_at', 'updated_at')
    fieldsets = (
        ('Request Information', {
            'fields': ('employee', 'month', 'year', 'status')
        }),
        ('Allowance Breakdown', {
            'fields': ('travel_days', 'total_distance_km', 'daily_allowance_amount', 'distance_allowance_amount', 'miscellaneous_amount', 'total_amount')
        }),
        ('Approval', {
            'fields': ('approved_by', 'approved_date', 'approval_notes')
        }),
        ('Timestamps', {
            'fields': ('submitted_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DailyWorkUpdate)
class DailyWorkUpdateAdmin(admin.ModelAdmin):
    list_display = ('employee', 'update_date', 'status', 'submitted_date')
    list_filter = ('update_date', 'status', 'submitted_date')
    search_fields = ('employee__employee_id', 'work_summary')
    readonly_fields = ('submitted_date', 'created_at', 'updated_at')
    fieldsets = (
        ('Update Information', {
            'fields': ('employee', 'update_date', 'status')
        }),
        ('Work Information', {
            'fields': ('work_summary', 'tasks_completed', 'challenges', 'next_day_plan')
        }),
        ('Travel Information', {
            'fields': ('distance_traveled_km', 'facilities_visited')
        }),
        ('Submission', {
            'fields': ('submitted_by_user', 'submitted_date')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Allowance)
class AllowanceAdmin(admin.ModelAdmin):
    list_display = ('officer_name', 'travel_date', 'amount', 'purpose')
    list_filter = ('travel_date',)
    search_fields = ('officer_name', 'purpose')
    readonly_fields = ('created_at',)
