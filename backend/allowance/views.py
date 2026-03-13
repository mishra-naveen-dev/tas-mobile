from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView

from django.utils import timezone

from .models import AllowanceRequest
from .serializers import AllowanceRequestSerializer

from attendance.services import get_today_distance
from accounts.permissions import IsAdminOrSuperAdmin


class AllowanceCreateAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        today = timezone.localdate()

        existing = AllowanceRequest.objects.filter(
            user=request.user,
            request_date=today
        ).exists()

        if existing:

            return Response(
                {"detail": "Allowance already created for today"},
                status=status.HTTP_400_BAD_REQUEST
            )

        total_distance = get_today_distance(request.user)

        if total_distance <= 0:

            return Response(
                {"detail": "No travel distance recorded today"},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AllowanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        allowance = serializer.save(
            user=request.user,
            request_date=today,
            total_distance=total_distance
        )

        return Response(
            AllowanceRequestSerializer(allowance).data,
            status=status.HTTP_201_CREATED
        )


class PendingAllowanceListAPIView(ListAPIView):

    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    serializer_class = AllowanceRequestSerializer

    def get_queryset(self):

        return AllowanceRequest.objects.filter(status="PENDING")


class AllowanceApprovalAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, pk):

        try:
            allowance = AllowanceRequest.objects.get(pk=pk)

        except AllowanceRequest.DoesNotExist:

            return Response(
                {"detail": "Allowance not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        action = request.data.get("action", "").upper()

        if action not in ["APPROVE", "REJECT"]:

            return Response(
                {"detail": "Invalid action"},
                status=status.HTTP_400_BAD_REQUEST
            )

        allowance.status = "APPROVED" if action == "APPROVE" else "REJECTED"
        allowance.approved_by = request.user
        allowance.approved_at = timezone.now()

        allowance.save()

        return Response({
            "id": allowance.id,
            "status": allowance.status
        })
