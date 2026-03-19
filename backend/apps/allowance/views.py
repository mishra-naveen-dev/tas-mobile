from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AllowanceConfig

from .models import AllowanceRequest
from .serializers import AllowanceRequestSerializer
from common.constants.app_constants import ALLOWANCE_RATES


class AllowanceRequestViewSet(viewsets.ModelViewSet):
    serializer_class = AllowanceRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Employee → only own requests
        if user.role.name == 'EMPLOYEE':
            return AllowanceRequest.objects.filter(employee=user)

        # Admin → all
        return AllowanceRequest.objects.all()

    # 🔥 FIXED FUNCTION (PROPER INDENTATION)

    def perform_create(self, serializer):
        distance = serializer.validated_data.get('total_distance', 0)

        # 🔥 GET ADMIN RATE
        config = AllowanceConfig.objects.last()

        per_km = config.per_km if config else 10  # fallback

        distance_allowance = distance * per_km
        total_amount = distance_allowance  # only per km (no fixed)

        serializer.save(
            employee=self.request.user,
            distance_allowance=distance_allowance,
            total_amount=total_amount,
            status='PENDING'
        )

    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        queryset = AllowanceRequest.objects.filter(status='PENDING')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'APPROVED'
        obj.save()
        return Response({'message': 'Approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'REJECTED'
        obj.rejection_reason = request.data.get('reason', '')
        obj.save()
        return Response({'message': 'Rejected'})
