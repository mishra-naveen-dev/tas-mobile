from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListAPIView

from django.utils import timezone
from django.db.models import Sum

from .models import PunchIn
from .serializers import PunchInSerializer
from .services import get_today_distance

from common.utils.geo import haversine_distance
from accounts.permissions import IsAdminOrSuperAdmin
from allowance.models import AllowanceRequest


# Minimum distance between punches
MIN_DISTANCE_KM = 0.05   # 50 meters


class PunchInAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = PunchInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        last_punch = (
            PunchIn.objects
            .filter(user=request.user)
            .order_by("-punched_at")
            .first()
        )

        distance = 0

        if last_punch:

            distance = haversine_distance(
                float(last_punch.latitude),
                float(last_punch.longitude),
                float(serializer.validated_data["latitude"]),
                float(serializer.validated_data["longitude"]),
            )

            # Prevent punching at same location
            if distance < MIN_DISTANCE_KM:

                return Response(
                    {
                        "detail": "Punch location too close to previous punch (minimum 50 meters required)"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        punch = PunchIn.objects.create(
            user=request.user,
            latitude=serializer.validated_data["latitude"],
            longitude=serializer.validated_data["longitude"],
            distance_from_last=distance
        )

        return Response(
            PunchInSerializer(punch).data,
            status=status.HTTP_201_CREATED
        )


class TodayDistanceAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        total_distance = get_today_distance(request.user)

        return Response({
            "total_distance_km": round(float(total_distance), 3)
        })


class TodayPunchListAPIView(ListAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = PunchInSerializer

    def get_queryset(self):

        today = timezone.localdate()

        return PunchIn.objects.filter(
            user=self.request.user,
            punched_date=today
        ).order_by("-punched_at")


class MonthlyDistanceAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        today = timezone.localdate()

        punches = PunchIn.objects.filter(
            user=request.user,
            punched_date__month=today.month,
            punched_date__year=today.year
        )

        total = punches.aggregate(
            total=Sum("distance_from_last")
        )["total"] or 0

        return Response({
            "month": today.month,
            "total_distance_km": round(float(total), 3)
        })


class AdminEmployeeTravelAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):

        data = (
            PunchIn.objects
            .values("user__employee_id")
            .annotate(total_distance=Sum("distance_from_last"))
            .order_by("-total_distance")
        )

        return Response(data)


class AdminDashboardAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):

        today = timezone.localdate()

        total_punches = PunchIn.objects.count()

        today_distance = PunchIn.objects.filter(
            punched_date=today
        ).aggregate(total=Sum("distance_from_last"))["total"] or 0

        pending_allowances = AllowanceRequest.objects.filter(
            status="PENDING"
        ).count()

        approved_allowances = AllowanceRequest.objects.filter(
            status="APPROVED"
        ).count()

        return Response({
            "total_punches": total_punches,
            "today_distance": float(today_distance),
            "pending_allowances": pending_allowances,
            "approved_allowances": approved_allowances
        })
