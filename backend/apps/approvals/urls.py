from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApprovalWorkflowViewSet

app_name = 'approvals'

router = DefaultRouter()
router.register(r'workflows', ApprovalWorkflowViewSet,
                basename='approval-workflow')

urlpatterns = [
    path('', include(router.urls)),
]
