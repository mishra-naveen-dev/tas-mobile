from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.accounts.views import CustomTokenView
urlpatterns = [
    path('admin/', admin.site.urls),
    # JWT Authentication endpoints
    path('api/token/', CustomTokenView.as_view(), name='token_obtain_pair'),
    path(
        'api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # API v1 endpoints
    path('api/v1/organization/', include('apps.organization.urls')),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    path('api/v1/allowance/', include('apps.allowance.urls')),
    path('api/v1/approvals/', include('apps.approvals.urls')),
    path('api/v1/loans/', include('apps.loans.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/accounts/', include('apps.accounts.urls')),
]
