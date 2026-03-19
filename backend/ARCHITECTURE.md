# Project Architecture Documentation

## New App-Based Structure

The project has been refactored from a monolithic 'allowance' app to a modern, scalable app-based architecture with 10 separate Django apps:

### Apps Overview

1. **organization** - Organizational hierarchy and user management
   - Models: State, District, Branch, Center, Area, Role, User
   - Endpoints: `/api/v1/organization/`

2. **accounts** - Authentication and account management
   - Endpoints: `/api/v1/accounts/`

3. **attendance** - GPS-based attendance and travel tracking
   - Models: AttendancePunch, TravelSession, TravelRoute
   - Endpoints: `/api/v1/attendance/`

4. **allowance** - Travel allowance requests and approvals
   - Models: AllowanceRequest, AllowanceApproval, AllowanceDocument
   - Endpoints: `/api/v1/allowance/`

5. **approvals** - Workflow approval system
   - Models: ApprovalWorkflow
   - Endpoints: `/api/v1/approvals/`

6. **loans** - CRM loan account and visit tracking
   - Models: LoanAccount, LoanVisit
   - Endpoints: `/api/v1/loans/`

7. **reports** - Reports and analytics
   - Models: Report, ReportJob
   - Endpoints: `/api/v1/reports/`

8. **audit** - Audit logging and compliance
   - Models: AuditLog
   - Endpoints: `/api/v1/audit/`

9. **notifications** - System notifications
   - Models: Notification
   - Endpoints: `/api/v1/notifications/`

10. **common** - Shared utilities and constants
    - Contains: Haversine distance calculation, app constants, permissions, middleware

## Database Models - Organizational Hierarchy

State → District → Branch → Center → Area → Employee

Each level has:
- Unique code identifier within its parent
- Name and status (is_active)
- Timestamps (created_at, updated_at)

User Model (Custom):
- Extends Django's AbstractUser
- Links to entire organizational hierarchy
- Role-based access control (SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE)
- Profile information (designation, department, phone)
- Status tracking (is_active, is_verified, force_password_change)

## Attendance & GPS Tracking

**AttendancePunch Model:**
- Records punch-in/punch-out with GPS coordinates
- Automatic distance calculation using Haversine formula
- Validates GPS accuracy
- Supports batch punch records

**TravelSession Model:**
- Tracks complete travel session from start to finish
- Accumulates total distance and stop count
- Linked to multiple TravelRoute records

**TravelRoute Model:**
- Detailed route between two locations
- Distance and travel time calculation
- Purpose/reason tracking

## Allowance System

**AllowanceRequest Model:**
- Multiple status stages: DRAFT → SUBMITTED → PENDING → APPROVED/REJECTED → PAID
- Distance-based calculation
- Fixed and variable allowance amounts
- Support for CRM loan linking
- Document attachment capability

**AllowanceApproval Model:**
- Multi-level approval workflow
- Separate approval records per level
- Comments and approval timestamps

**AllowanceDocument Model:**
- Receipt/invoice/other document types
- File upload support

## CRM Features

**LoanAccount Model:**
- Unique loan ID
- Customer information (name, phone, location)
- Responsibility officer assignment
- Status tracking (ACTIVE, CLOSED, DEFAULT, SUSPENDED)

**LoanVisit Model:**
- Visit type classification (COLLECTION, FOLLOW_UP, DISBURSEMENT, etc.)
- GPS coordinates for verification
- Distance tracking
- Purpose and observations
- Automatic follow-up scheduling

## Audit & Compliance

**AuditLog Model:**
- Comprehensive action logging (CREATE, UPDATE, DELETE, PUNCH_IN, LOGIN, etc.)
- Old and new values in JSON format
- IP address and user agent tracking
- Per-table audit trails
- Indexed for efficient queries

## Notifications

**Notification Model:**
- Event-based notifications (ALLOWANCE_APPROVED, LOAN_FOLLOW_UP, etc.)
- Per-user recipient
- Read/unread tracking
- Related object linking

## API Versioning

All endpoints follow the `/api/v1/` pattern:
- `/api/v1/organization/` - Org hierarchy and users
- `/api/v1/attendance/` - Punches, sessions, routes
- `/api/v1/allowance/` - Allowance requests and approvals
- `/api/v1/approvals/` - Approval workflows
- `/api/v1/loans/` - CRM loan management
- `/api/v1/reports/` - Reports and jobs
- `/api/v1/audit/` - Audit logs
- `/api/v1/notifications/` - User notifications

## Authentication

JWT-based authentication with:
- 60-minute access token lifetime
- 7-day refresh token lifetime
- Token refresh endpoint: `/api/token/refresh/`
- Token obtain endpoint: `/api/token/`

## Permissions

Role-based access control (RBAC):
- **SUPER_ADMIN**: Full system access
- **ADMIN**: Administrative functions
- **MANAGER**: Department/area management
- **EMPLOYEE**: Self-service access to personal data

Common permission classes:
- `IsAdmin`: SUPER_ADMIN and ADMIN only
- `IsSuperAdmin`: SUPER_ADMIN only
- `IsManager`: SUPER_ADMIN, ADMIN, MANAGER
- `IsEmployee`: EMPLOYEE only
- `IsOwnerOrAdmin`: Owner or admin access
- `IsOwner`: Owner access only

## Distance Calculation

Uses Haversine formula to calculate great-circle distances:
- Accuracy: Typically within 0.5-1% for Earth calculation
- Units: Kilometers
- Inputs: latitude and longitude

Configuration thresholds:
- Minimum km for allowance claim: 5 km
- Maximum km per day: 200 km
- GPS accuracy threshold: 100 meters

## File Structure

```
backend/
├── apps/
│   ├── organization/
│   ├── accounts/
│   ├── attendance/
│   ├── allowance/
│   ├── approvals/
│   ├── loans/
│   ├── reports/
│   ├── audit/
│   └── notifications/
├── common/
│   ├── utils/
│   │   ├── geo.py          # Haversine distance calculation
│   ├── constants/
│   │   └── app_constants.py
│   ├── middleware/
│   └── permissions.py       # Common permission classes
├── config/
├── traveling_allowance/
│   ├── settings.py         # Updated with 10 apps
│   ├── urls.py             # /api/v1/ routing
│   └── wsgi.py
├── manage.py
└── requirements.txt
```

## Next Steps

1. ✅ Create models across all 10 apps
2. ✅ Register models in admin.py
3. ✅ Create serializers
4. ✅ Create ViewSets with custom actions
5. ✅ Create URL routing with /api/v1/ pattern
6. ✅ Update Django settings
7. ⏳ Run migrations to create database tables
8. ⏳ Create frontend pages (AdminDashboard, EmployeePages)
9. ⏳ Integrate frontend with new API structure
10. ⏳ Add initial data/fixtures (roles, organization hierarchy)
