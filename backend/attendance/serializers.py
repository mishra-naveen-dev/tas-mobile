from rest_framework import serializers
from .models import PunchIn


class PunchInSerializer(serializers.ModelSerializer):
    class Meta:
        model = PunchIn
        fields = ["id", "latitude", "longitude", "punched_at"]
        read_only_fields = ["id", "punched_at"]

    def validate(self, data):
        lat = data.get("latitude")
        lon = data.get("longitude")

        if not (-90 <= lat <= 90):
            raise serializers.ValidationError("Invalid latitude")

        if not (-180 <= lon <= 180):
            raise serializers.ValidationError("Invalid longitude")

        return data