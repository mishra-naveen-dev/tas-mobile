from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.attendance.models import AttendancePunch

User = get_user_model()


class Command(BaseCommand):
    help = 'Clear all punch records for today for a specific user or all users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username of the employee to clear punches for',
            default='employee'
        )

    def handle(self, *args, **options):
        username = options['username']
        today = timezone.now().date()

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'❌ User "{username}" not found')
            )
            return

        # Get all punches for today for this user
        punches = AttendancePunch.objects.filter(
            employee=user,
            punch_date=today
        )

        punch_count = punches.count()

        if punch_count == 0:
            self.stdout.write(
                self.style.WARNING(f'⚠️ No punches found for {username} today')
            )
            return

        # Delete all punches for today
        punches.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Cleared {punch_count} punch records for {username} today')
        )
        self.stdout.write(
            self.style.SUCCESS(f'✅ Dashboard reset:')
        )
        self.stdout.write(
            self.style.SUCCESS(f'   - Total Distance: 0 km')
        )
        self.stdout.write(
            self.style.SUCCESS(f'   - Punch Count: 0')
        )
        self.stdout.write(
            self.style.SUCCESS(f'   - Punch Status: Not Punched')
        )
        self.stdout.write(
            self.style.SUCCESS(f'\n🎉 Ready to start fresh punching!')
        )
