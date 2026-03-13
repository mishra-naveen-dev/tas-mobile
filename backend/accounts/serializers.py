from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken


class LoginSerializer(serializers.Serializer):

    employee_id = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):

        employee_id = data.get("employee_id")
        password = data.get("password")

        user = authenticate(employee_id=employee_id, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials")

        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "employee_id": user.employee_id,
            "role": user.role
        }
