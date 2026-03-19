from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.db.models import Q, Sum, Count, F
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timedelta
import json

from .models import (
    Role, Client, Facility, Employee, UserRole, Task,
    PunchRecord, DailyPunchSummary, DistanceRecord,
    AllowanceRequest, DailyWorkUpdate, Allowance
)
from .serializers import (
    UserSerializer, UserDetailSerializer,
    RoleSerializer, UserRoleSerializer,
    ClientSerializer, ClientDetailSerializer,
    FacilitySerializer,
    EmployeeSerializer, EmployeeBasicSerializer,
    TaskSerializer,
    PunchRecordSerializer, DailyPunchSummarySerializer,
    DistanceRecordSerializer,
    AllowanceRequestSerializer, DailyWorkUpdateSerializer,
    AllowanceSerializer
)
from .permissions import IsAdmin, IsSuperAdmin, IsEmployeeOrReadOnly


# User ViewSet
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['date_joined', 'username']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def current_user(self, request):
        """Get current logged-in user details"""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change user password"""
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not user.check_password(old_password):
            return Response({'error': 'Old password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password changed successfully'})


# Role ViewSet
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']


# Client ViewSet
class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'contact_person', 'email']
    ordering_fields = ['created_at', 'name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClientDetailSerializer
        return ClientSerializer

    @action(detail=True, methods=['get'])
    def facilities(self, request, pk=None):
        """Get all facilities for a client"""
        client = self.get_object()
        facilities = client.facilities.all()
        serializer = FacilitySerializer(facilities, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def employees(self, request, pk=None):
        """Get all employees for a client"""
        client = self.get_object()
        employees = client.employees.all()
        serializer = EmployeeBasicSerializer(employees, many=True)
        return Response(serializer.data)


# Facility ViewSet
class FacilityViewSet(viewsets.ModelViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilitySerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['client', 'status']
    search_fields = ['name', 'location', 'contact_person']
    ordering_fields = ['created_at', 'name']

    @action(detail=True, methods=['get'])
    def employees(self, request, pk=None):
        """Get all employees assigned to this facility"""
        facility = self.get_object()
        employees = facility.employees.all()
        serializer = EmployeeBasicSerializer(employees, many=True)
        return Response(serializer.data)


# Employee ViewSet
class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['client', 'facility', 'status', 'designation']
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'designated']
    ordering_fields = ['date_of_joining', 'user__first_name']

    def get_queryset(self):
        """Filter employees based on user role"""
        user = self.request.user
        try:
            user_role = user.user_role.role.name
            if user_role == 'SUPER_ADMIN':
                return Employee.objects.all()
            elif user_role == 'ADMIN':
                return Employee.objects.filter(client__isnull=False)
            else:
                return Employee.objects.filter(user=user)
        except:
            return Employee.objects.filter(user=user)

    @action(detail=True, methods=['get'])
    def punching_records(self, request, pk=None):
        """Get punching records for an employee"""
        employee = self.get_object()
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        records = PunchRecord.objects.filter(employee=employee)
        if month and year:
            records = records.filter(punch_date__month=month, punch_date__year=year)

        serializer = PunchRecordSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def daily_summary(self, request, pk=None):
        """Get daily punch summary for an employee"""
        employee = self.get_object()
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        summaries = DailyPunchSummary.objects.filter(employee=employee)
        if month and year:
            summaries = summaries.filter(punch_date__month=month, punch_date__year=year)

        serializer = DailyPunchSummarySerializer(summaries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def allowance_history(self, request, pk=None):
        """Get allowance request history for an employee"""
        employee = self.get_object()
        requests = AllowanceRequest.objects.filter(employee=employee)
        serializer = AllowanceRequestSerializer(requests, many=True)
        return Response(serializer.data)


# Task ViewSet
class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['assigned_to', 'status', 'priority', 'facility']
    search_fields = ['title', 'description', 'assigned_to__user__first_name']
    ordering_fields = ['start_date', 'priority', 'status']

    def get_queryset(self):
        """Filter tasks based on user role"""
        user = self.request.user
        try:
            user_role = user.user_role.role.name
            if user_role == 'SUPER_ADMIN':
                return Task.objects.all()
            elif user_role == 'ADMIN':
                return Task.objects.all()
            else:
                return Task.objects.filter(assigned_to__user=user)
        except:
            return Task.objects.filter(assigned_to__user=user)

    @action(detail=True, methods=['patch'])
    def mark_completed(self, request, pk=None):
        """Mark a task as completed"""
        task = self.get_object()
        task.status = 'COMPLETED'
        task.completion_notes = request.data.get('completion_notes', '')
        task.save()
        serializer = self.get_serializer(task)
        return Response(serializer.data)


# Punch Record ViewSet
class PunchRecordViewSet(viewsets.ModelViewSet):
    queryset = PunchRecord.objects.all()
    serializer_class = PunchRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'punch_date', 'punch_type']
    ordering_fields = ['-punch_date', '-timestamp']

    def create(self, request, *args, **kwargs):
        """Create a new punch record"""
        employee_id = request.data.get('employee')
        punch_type = request.data.get('punch_type')
        punch_date = request.data.get('punch_date', timezone.now().date())

        try:
            PunchRecord.objects.get(employee_id=employee_id, punch_date=punch_date, punch_type=punch_type)
            return Response({'error': 'Punch record already exists for this date and type'},
                          status=status.HTTP_400_BAD_REQUEST)
        except PunchRecord.DoesNotExist:
            pass

        return super().create(request, *args, **kwargs)


# Daily Punch Summary ViewSet
class DailyPunchSummaryViewSet(viewsets.ModelViewSet):
    queryset = DailyPunchSummary.objects.all()
    serializer_class = DailyPunchSummarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'punch_date']
    ordering_fields = ['-punch_date']
    http_method_names = ['get', 'head', 'options']

    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        """Get monthly summary for all employees"""
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        if not month or not year:
            return Response({'error': 'Month and year are required'}, status=status.HTTP_400_BAD_REQUEST)

        summaries = DailyPunchSummary.objects.filter(
            punch_date__month=month,
            punch_date__year=year
        ).values('employee').annotate(
            total_hours=Sum('total_hours'),
            total_distance=Sum('total_distance_km'),
            working_days=Count('id')
        )

        return Response(summaries)


# Distance Record ViewSet
class DistanceRecordViewSet(viewsets.ModelViewSet):
    queryset = DistanceRecord.objects.all()
    serializer_class = DistanceRecordSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['source_facility', 'destination_facility']
    search_fields = ['source_facility__name', 'destination_facility__name']


# Allowance Request ViewSet
class AllowanceRequestViewSet(viewsets.ModelViewSet):
    queryset = AllowanceRequest.objects.all()
    serializer_class = AllowanceRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'month', 'year', 'status']
    ordering_fields = ['-year', '-month', 'status']

    def get_queryset(self):
        """Filter allowance requests based on user role"""
        user = self.request.user
        try:
            user_role = user.user_role.role.name
            if user_role == 'SUPER_ADMIN':
                return AllowanceRequest.objects.all()
            elif user_role == 'ADMIN':
                return AllowanceRequest.objects.all()
            else:
                return AllowanceRequest.objects.filter(employee__user=user)
        except:
            return AllowanceRequest.objects.filter(employee__user=user)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        """Approve an allowance request"""
        allowance_request = self.get_object()
        allowance_request.status = 'APPROVED'
        allowance_request.approved_date = timezone.now()
        allowance_request.approved_by = request.user
        allowance_request.approval_notes = request.data.get('approval_notes', '')
        allowance_request.save()
        serializer = self.get_serializer(allowance_request)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        """Reject an allowance request"""
        allowance_request = self.get_object()
        allowance_request.status = 'REJECTED'
        allowance_request.approval_notes = request.data.get('approval_notes', '')
        allowance_request.save()
        serializer = self.get_serializer(allowance_request)
        return Response(serializer.data)


# Daily Work Update ViewSet
class DailyWorkUpdateViewSet(viewsets.ModelViewSet):
    queryset = DailyWorkUpdate.objects.all()
    serializer_class = DailyWorkUpdateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'update_date', 'status']
    ordering_fields = ['-update_date']

    def get_queryset(self):
        """Filter updates based on user role"""
        user = self.request.user
        try:
            user_role = user.user_role.role.name
            if user_role == 'SUPER_ADMIN':
                return DailyWorkUpdate.objects.all()
            elif user_role == 'ADMIN':
                return DailyWorkUpdate.objects.all()
            else:
                return DailyWorkUpdate.objects.filter(employee__user=user)
        except:
            return DailyWorkUpdate.objects.filter(employee__user=user)


# Allowance ViewSet (Legacy)
class AllowanceViewSet(viewsets.ModelViewSet):
    queryset = Allowance.objects.all()
    serializer_class = AllowanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['officer_name']
    ordering_fields = ['-travel_date']


# User Role ViewSet
class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['user', 'role']
    search_fields = ['user__username', 'role__name']

    @action(detail=False, methods=['post'])
    def assign_role(self, request):
        """Assign or update a role for a user"""
        user_id = request.data.get('user_id')
        role_id = request.data.get('role_id')

        try:
            user = User.objects.get(id=user_id)
            role = Role.objects.get(id=role_id)
        except (User.DoesNotExist, Role.DoesNotExist):
            return Response({'error': 'User or Role not found'}, status=status.HTTP_404_NOT_FOUND)

        user_role, created = UserRole.objects.update_or_create(
            user=user,
            defaults={'role': role, 'assigned_by': request.user}
        )

        serializer = self.get_serializer(user_role)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# Dashboard Analytics ViewSet
class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def super_admin_dashboard(self, request):
        """Get super admin dashboard analytics"""
        if not hasattr(request.user, 'user_role') or request.user.user_role.role.name != 'SUPER_ADMIN':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        total_employees = Employee.objects.count()
        total_clients = Client.objects.count()
        total_facilities = Facility.objects.count()
        pending_allowances = AllowanceRequest.objects.filter(status='PENDING').count()

        return Response({
            'total_employees': total_employees,
            'total_clients': total_clients,
            'total_facilities': total_facilities,
            'pending_allowances': pending_allowances,
        })

    @action(detail=False, methods=['get'])
    def employee_dashboard(self, request):
        """Get employee dashboard analytics"""
        try:
            employee = request.user.employee
        except Employee.DoesNotExist:
            return Response({'error': 'Employee profile not found'}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()
        pending_tasks = Task.objects.filter(assigned_to=employee, status='PENDING').count()
        today_punch_summary = DailyPunchSummary.objects.filter(employee=employee, punch_date=today).first()

        return Response({
            'pending_tasks': pending_tasks,
            'today_check_in': today_punch_summary.check_in_time if today_punch_summary else None,
            'today_check_out': today_punch_summary.check_out_time if today_punch_summary else None,
            'today_total_hours': today_punch_summary.total_hours if today_punch_summary else 0,
        })
