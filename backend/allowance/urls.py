from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register all viewsets
router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'roles', views.RoleViewSet, basename='role')
router.register(r'clients', views.ClientViewSet, basename='client')
router.register(r'facilities', views.FacilityViewSet, basename='facility')
router.register(r'employees', views.EmployeeViewSet, basename='employee')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'punch-records', views.PunchRecordViewSet, basename='punch-record')
router.register(r'daily-punch-summary', views.DailyPunchSummaryViewSet, basename='daily-punch-summary')
router.register(r'distance-records', views.DistanceRecordViewSet, basename='distance-record')
router.register(r'allowance-requests', views.AllowanceRequestViewSet, basename='allowance-request')
router.register(r'daily-work-updates', views.DailyWorkUpdateViewSet, basename='daily-work-update')
router.register(r'allowance', views.AllowanceViewSet, basename='allowance')
router.register(r'user-roles', views.UserRoleViewSet, basename='user-role')
router.register(r'dashboard', views.DashboardAnalyticsViewSet, basename='dashboard', trailing_slash=False)

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
