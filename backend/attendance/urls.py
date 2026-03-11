from django.urls import path
from .views import PunchInAPIView, TodayDistanceAPIView

urlpatterns = [
    path("punch-in/", PunchInAPIView.as_view(), name="punch-in"),
    path("today-distance/", TodayDistanceAPIView.as_view(), name="today-distance"),
]