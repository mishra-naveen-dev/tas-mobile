from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AllowanceRequestViewSet

app_name = 'allowance'

router = DefaultRouter()
router.register(r'requests', AllowanceRequestViewSet,
                basename='allowance-request')

urlpatterns = [
    path('', include(router.urls)),
]
