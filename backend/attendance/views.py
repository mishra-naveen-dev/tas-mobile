from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import PunchIn
from .serializers import PunchInSerializer
from .services import get_today_distance
from common.utils.geo import haversine_distance


class PunchInAPIView(APIView):
    """
    Employee punch-in API.
    Captures latitude & longitude and calculates distance from last punch.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PunchInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get the previous punch BEFORE creating new one
        last_punch = (
            PunchIn.objects
            .filter(user=request.user)
            .order_by("-punched_at")
            .first()
        )

        distance = 0.0
        if last_punch:
            distance = haversine_distance(
                float(last_punch.latitude),
                float(last_punch.longitude),
                float(serializer.validated_data["latitude"]),
                float(serializer.validated_data["longitude"]),
            )

        # Create punch with calculated distance
        punch = PunchIn.objects.create(
            user=request.user,
            latitude=serializer.validated_data["latitude"],
            longitude=serializer.validated_data["longitude"],
            distance_from_last=distance,
        )

        return Response(
            PunchInSerializer(punch).data,
            status=status.HTTP_201_CREATED
        )


class TodayDistanceAPIView(APIView):
    """
    Returns today's total travel distance for logged-in user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total_distance = get_today_distance(request.user)

        return Response({
            "total_distance_km": round(float(total_distance), 3)
        })