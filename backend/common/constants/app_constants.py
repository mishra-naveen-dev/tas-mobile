# Common constants for the application

# Allowance Rates
ALLOWANCE_RATES = {
    'fixed_daily': 250.00,  # Fixed daily allowance
    'per_km': 10.00,  # Per kilometer allowance
}

# Distance Thresholds
DISTANCE_THRESHOLDS = {
    'min_for_claim': 5,  # Minimum km to claim allowance
    'max_daily': 200,  # Maximum km per day
}

# Punch Accuracy
GPS_ACCURACY_THRESHOLD = 100  # meters

# User Roles
USER_ROLES = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'ADMIN': 'ADMIN',
    'MANAGER': 'MANAGER',
    'EMPLOYEE': 'EMPLOYEE',
}

# Allowance Status
ALLOWANCE_STATUS = {
    'DRAFT': 'DRAFT',
    'SUBMITTED': 'SUBMITTED',
    'PENDING': 'PENDING',
    'APPROVED': 'APPROVED',
    'REJECTED': 'REJECTED',
    'PAID': 'PAID',
}

# Attendance Punch Types
PUNCH_TYPES = {
    'IN': 'PUNCH_IN',
    'OUT': 'PUNCH_OUT',
}
