from django.db.models import Sum
from django.utils import timezone
from .models import PunchIn


def get_today_distance(user):
    today = timezone.localdate()

    result = (
        PunchIn.objects
        .filter(user=user, punched_date=today)
        .aggregate(total=Sum("distance_from_last"))
    )

    return result["total"] or 0