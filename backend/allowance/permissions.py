from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Allow access to admin and super admin users
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            user_role = request.user.user_role.role.name
            return user_role in ['ADMIN', 'SUPER_ADMIN']
        except:
            return False


class IsSuperAdmin(permissions.BasePermission):
    """
    Allow access only to super admin users
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            user_role = request.user.user_role.role.name
            return user_role == 'SUPER_ADMIN'
        except:
            return False


class IsEmployee(permissions.BasePermission):
    """
    Allow access to employee users
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            user_role = request.user.user_role.role.name
            return user_role == 'EMPLOYEE'
        except:
            return False


class IsEmployeeOrReadOnly(permissions.BasePermission):
    """
    Allow employees to read and update their own data
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        try:
            user_role = request.user.user_role.role.name
            if user_role == 'EMPLOYEE':
                return obj.user == request.user or (hasattr(obj, 'employee') and obj.employee.user == request.user)
            return user_role in ['ADMIN', 'SUPER_ADMIN']
        except:
            return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allow owners of an object or admins to edit it
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        try:
            user_role = request.user.user_role.role.name
            if user_role in ['ADMIN', 'SUPER_ADMIN']:
                return True

            if hasattr(obj, 'employee') and obj.employee.user == request.user:
                return True

            if hasattr(obj, 'user') and obj.user == request.user:
                return True

            return False
        except:
            return False
