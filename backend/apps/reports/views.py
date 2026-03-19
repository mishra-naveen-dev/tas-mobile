from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Report, ReportJob
from .serializers import ReportSerializer, ReportJobSerializer


class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['report_type', 'is_public']
    search_fields = ['name', 'description']

    def get_queryset(self):
        return Report.objects.all()


class ReportJobViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportJobSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['report', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return ReportJob.objects.all()
