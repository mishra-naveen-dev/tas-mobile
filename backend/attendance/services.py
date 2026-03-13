from django.utils import timezone
from django.db.models import Sum
from .models import PunchIn


def get_today_distance(user):

    today = timezone.localdate()

    total = PunchIn.objects.filter(
        user=user,
        punched_date=today
    ).aggregate(
        total=Sum("distance_from_last")
    )["total"] or 0

    return total
