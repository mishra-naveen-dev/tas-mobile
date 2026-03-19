# Accounts app views
# Authentication views handled separately in accounts/auth.py
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenSerializer


class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer
