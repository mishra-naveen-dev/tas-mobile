from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (StateViewSet, DistrictViewSet, BranchViewSet,
                    CenterViewSet, AreaViewSet, RoleViewSet, UserViewSet)

app_name = 'organization'

router = DefaultRouter()
router.register(r'states', StateViewSet, basename='state')
router.register(r'districts', DistrictViewSet, basename='district')
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'centers', CenterViewSet, basename='center')
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'users', UserViewSet, basename='user')


urlpatterns = [
    path('', include(router.urls)),
]
