from django.contrib import admin
from .models import AttendancePunch, TravelSession, TravelRoute, PunchCorrectionRequest


@admin.register(AttendancePunch)
class AttendancePunchAdmin(admin.ModelAdmin):
    list_display = ('employee', 'punch_date', 'punched_at',
                    'punch_type', 'distance_from_last', 'is_valid')
    list_filter = ('punch_type', 'punch_date', 'is_valid')
    search_fields = ('employee__employee_id', 'employee__username')
    readonly_fields = ('created_at', 'updated_at', 'punched_at', 'punch_date')
    date_hierarchy = 'punch_date'


@admin.register(TravelSession)
class TravelSessionAdmin(admin.ModelAdmin):
    list_display = ('employee', 'session_date',
                    'total_distance', 'stop_count', 'is_completed')
    list_filter = ('session_date', 'is_completed')
    search_fields = ('employee__employee_id', 'employee__username')
    readonly_fields = ('created_at', 'updated_at', 'session_date')


@admin.register(TravelRoute)
class TravelRouteAdmin(admin.ModelAdmin):
    list_display = ('travel_session', 'distance_km', 'travel_time_minutes')
    search_fields = ('travel_session__employee__employee_id',)
    readonly_fields = ('created_at',)


@admin.register(PunchCorrectionRequest)
class PunchCorrectionRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'correction_type', 'requested_date',
                    'status', 'reviewed_by', 'created_at')
    list_filter = ('status', 'correction_type', 'requested_date')
    search_fields = ('employee__employee_id', 'employee__username', 'reason')
    readonly_fields = ('created_at', 'updated_at', 'reviewed_at')
    date_hierarchy = 'created_at'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('employee', 'reviewed_by', 'existing_punch')

    fieldsets = (
        ('Request Details', {
            'fields': ('employee', 'correction_type', 'existing_punch', 'reason')
        }),
        ('Requested Changes', {
            'fields': ('requested_date', 'requested_time', 'requested_latitude',
                       'requested_longitude', 'requested_punch_type')
        }),
        ('Review Status', {
            'fields': ('status', 'reviewed_by', 'review_notes', 'reviewed_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
