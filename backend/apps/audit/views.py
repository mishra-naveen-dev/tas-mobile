from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['user', 'action', 'table_name', 'created_at']
    search_fields = ['table_name', 'record_id']
    ordering = ['-created_at']

    def get_queryset(self):
        # Only admins can view full audit logs
        if self.request.user.role.name in ['SUPER_ADMIN', 'ADMIN']:
            return AuditLog.objects.all()
        # Others can only see their own actions
        return AuditLog.objects.filter(user=self.request.user)
