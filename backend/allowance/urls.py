from django.urls import path

from .views import (
    AllowanceCreateAPIView,
    PendingAllowanceListAPIView,
    AllowanceApprovalAPIView,
    EmployeeAllowanceHistoryAPIView,
    AdminAllowanceListAPIView
)

urlpatterns = [
    path("create/", AllowanceCreateAPIView.as_view(), name="allowance-create"),
    path("pending/", PendingAllowanceListAPIView.as_view(),
         name="allowance-pending"),
    path("<int:pk>/action/", AllowanceApprovalAPIView.as_view(),
         name="allowance-action"),
    path("my-requests/", EmployeeAllowanceHistoryAPIView.as_view(),
         name="my-allowances"),
    path("all/", AdminAllowanceListAPIView.as_view(), name="all-allowances"),

]
