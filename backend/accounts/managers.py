from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    def create_user(self, employee_id, email, password=None, **extra_fields):
        if not employee_id:
            raise ValueError("Employee ID is required")

        email = self.normalize_email(email)
        user = self.model(
            employee_id=employee_id,
            email=email,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, employee_id, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "SUPER_ADMIN")

        return self.create_user(employee_id, email, password, **extra_fields)