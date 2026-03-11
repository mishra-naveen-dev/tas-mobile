from django.conf import settings
from django.db import models


class PunchIn(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="punches"
    )

    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    distance_from_last = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=0
    )

    punched_at = models.DateTimeField(auto_now_add=True)
    punched_date = models.DateField(auto_now_add=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-punched_at"]
        indexes = [
            models.Index(fields=["user", "punched_date"])
        ]

    def __str__(self):
        return f"{self.user.employee_id} @ {self.punched_at}"