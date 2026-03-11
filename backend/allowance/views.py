from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView
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
        total_distance = get_today_distance(request.user)

        # Prevent request if no travel
        if total_distance <= 0:
            return Response(
                {
                    "error": "INSUFFICIENT_DISTANCE",
                    "message": "Allowance cannot be created because no travel distance was recorded today.",
                    "hints": [
                        "Ensure you have punched in at least two different locations today",
                        "Check today's distance using /api/attendance/today-distance/",
                    ],
                    "today_distance_km": float(total_distance),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AllowanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        allowance = serializer.save(
            user=request.user,
            request_date=today,
            total_distance=total_distance,
        )

        return Response(
            AllowanceRequestSerializer(allowance).data,
            status=status.HTTP_201_CREATED,
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
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only pending requests can be modified
        if allowance.status != "PENDING":
            return Response(
                {"detail": "Only pending requests can be modified"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = request.data.get("action")

        if action not in ["APPROVE", "REJECT"]:
            return Response(
                {"detail": "Invalid action. Use APPROVE or REJECT"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowance.status = "APPROVED" if action == "APPROVE" else "REJECTED"
        allowance.approved_by = request.user
        allowance.approved_at = timezone.now()
        allowance.save()

        return Response(
            {
                "id": allowance.id,
                "status": allowance.status,
                "approved_by": request.user.employee_id,
                "approved_at": allowance.approved_at,
            }
        )


class EmployeeAllowanceHistoryAPIView(ListAPIView):
    """
    Employee can see their own allowance history.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AllowanceRequestSerializer

    def get_queryset(self):
        return AllowanceRequest.objects.filter(
            user=self.request.user
        ).order_by("-created_at")


class AdminAllowanceListAPIView(ListAPIView):

    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    serializer_class = AllowanceRequestSerializer

    def get_queryset(self):
        return AllowanceRequest.objects.all().order_by("-created_at")


class AllowanceDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):

        total_requests = AllowanceRequest.objects.count()

        pending = AllowanceRequest.objects.filter(status="PENDING").count()
        approved = AllowanceRequest.objects.filter(status="APPROVED").count()
        rejected = AllowanceRequest.objects.filter(status="REJECTED").count()

        total_distance = (
            AllowanceRequest.objects.aggregate(
                total=Sum("total_distance")
            )["total"] or 0
        )

        return Response({
            "total_requests": total_requests,
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "total_distance_km": total_distance
        })
