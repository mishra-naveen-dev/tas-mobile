from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
import logging

from .models import AttendancePunch, TravelSession, TravelRoute, PunchCorrectionRequest
from .serializers import (
    AttendancePunchSerializer,
    TravelSessionSerializer,
    TravelRouteSerializer,
    PunchCorrectionRequestSerializer
)
from common.utils.geo import haversine_distance

logger = logging.getLogger(__name__)


class AttendancePunchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendancePunchSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'punch_type', 'punch_date']
    ordering = ['-punched_at']

    def get_queryset(self):
        user = self.request.user
        if user.role.name in ['SUPER_ADMIN', 'ADMIN']:
            return AttendancePunch.objects.all()
        return AttendancePunch.objects.filter(employee=user)

    def create(self, request, *args, **kwargs):
        logger.info(f"📍 Creating punch for user: {request.user}")
        logger.info(f"📍 Incoming data: {request.data}")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        employee = request.user
        latitude = serializer.validated_data.get('latitude')
        longitude = serializer.validated_data.get('longitude')

        # 🔥 DEFAULT DISTANCE
        distance = 0

        # 🔍 GET LAST PUNCH
        last_punch = AttendancePunch.objects.filter(
            employee=employee
        ).order_by('-punched_at').first()

        if last_punch:
            logger.info(
                f"📍 Last punch: ({last_punch.latitude}, {last_punch.longitude})")

            # ✅ CHECK INVALID PREVIOUS COORDINATES
            if (
                last_punch.latitude is None or
                last_punch.longitude is None or
                last_punch.latitude == 0 or
                last_punch.longitude == 0
            ):
                logger.warning(
                    "⚠️ Invalid previous coordinates → distance = 0")
                distance = 0

            else:
                try:
                    distance = haversine_distance(
                        last_punch.latitude,
                        last_punch.longitude,
                        latitude,
                        longitude
                    )

                    # ✅ SAME LOCATION FIX (<50 meters)
                    if distance < 0.05:
                        distance = 0

                    # ✅ UNREALISTIC DISTANCE FIX
                    if distance > 100:
                        logger.warning(
                            f"⚠️ Unrealistic distance: {distance} km → reset to 0")
                        distance = 0

                    logger.info(f"📏 Final distance: {distance} km")

                except Exception as e:
                    logger.error(f"❌ Distance error: {str(e)}")
                    distance = 0
        else:
            logger.info("📍 First punch → distance = 0")

        # 💾 SAVE RECORD
        instance = serializer.save(
            employee=employee,
            distance_from_last=distance
        )

        logger.info(f"✅ Punch saved: {instance.id}")

        return Response(
            self.get_serializer(instance).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def today_punches(self, request):
        today = timezone.now().date()
        punches = AttendancePunch.objects.filter(
            employee=request.user,
            punch_date=today
        ).order_by('-punched_at')

        return Response(self.get_serializer(punches, many=True).data)

    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        today = timezone.now().date()

        punches = AttendancePunch.objects.filter(
            employee=request.user,
            punch_date=today
        ).order_by('punched_at')

        total_distance = sum([
            p.distance_from_last or 0 for p in punches
        ])

        punch_in = punches.first()

        return Response({
            'date': today,
            'punch_in': punch_in.punched_at if punch_in else None,
            'total_distance_today': round(total_distance, 2),
            'punch_count': punches.count(),
        })


# ------------------ TRAVEL SESSION ------------------

class TravelSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TravelSessionSerializer

    def get_queryset(self):
        return TravelSession.objects.filter(employee=self.request.user)

    @action(detail=True, methods=['post'])
    def complete_session(self, request, pk=None):
        session = self.get_object()
        session.is_completed = True
        session.end_time = timezone.now()
        session.save()
        return Response(self.get_serializer(session).data)


# ------------------ TRAVEL ROUTES ------------------

class TravelRouteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TravelRouteSerializer

    def get_queryset(self):
        return TravelRoute.objects.all()


# ------------------ CORRECTIONS ------------------

class PunchCorrectionRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PunchCorrectionRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role.name in ['SUPER_ADMIN', 'ADMIN']:
            return PunchCorrectionRequest.objects.all()
        return PunchCorrectionRequest.objects.filter(employee=user)

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user)
