from django.urls import path
from .views import LoginAPIView, me

urlpatterns = [
    path("login/", LoginAPIView.as_view(), name="login"),
    path("me/", me, name="me"),
]