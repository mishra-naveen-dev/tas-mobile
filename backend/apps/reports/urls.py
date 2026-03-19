from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, ReportJobViewSet

app_name = 'reports'

router = DefaultRouter()
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'jobs', ReportJobViewSet, basename='report-job')

urlpatterns = [
    path('', include(router.urls)),
]
