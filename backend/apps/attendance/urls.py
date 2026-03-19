from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendancePunchViewSet, TravelSessionViewSet, TravelRouteViewSet, PunchCorrectionRequestViewSet

app_name = 'attendance'

router = DefaultRouter()
router.register(r'punches', AttendancePunchViewSet,
                basename='attendance-punch')
router.register(r'sessions', TravelSessionViewSet, basename='travel-session')
router.register(r'routes', TravelRouteViewSet, basename='travel-route')
router.register(r'corrections', PunchCorrectionRequestViewSet,
                basename='punch-correction')

urlpatterns = [
    path('', include(router.urls)),
]
