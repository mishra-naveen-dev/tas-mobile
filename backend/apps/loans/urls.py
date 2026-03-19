from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoanAccountViewSet, LoanVisitViewSet

app_name = 'loans'

router = DefaultRouter()
router.register(r'accounts', LoanAccountViewSet, basename='loan-account')
router.register(r'visits', LoanVisitViewSet, basename='loan-visit')

urlpatterns = [
    path('', include(router.urls)),
]
