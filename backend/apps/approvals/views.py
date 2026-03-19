from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import ApprovalWorkflow
from .serializers import ApprovalWorkflowSerializer


class ApprovalWorkflowViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ApprovalWorkflowSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['workflow_type', 'is_active']
    search_fields = ['name']

    def get_queryset(self):
        return ApprovalWorkflow.objects.filter(is_active=True)
