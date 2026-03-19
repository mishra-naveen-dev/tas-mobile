from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.organization.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test users with different roles'

    def handle(self, *args, **options):
        # Create Super Admin
        superadmin, created = User.objects.get_or_create(
            username='superadmin',
            defaults={
                'password': '',
                'email': 'superadmin@test.com',
                'first_name': 'Super',
                'last_name': 'Admin'
            }
        )
        if created:
            superadmin.set_password('password123')
        superadmin_role = Role.objects.get(name='SUPER_ADMIN')
        superadmin.role = superadmin_role
        superadmin.is_verified = True
        superadmin.save()
        self.stdout.write(self.style.SUCCESS(
            '✅ Super Admin created: superadmin / password123'))

        # Create Admin
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'password': '',
                'email': 'admin@test.com',
                'first_name': 'Admin',
                'last_name': 'User'
            }
        )
        if created:
            admin.set_password('password123')
        admin_role = Role.objects.get(name='ADMIN')
        admin.role = admin_role
        admin.is_verified = True
        admin.save()
        self.stdout.write(self.style.SUCCESS(
            '✅ Admin created: admin / password123'))

        # Create Employee
        employee, created = User.objects.get_or_create(
            username='employee',
            defaults={
                'password': '',
                'email': 'employee@test.com',
                'first_name': 'Employee',
                'last_name': 'User',
                'employee_id': 'EMP001'
            }
        )
        if created:
            employee.set_password('password123')
        employee_role = Role.objects.get(name='EMPLOYEE')
        employee.role = employee_role
        employee.is_verified = True
        employee.save()
        self.stdout.write(self.style.SUCCESS(
            '✅ Employee created: employee / password123'))

        self.stdout.write(self.style.SUCCESS(
            '\n🎉 All test users created successfully!'))
