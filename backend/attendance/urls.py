from django.urls import path
from .views import (
    PunchInAPIView,
    TodayDistanceAPIView,
    TodayPunchListAPIView,
    MonthlyDistanceAPIView,
    AdminEmployeeTravelAPIView,
    AdminDashboardAPIView
)

urlpatterns = [

    path("punch-in/", PunchInAPIView.as_view()),

    path("today-distance/", TodayDistanceAPIView.as_view()),

    path("today-punches/", TodayPunchListAPIView.as_view()),

    path("monthly-distance/", MonthlyDistanceAPIView.as_view()),

    path("admin-travel-report/", AdminEmployeeTravelAPIView.as_view()),
    path("admin-dashboard/", AdminDashboardAPIView.as_view()),
]
