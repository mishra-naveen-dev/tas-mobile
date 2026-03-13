from django.urls import path
from .views import (
    AllowanceCreateAPIView,
    PendingAllowanceListAPIView,
    AllowanceApprovalAPIView
)

urlpatterns = [

    path("create/", AllowanceCreateAPIView.as_view()),

    path("pending/", PendingAllowanceListAPIView.as_view()),

    path("<int:pk>/action/", AllowanceApprovalAPIView.as_view()),
]
