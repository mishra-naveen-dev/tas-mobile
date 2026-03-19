from django.contrib import admin
from .models import LoanAccount, LoanVisit


@admin.register(LoanAccount)
class LoanAccountAdmin(admin.ModelAdmin):
    list_display = ('loan_id', 'customer_name', 'loan_amount',
                    'status', 'responsibility_officer')
    list_filter = ('status', 'created_at')
    search_fields = ('loan_id', 'customer_name', 'customer_phone')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(LoanVisit)
class LoanVisitAdmin(admin.ModelAdmin):
    list_display = ('loan_account', 'visited_by', 'visit_date',
                    'visit_type', 'distance_traveled')
    list_filter = ('visit_type', 'visit_date', 'follow_up_required')
    search_fields = ('loan_account__loan_id', 'visited_by__employee_id')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'visit_date'
