# Accounts app serializers
# User serialization is handled by organization app
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user

        # Add user info
        data['user'] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "employee_id": user.employee_id,
            "role": user.role.name if user.role else None,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }

        # 🔥 IMPORTANT (for frontend redirect)
        data['role'] = user.role.name if user.role else None

        return data
