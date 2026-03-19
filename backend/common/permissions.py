from rest_framework.permissions import BasePermission


def get_role(user):
    return user.role.name if user and user.role else None


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        role = get_role(request.user)
        return request.user.is_authenticated and role in ['SUPER_ADMIN', 'ADMIN']


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        role = get_role(request.user)
        return request.user.is_authenticated and role == 'SUPER_ADMIN'


class IsManager(BasePermission):
    def has_permission(self, request, view):
        role = get_role(request.user)
        return request.user.is_authenticated and role in ['SUPER_ADMIN', 'ADMIN', 'MANAGER']


class IsEmployee(BasePermission):
    def has_permission(self, request, view):
        role = get_role(request.user)
        return request.user.is_authenticated and role == 'EMPLOYEE'


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        role = get_role(request.user)

        if hasattr(obj, 'employee'):
            return obj.employee == request.user or role in ['SUPER_ADMIN', 'ADMIN']

        if hasattr(obj, 'user'):
            return obj.user == request.user or role in ['SUPER_ADMIN', 'ADMIN']

        return False


class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'employee'):
            return obj.employee == request.user

        if hasattr(obj, 'user'):
            return obj.user == request.user

        return False
