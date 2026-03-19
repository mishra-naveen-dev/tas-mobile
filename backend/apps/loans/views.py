from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import LoanAccount, LoanVisit
from .serializers import LoanAccountSerializer, LoanVisitSerializer


class LoanAccountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LoanAccountSerializer
    filter_backends = [DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'responsibility_officer']
    search_fields = ['loan_id', 'customer_name', 'customer_phone']
    ordering = ['-created_at']

    def get_queryset(self):
        return LoanAccount.objects.all()


class LoanVisitViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LoanVisitSerializer
    filter_backends = [DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['loan_account', 'visited_by',
                        'visit_type', 'visit_date', 'follow_up_required']
    search_fields = ['loan_account__loan_id', 'purpose']
    ordering = ['-visit_datetime']

    def get_queryset(self):
        user = self.request.user
        if user.role.name in ['SUPER_ADMIN', 'ADMIN']:
            return LoanVisit.objects.all()
        return LoanVisit.objects.filter(visited_by=user)

    def perform_create(self, serializer):
        """Automatically set visited_by to current user and set datetime"""
        today = timezone.now().date()
        now = timezone.now()

        # Set default values if not provided
        if 'visit_date' not in serializer.validated_data or not serializer.validated_data['visit_date']:
            serializer.validated_data['visit_date'] = today

        if 'visit_time' not in serializer.validated_data or not serializer.validated_data['visit_time']:
            serializer.validated_data['visit_time'] = now.time()

        serializer.save(visited_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create loan visit - extract customer_name if needed"""
        data = request.data.copy()

        # Handle optional fields
        if 'visit_date' not in data or not data.get('visit_date'):
            data['visit_date'] = timezone.now().date()

        if 'visit_time' not in data or not data.get('visit_time'):
            data['visit_time'] = timezone.now().time()

        # Set default visit type if not provided
        if 'visit_type' not in data or not data.get('visit_type'):
            data['visit_type'] = 'OTHER'

        # Set default purpose if not provided
        if 'purpose' not in data or not data.get('purpose'):
            # Build purpose from transaction type
            transaction_type = data.get('transaction_type', 'OTHER')
            customer_name = data.get('customer_name', 'Customer')
            data['purpose'] = f"{transaction_type} - {customer_name}"

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
