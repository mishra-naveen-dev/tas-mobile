# AGENT.md

## TAS (Traveling Allowance System) – Mobile Application Engineering Guide

This document defines how the TAS mobile application should be designed, built, and maintained to meet enterprise and production-level standards. It consolidates backend logic, frontend behavior, field tracking requirements, and system integrity rules.

---

# 1. Product Overview

TAS (Traveling Allowance System) is a field tracking and allowance management platform where users perform multiple punches throughout the day across different locations.

Each punch represents:

* A visit to a location
* A timestamped activity
* Geo-coordinates (mandatory)
* Contextual metadata (visit type, remarks, etc.)

The system must support:

* Multiple punches per day
* Multiple punches at the same location
* Real-time tracking
* Distance calculation between visits
* Enterprise-level hierarchy and reporting

---

# 2. Core Principles

## 2.1 Accuracy First

* Location must always be captured using GPS (no manual override unless admin approved)
* Timestamps must be server-controlled
* Duplicate or fake punches must be prevented

## 2.2 Reliability

* App must work in low network conditions
* Offline punch queueing with background sync
* Retry mechanism for failed API calls

## 2.3 Scalability

* Designed for:

  * 10K+ users
  * 12+ states
  * 450+ branches
* Efficient API calls and pagination

## 2.4 Security

* One device per user policy
* Token-based authentication (JWT)
* Device binding + superadmin override

---

# 3. Mobile Application Architecture

## 3.0 Tech Stack (Production)

* React Native
* React Navigation
* Axios (with interceptors)
* AsyncStorage / Secure Storage
* React Native Vector Icons

## 3.1 Supporting Libraries (Tracking System)

* react-native-geolocation-service (GPS)
* react-native-maps (Map UI)
* react-native-background-fetch (background tracking)

Note: Only free and production-safe libraries must be used. No paid SDK dependency.

## 3.2 Folder Structure

## 3.1 Tech Stack

* React Native (preferred)
* State Management: Context API / Redux Toolkit
* Networking: Axios with interceptors
* Storage: AsyncStorage / Secure Storage

## 3.2 Folder Structure

```
/src
  /components
  /screens
  /services
  /hooks
  /context
  /utils
  /constants
```

---

# 4. Core Features

## 4.0 Feature Set Alignment (Mobile App)

The mobile application must support the following production-ready features:

### Employee Features

* Punch In/Out with GPS location
* Route tracking with map visualization
* Apply for travel allowance
* Punch corrections
* View history:

  * Punch history
  * Allowance history
  * Daily summary

### Admin Features

* Dashboard with employee tracking
* Approve/reject allowances
* Approve/reject punch corrections
* Device management

### Super Admin Features

* Organization-wide statistics
* User management
* Device control (reset/reassign)
* Approval workflow configuration

---

## 4.1 Punch System

The punch system must follow a state-driven architecture for reliability.

Reference implementation includes:

* PunchContext for global state management
* LocationService for GPS handling
* API Service for backend communication

Punch States:

* IDLE
* FETCHING
* FORM_OPEN
* SUBMITTING
* TRACKING
* PUNCHING_OUT
* COMPLETED
* ERROR

(Ref: Punch Feature Overview) fileciteturn0file0

Each punch must include:

Each punch must include:

* Latitude & Longitude
* Timestamp (server time)
* Location name (resolved via reverse geocoding)
* Visit type
* Remarks

### Rules:

* Multiple punches allowed at same location
* Each punch visually differentiated (color coding)
* Prevent accidental double taps

## 4.2 Punch Validation Logic

* Minimum distance threshold (optional)
* Time gap validation
* GPS accuracy threshold
* Detect mock location

---

# 5. Travel Distance Calculation

Distance must be calculated using Haversine formula and tracked continuously.

System Requirements:

* Track route points every ~10 seconds
* Minimum movement filter (~20m)
* Store max ~500 points (FIFO)
* Calculate live distance during tracking

Backend + Mobile both must support calculation consistency.

(Ref: LocationService implementation) fileciteturn0file0

Example:
A → B → C → D → A

System must calculate total travel distance dynamically.

Example:
A → B → C → D → A

Distance =

* A→B = 5
* B→C = 6
* C→D = 9
* D→A = 20

Total = 40 units

## Backend Responsibility:

* Store coordinates
* Compute distances using Haversine formula
* Recalculate on demand

---

# 6. UI/UX Guidelines (Enterprise Level)

## 6.1 Design Language

* Clean, minimal, consistent
* No random colors
* Defined color system for punch states

## 6.2 Navigation

* Bottom tab navigation
* Icons must be consistent and meaningful
* Active tab must have unique highlight color

## 6.3 Screens

### Dashboard

* Today's activity summary
* Total distance
* Punch count

### Punch Screen

* Large primary action button
* Clear feedback after punch
* No confusing alerts

### Activity Screen

* Timeline view of punches
* Color-coded entries
* Filters (visit type, date)

---

# 7. Error Handling (User-Focused & Actionable)

Error handling must be clear, actionable, and consistent across the app. Users should always understand what went wrong and what they can do next.

## 7.1 Principles

* Never show raw server or system errors
* Always provide a human-readable message
* Pair every error with a clear next step (Retry / Enable / Check)
* Keep messaging consistent across all screens

## 7.2 Error Categories & Messages

### Network Errors

* Message: "No internet connection"
* Action: Show "Retry" button
* Behavior: Auto-retry in background when connection restores

### Server Errors (5xx)

* Message: "Server issue. Please try again"
* Action: Retry button
* Log error silently for debugging

### Client Errors (4xx)

* 401/403: "Session expired. Please login again"
* 400: "Invalid data. Please check and try again"

### GPS / Location Errors

* GPS Off: "Location is turned off. Enable to continue"
* Permission Denied: "Allow location permission to punch"
* Low Accuracy: "Waiting for accurate location..."

### Punch Errors

* Duplicate Tap: "Punch already in progress"
* Validation Fail: "Unable to punch. Try again"
* Backend Reject: Show reason if safe, otherwise generic message

## 7.3 Notification Types

### Toast (Quick Feedback)

* Used for success or small alerts
* Example: "Punch recorded successfully"

### Inline Messages

* Show under inputs or on screen
* Example: validation errors

### Modal Alerts (Important)

* Used for blocking issues
* Example: device restriction, session expired

## 7.4 UX Rules

* Errors must not block the app unnecessarily
* Avoid multiple popups at once
* Show loading states before errors
* Always allow retry where possible

## 7.5 Developer Rules

* Centralized error handler (Interceptor / Middleware)
* Standard response format from backend:
  {
  success: false,
  message: "Error message",
  code: "ERROR_CODE"
  }
* Log all critical errors

---

# 8. Offline Support

* Store punches locally when offline
* Auto-sync when internet returns
* Show sync status to user

---

# 9. Device Policy (Critical)

## One Device – One User

* Each user is bound to one device
* Device ID stored in backend

### Exceptions:

* Superadmin can:

  * Reset device
  * Reassign device

### Flow:

1. User logs in → device registered
2. New device login → blocked
3. User requests change
4. Superadmin approves
5. Device reset

---

# 10. Authentication & Session Management (Enterprise Standard)

Frequent login/logout is NOT acceptable for an enterprise mobile application. The system must provide a persistent, secure, and seamless session experience.

## 10.1 Core Principle

* User should NOT log in again and again daily
* Session must persist securely across app restarts
* Logout should be intentional or security-triggered only

## 10.2 Login Flow

1. User logs in with credentials
2. Backend returns:

   * Access Token (short-lived)
   * Refresh Token (long-lived)
3. Tokens stored securely (Secure Storage)

## 10.3 Session Behavior

* User stays logged in for days/weeks
* App restart → auto-login using stored token
* No interruption in daily workflow

## 10.4 Token Handling

### Access Token

* Short expiry (e.g., 15–60 minutes)
* Used for API calls

### Refresh Token

* Long expiry (e.g., 7–30 days)
* Used to generate new access token silently

### Flow:

* Access token expires → auto refresh using refresh token
* No UI interruption

## 10.5 Logout Scenarios

User should be logged out ONLY in these cases:

### Manual Logout

* User clicks logout
* Clear tokens and local data

### Session Expired

* Refresh token expired
* Show message: "Session expired. Please login again"

### Device Policy Violation

* Login from another device
* Show message: "Your account was accessed from another device"

### Security Trigger

* Admin/Superadmin force logout

## 10.6 UX Rules

* No forced daily login
* No random logout during work
* Silent token refresh
* Show message only when re-login is required

## 10.7 Developer Implementation Rules

* Use Axios interceptor:

  * Attach access token to every request
  * On 401 → attempt refresh token
  * If refresh fails → logout user

* Store tokens securely:

  * Use Secure Storage (NOT plain AsyncStorage for sensitive data)

* Maintain auth state globally (Context / Redux)

## 10.8 Offline Scenario

* If offline:

  * Keep user logged in
  * Queue API calls
  * Sync when online

---

# 10. Performance Standards

* App launch < 2 seconds
* API response < 500ms (avg)
* Smooth scrolling lists

---

# 11. Logging & Monitoring

* Log all punches
* Log failures
* Track suspicious activity

---

# 12. Backend Integration Rules

* Use REST APIs
* Proper status codes
* Pagination for large data

---

# 13. Testing Requirements

* Unit testing for logic
* Integration testing for APIs
* Real device testing (GPS accuracy)

---

# 14. Production Readiness Checklist

* No console logs
* No hardcoded values
* Proper environment configs
* Secure APIs
* Crash-free experience

---

# 15. Future Enhancements

* Route optimization
* AI-based anomaly detection
* Advanced analytics dashboard

---

# 16. Development Workflow (Critical)

Whenever development is restarted or resumed after a break, follow this strict process:

## Step 1: Backend Review

* Verify all APIs are working
* Check authentication flow
* Validate punch API (create, fetch, distance calculation)
* Confirm response structure consistency

## Step 2: Frontend Review

* Run the app and observe current flows
* Ensure navigation is smooth and consistent
* Identify any UI lag or broken states
* Validate API integration with backend

## Step 3: End-to-End Flow Validation

* Login → Dashboard → Punch → Activity
* Ensure no friction or unexpected behavior
* Fix issues before adding new features

---

# 17. Punch Screen (Enhanced UX Requirements)

The Punch Screen is the most critical part of the application and must be designed for clarity, speed, and accuracy.

## 17.1 Map View

* Full or partial screen map integration
* Show user's current location
* Display last punch or nearest punch location

## 17.2 Navigation Shortcut

* A map icon/button must be present
* On click:

  * Redirect to last punch location OR
  * Redirect to nearest punch location

## 17.3 Coordinate Display

* Bottom-left corner must show:

  * Latitude
  * Longitude
* Coordinates must update in real-time

## 17.4 Punch Action Button

* Bottom-right corner must contain punch button
* Large, accessible, and clearly visible
* Prevent multiple rapid taps

## 17.5 Punch Feedback

After punch action:

* Show confirmation instantly
* Display punch details:

  * Location
  * Time
  * Visit type
  * Status

## 17.6 Smooth Interaction Rules

* No lag while opening map
* No delay in GPS fetching
* No confusing popups
* All actions must feel instant and responsive

---

# 18. Work Progress & Implementation Log

This section tracks completed work, fixes, and improvements made to the TAS mobile application.

## 18.1 Navigation Reset Error Fix (Completed)

**Issue:** "The action 'RESET' with payload { index: 0, routes: [{ name: 'Login' }] } was not handled by any navigator."

**Root Cause:** Multiple screens were calling `navigationRef.current.reset()` directly on the NavigationContainer ref, which is incorrect for React Navigation v6+.

**Solution:** Removed all manual reset() calls. Navigation now relies on auth state changes in RootNavigator, which conditionally renders based on `isAuthenticated` status.

**Files Modified:**
- src/screens/Auth/LoginScreen.js
- src/screens/Employee/EmployeeMoreScreen.js
- src/screens/Employee/EmployeeHomeScreen.js
- src/screens/Employee/EmployeeCorrectionScreen.js
- src/screens/Employee/EmployeeAllowanceScreen.js
- src/screens/Admin/AdminDashboardScreen.js
- src/screens/SuperAdmin/SuperAdminHomeScreen.js
- src/screens/SuperAdmin/SuperAdminDashboardScreen.js

**New Files Added:**
- src/core/error/AppErrorHandler.js - Enterprise error handling system
- src/core/api/ApiResponseHandler.js - API response handler
- docs/punch_feature.md - Correction & Allowance MVP spec

## 18.2 Punch Correction & Allowance MVP

### Backend (Already Implemented)
- **Models:** CorrectionRequest, AllowanceRequest, AllowanceConfig
- **APIs:** Full CRUD + review endpoints
- **Features:** 7-day correction window, Google Geocoding, auto distance calculation, admin review workflow

### Mobile App (Already Implemented)
- **Screens:** EmployeeCorrectionScreen, PunchCorrectionScreen, EmployeeAllowanceScreen
- **API Integration:** Ready to use with backend

## 18.3 Build Outputs
- Debug APK: android/app/build/outputs/apk/debug/app-debug.apk
- Release APK: android/app-release-v1.2.apk

---

# 19. Punch Correction & Approval System (Enterprise Level)

This section defines a complete enterprise-grade correction and allowance system with strict approval workflow, audit trail, and real-time status visibility.

---

## 19.1 Punch Correction System

### 19.1.1 Edit Punch (Restricted Editing)

Employees can edit existing punches within a controlled time window.

**Rules:**

* Editable only within **0–4 days** from punch date
* Only specific fields can be edited:

  * loan_id
  * amount
  * visit_type
  * payment_type (cash / UPI / cheque)

**Restrictions:**

* Location, time, and GPS data CANNOT be modified
* All edits must create a CorrectionRequest (no direct update)
* Full audit trail required

**Implementation:**
```python
# Create CorrectionRequest, do NOT update punch directly
correction = CorrectionRequest.objects.create(
    employee=user,
    correction_type='EDIT',
    original_punch=punch,
    requested_changes={'loan_id': 'NEW', 'amount': 5000},
    status='PENDING'
)
```

**Audit Fields Required:**
* edited_by (FK to User)
* edited_at (DateTime)
* old_values (JSON - snapshot before)
* new_values (JSON - requested changes)
* reason (Text)

---

### 19.1.2 Delete Punch (Soft Delete Only)

**Rules:**

* Same-day delete → approval required
* After same day → higher authority approval required
* NO hard delete allowed

**Required Fields in DB:**

* punch_id (FK)
* user_id (FK)
* deleted_by (FK - who requested)
* approved_by (FK - who approved)
* deleted_at (DateTime)
* reason (Text - user's reason for deletion)
* rejection_reason (Text - if rejected)
* original_data_snapshot (JSON - full punch data for audit)

**Implementation:**
```python
# Soft delete - mark as DELETED, do NOT remove
punch = AttendancePunch.objects.get(id=punch_id)
punch.status = 'DELETED'
punch.deleted_by = user
punch.deleted_at = now()
punch.save()

# Store full snapshot for audit
CorrectionRequest.objects.create(
    employee=user,
    correction_type='DELETE',
    original_punch=punch,
    original_snapshot=punch.__dict__,  # Full snapshot
    status='PENDING'
)
```

---

### 19.1.3 Add Punch (Missed Punch Entry)

This is a controlled feature for adding missed punches after the fact.

**Input Fields:**

* correction_type: ADD
* punch_type: PUNCH_IN (only)
* visit_type: COLLECTION | DISBURSEMENT | null
* correction_date: DateField
* correction_time: TimeField
* from_address: CharField (required)
* from_pincode: CharField (6 digits)
* to_address: CharField (optional)
* to_pincode: CharField (optional)
* reason: Text (required)
* travel_with: alone | employee
* calculated_distance: FloatField (auto-calculated, READ-ONLY)

**Distance Calculation Rules:**

1. **UI:** Distance input field is DISABLED
2. **Backend:** Uses Google Maps Geocoding API
3. **Flow:**
   - User fills addresses → clicks "Calculate Distance"
   - Backend geocodes addresses
   - Backend calculates distance
   - Returns calculated_distance to UI
   - User reviews → submits request

**Implementation:**
```python
# Backend calculates distance - user cannot edit
from common.services.geocoding import geocode_address, calculate_distance

from_lat, from_lng = geocode_address(from_address)
to_lat, to_lng = geocode_address(to_address) if to_address else (None, None)

calculated_distance = calculate_distance(from_lat, from_lng, to_lat, to_lng)

# Create request with calculated distance
correction = CorrectionRequest.objects.create(
    employee=user,
    correction_type='ADD',
    from_address=from_address,
    from_latitude=from_lat,
    from_longitude=from_lng,
    to_address=to_address,
    to_latitude=to_lat,
    to_longitude=to_lng,
    calculated_distance=calculated_distance,
    status='PENDING'
)
```

---

## 19.2 Approval Workflow System

### 19.2.1 Default Flow

```
User → Admin → Superadmin
```

**Behavior:**

1. User creates correction request
2. Request sent to assigned Admin
3. Admin approves/rejects with reason
4. If Superadmin override needed → escalated

### 19.2.2 Status Tracking

All requests must track WHO approved/rejected:

**Required Fields:**
```python
class CorrectionRequest(models.Model):
    status = models.CharField(choices=[
        ('PENDING', 'Pending'),
        ('ADMIN_APPROVED', 'Approved by Admin'),
        ('ADMIN_REJECTED', 'Rejected by Admin'),
        ('SUPERADMIN_APPROVED', 'Approved by Superadmin'),
        ('SUPERADMIN_REJECTED', 'Rejected by Superadmin'),
    ])

    # Approval tracking
    reviewed_by = models.ForeignKey(User, related_name='reviewed_corrections')
    reviewed_at = models.DateTimeField()
    review_comment = models.TextField()
    review_level = models.CharField()  # ADMIN | SUPERADMIN

    # Audit trail
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
```

**Real-Time Status Display:**

Each status change must show:
- Current status (PENDING/APPROVED/REJECTED)
- Who made the decision (reviewed_by)
- When (reviewed_at)
- Comment/Reason (review_comment)
- What level (ADMIN/SUPERADMIN)

---

## 19.3 Dynamic Approval Hierarchy

Superadmin has full control over approval routing.

### Capabilities:

1. **Assign Admin to Users:**
   ```
   UserA → AdminB
   UserB → AdminA
   ```

2. **Multi-Level Chains:**
   ```
   UserC → AdminA → Superadmin
   ```

3. **Dynamic Reassignment:**
   - Change reflects instantly in approval flow
   - Only Superadmin can modify

### Implementation:
```python
class UserApprovalHierarchy(models.Model):
    user = models.ForeignKey(User, related_name='approval_chain')
    admin = models.ForeignKey(User, role='ADMIN')
    superadmin = models.ForeignKey(User, role='SUPERADMIN')
    level = models.IntegerField()  # 1, 2, 3
    is_active = models.BooleanField(default=True)

    # Superadmin sets this per user
```

---

## 19.4 Approval Window System

Approval windows control when users can submit corrections.

### Default Windows:

| Window | Start | End |
|--------|-------|-----|
| First Half | 1st | 15th |
| Second Half | 16th | End of month |

### Rules:

1. **Active Window:** Users CAN submit requests
2. **Closed Window:** Users CANNOT submit
3. **Lock:** After window closes, entries are locked

### Superadmin Controls:

1. Modify date ranges dynamically
2. Override window for specific users
3. Extend window if needed

### Implementation:
```python
class ApprovalWindow(models.Model):
    name = models.CharField()  # "First Half Jan 2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

    # Check if window is active
    def is_open(self):
        today = timezone.now().date()
        return self.is_active and self.start_date <= today <= self.end_date
```

---

## 19.5 Notification System

### Triggers:

| Trigger | When | Recipients |
|---------|------|------------|
| Window Open | 1st / 16th | All users |
| Window Closing | Day before close | All users |
| Window Closed | After close | Users with pending requests |
| Request Approved | Approval happens | User who submitted |
| Request Rejected | Rejection happens | User who submitted + reason |

### Implementation:
```python
class Notification(models.Model):
    recipient = models.ForeignKey(User)
    title = models.CharField()
    message = models.TextField()
    type = models.CharField()  # WINDOW_OPEN, APPROVED, REJECTED
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField()
```

---

## 19.6 Enterprise Rules

1. **No Direct Updates:** Every change goes through CorrectionRequest
2. **Soft Delete Only:** Never hard delete punch records
3. **Full Audit Trail:** All actions logged with user, timestamp, old/new values
4. **Backend Distance:** Distance ALWAYS calculated by backend
5. **Role-Based Access:** Strict enforcement
6. **Approval Required:** All corrections need approval
7. **Status Visibility:** Real-time status visible to all roles

---

# 20. Allowance System (Enterprise Logic)

Allowance calculation and application must support both manual and system-driven workflows.

---

## 20.1 Manual Allowance (User Applied)

Based on missed punches or manually added entries by the user.

### Source:

* Added punches (correction_type=ADD)
* Corrected punch data

### Flow:

```
User submits Add Punch request
→ Admin approves
→ System calculates distance
→ Allowance = distance × rate_per_km
→ Added to user's manual allowance
```

### Rules:

1. User CANNOT edit allowance amount
2. Amount MUST be system-derived
3. MUST be linked with punch record
4. Goes through same approval hierarchy

### Implementation:
```python
class AllowanceRequest(models.Model):
    SOURCE_TYPE = [
        ('MANUAL', 'Manual - User Applied'),
        ('SYSTEM', 'System - Auto Calculated'),
    ]

    employee = models.ForeignKey(User)
    source_type = models.CharField(choices=SOURCE_TYPE)
    punch = models.ForeignKey('AttendancePunch', null=True)  # Linked punch
    correction = models.ForeignKey('CorrectionRequest', null=True)

    total_distance = models.FloatField()
    amount = models.DecimalField()

    # Linked punch reference
    punch_id = models.IntegerField(null=True)
    punch_date = models.DateField(null=True)

    status = models.CharField(choices=STATUS_CHOICES)
```

---

## 20.2 System-Based Allowance (Auto Calculated)

Based on total travel done by the user in a month.

### Source:

* All valid punches (status=ACTIVE)
* Total distance traveled

### Calculation:

```
Monthly Allowance = Sum(valid_punches.distance) × rate_per_km
                OR
Monthly Allowance = Apply Slab Rules
```

### Slab-Based Example:

| Distance (km) | Rate (₹/km) |
|---------------|------------|
| 0-100         | 10         |
| 101-250      | 8          |
| 251-500      | 6          |
| 500+         | 5          |

### Rules:

1. Fully backend controlled
2. No manual intervention
3. Auto-generated monthly
4. Locked after cycle completion

### Implementation:
```python
class MonthlyAllowance(models.Model):
    employee = models.ForeignKey(User)
    month = models.IntegerField()  # 1-12
    year = models.IntegerField()

    total_distance = models.FloatField()
    rate_applied = models.DecimalField()
    total_amount = models.DecimalField()

    punches_count = models.IntegerField()
    is_locked = models.BooleanField(default=False)

    # Auto-calculate
    def calculate(self):
        punches = AttendancePunch.objects.filter(
            employee=self.employee,
            punch_date__month=self.month,
            punch_date__year=self.year,
            status='ACTIVE'
        )
        self.total_distance = punches.aggregate(Sum('distance_from_last'))['distance__sum']
        self.punches_count = punches.count()
        # Apply rate rules
        self.rate_applied = self.get_rate_for_distance(self.total_distance)
        self.total_amount = self.total_distance * self.rate_applied
        self.save()
```

---

## 20.3 Manual + System Allowance Rules

1. **No Conflict:** Both must be tracked separately
2. **Traceable:** Each entry must show source (punch/distance)
3. **Approval Required:** Manual entries need approval
4. **Locked:** Monthly allowance locked after cycle

---

# 21. Approval Status Dashboard (Enterprise Visibility)

A unified approval tracking system must be implemented across User, Admin, and Superadmin interfaces with REAL-TIME status updates showing WHO approved/rejected.

---

## 21.1 Core Status Types

All correction and allowance requests must have standardized statuses:

| Status | Description | Show Approver? |
|--------|------------|----------------|
| PENDING | Waiting for review | No |
| ADMIN_APPROVED | Approved by Admin | YES - name + time |
| ADMIN_REJECTED | Rejected by Admin | YES - name + reason |
| SUPERADMIN_APPROVED | Approved by Superadmin | YES - name + time |
| SUPERADMIN_REJECTED | Rejected by Superadmin | YES - name + reason |

**Required Response Fields:**
```json
{
  "id": 1,
  "user_id": 123,
  "correction_type": "ADD",
  "status": "ADMIN_APPROVED",
  "created_at": "2026-01-15T09:00:00Z",

  // Real-time approver info
  "reviewed_by": {
    "id": 45,
    "name": "John Admin",
    "role": "ADMIN"
  },
  "reviewed_at": "2026-01-15T14:30:00Z",
  "review_comment": "Approved - valid proof provided",
  "review_level": "ADMIN"
}
```

---

## 21.2 User View (Employee)

### Home Screen Widget

**Show REAL-TIME counts:**
```
┌─────────────────────────────────────┐
│  My Requests                        │
│  ───────────────────────────────── │
│  🟡 Pending:  3                   │
│  🟢 Approved: 12                   │
│  🔴 Rejected: 2                     │
└─────────────────────────────────────┘
```

### Detailed Screen

**Filters:**
* Status (Pending / Approved / Rejected)
* Date range
* Type (Edit / Delete / Add Punch)

**Each Request Shows:**
```
┌────────────────────────────────────────────────────┐
│ ADD Punch - Jan 15, 2026                           │
│ Status: 🟢 ADMIN_APPROVED                         │
│ ────────────────────────────────────────────────── │
│  Approved by: John Admin (Branch A)              │
│  At: Jan 15, 2026 at 2:30 PM                    │
│  Comment: Approved - valid proof               │
│ ────────────────────────────────────────────────── │
│  [View Details]  [Delete Request]               │
└────────────────────────────────────────────────────┘
```

### Rejected Request (Must Show Reason):
```
┌────────────────────────────────────────────────────┐
│ EDIT Punch - Jan 10, 2026                         │
│ Status: 🔴 ADMIN_REJECTED                        │
│ ────────────────────────────────────────────────── │
│  Rejected by: Jane Admin                         │
│  At: Jan 12, 2026 at 10:15 AM                  │
│  Reason: Proof document not attached            │
│  [Resubmit with Proof]                           │
└────────────────────────────────────────────────────┘
```

---

## 21.3 Admin View (Approvals Screen)

### Dashboard with Real-Time Updates

**Request List Shows:**
```
┌────────────────────────────────────────────────────────────────┐
│ Pending Approvals (5)                            [Refresh]    │
├────────────────────────────────────────────────────────────────┤
│ [Filter: All | My Branch | All Branches] [Search: _________]   │
├────────────────────────────────────────────────────────────────┤
│ Employee      Type      Date      Status    Actions             │
│ ──────────────────────────────────────────────────────────  │
│ Raman K      ADD      Jan 15    PENDING  [✓] [✗]             ���
�� Amit S       EDIT     Jan 14    PENDING  [✓] [✗]             │
│ Suresh M     DELETE   Jan 13    PENDING  [✓] [✗]             │
└────────────────────────────────────────────────────────────────┘
```

### Actions:

**Approve Modal:**
```
┌─────────────────────────────────┐
│ Approve Request                 │
├─────────────────────────────────┤
│ Employee: Raman K              │
│ Type: ADD Punch                │
│ Date: Jan 15, 2026             │
│ Distance: 12.5 km              │
│                                 │
│ Comment (optional): ________   │
│                                 │
│       [Cancel]  [Approve]      │
└─────────────────────────────────┘
```

**Reject Modal (Mandatory Reason):**
```
┌─────────────────────────────────┐
│ Reject Request                  │
├─────────────────────────────────┤
│ Employee: Raman K              │
│ Type: ADD Punch                │
│                                 │
│ Reason *: _____________       │
│ (This field is required)       │
│                                 │
│       [Cancel]  [Reject]      │
└─────────────────────────────────┘
```

---

## 21.4 Superadmin View (Full Control)

### Dashboard Overview

**Shows ALL requests with hierarchy info:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Approval Overview                           [Export] [Filter]            │
├──────────────────────────────────────────────────────────────────────┤
│ Total: 156   Pending: 12   Approved: 130   Rejected: 14            │
├──────────────────────────────────────────────────────────────────────┤
│ By Level:                                                        │
│ Admin Approvals: 118 | Superadmin Overrides: 14                    │
├──────────────────────────────────────────────────────────────────────┤
│ Employee      Type      Date      Status     By       Level       │
│ ─────────────────────────────────────────────────────────────────  │
│ Raman K      ADD      Jan 15    APPROVED   John A    ADMIN          │
│ Suresh M     DELETE  Jan 13    REJECTED  Jane S    SUPERADMIN    │
└──────────────────────────────────────────────────────────────────────┘
```

### Features:

1. **Override Decision:** Can change any approval
2. **Reassign:** Move request to different admin
3. **View Audit Trail:** Complete history of changes

---

## 21.5 Backend Implementation

### APIs Required:

```python
# Get pending requests for admin
GET /api/attendance/correction-requests/pending/

# Get user's own requests with status
GET /api/attendance/correction-requests/my_requests/

# Review (approve/reject) with tracking
POST /api/attendance/correction-requests/{id}/review/
{
    "action": "APPROVE|REJECT",
    "comment": "Optional comment"
}
# Response includes: reviewed_by, reviewed_at, review_level
```

### Response Model:
```python
class CorrectionRequestSerializer(serializers.ModelSerializer):
    reviewed_by = UserSerializer(read_only=True)

    class Meta:
        model = CorrectionRequest
        fields = [
            'id', 'employee', 'correction_type', 'status',
            'created_at', 'updated_at',
            'reviewed_by', 'reviewed_at', 'review_comment', 'review_level'
        ]
```

---

## 21.6 Real-Time Updates

### Option 1: Polling (Current)
```javascript
// Poll every 30 seconds
setInterval(() => {
    fetchMyRequests();
}, 30000);
```

### Option 2: WebSocket (Future)
```python
# When status changes, emit event
async def review(self, request, pk=None):
    # ... process approval
    await self.channel_layer.send(
        group=f"user_{request.employee_id}",
        message={"type": "status_update", "data": ...}
    )
```

---

## 21.7 UI/UX Guidelines

### Color Coding:

| Status | Color | Badge |
|--------|-------|-------|
| PENDING | Yellow (#FFC107) | 🟡 Pending |
| ADMIN_APPROVED | Green (#4CAF50) | 🟢 Approved |
| ADMIN_REJECTED | Red (#F44336) | 🔴 Rejected |
| SUPERADMIN_APPROVED | Green | 🟢 Superadmin Approved |
| SUPERADMIN_REJECTED | Red | 🔴 Superadmin Rejected |

### Components:

* Status badges with approver name
* Timeline view for each request
* Expandable cards with full details
* "Refresh" button for manual update

---

# 22. Recent Updates & Changes (April 2026)

This section documents all recent implementation updates and fixes.

---

## 22.1 SSE (Server-Sent Events) Implementation

### Backend Changes

**New Files:**
- `backend/common/services/sse_service.py` - SSE event manager

**Modified Files:**
- `backend/apps/notifications/views.py` - Added SSE endpoints
- `backend/apps/notifications/urls.py` - Added SSE URL routes
- `backend/apps/attendance/models.py` - Added `cumulative_distance` field
- `backend/apps/attendance/views.py` - Updated distance calculation with cumulative tracking

**SSE Events:**
- `punch_created` - When new punch is created
- `correction_created` - When correction request is submitted
- `correction_approved` - When correction is approved
- `correction_rejected` - When correction is rejected
- `allowance_created` - When allowance is applied
- `allowance_approved` - When allowance is approved

**Backend Endpoint:**
```
GET /api/v1/notifications/events/
```

---

## 22.2 Cumulative Distance Tracking

**Formula:**
- `distance_from_last` = Segment distance (A→B)
- `cumulative_distance` = Running total (A→B + A→B→C + ...)

**Example:**
A → B → C → D → E → return to A
- A→B: 5km (cumulative: 5)
- B→C: 6km (cumulative: 11)
- C→D: 9km (cumulative: 20)
- D→E: 8km (cumulative: 28)
- E→A: 15km (cumulative: 43)

**Backend Implementation:**
```python
# In AttendancePunch model
cumulative_distance = models.FloatField(default=0)  # Running total from start

# Recalculate on each punch
def _recalculate_employee_routes(self, employee):
    punches = AttendancePunch.objects.filter(employee=employee).order_by('punched_at')
    running_total = 0
    for punch in punches:
        running_total += punch.distance_from_last or 0
        punch.cumulative_distance = running_total
        punch.save()
```

---

## 22.3 Mobile SSE Integration

**New Files:**
- `src/services/SSEClient.js` - SSE client for mobile (polling-based)
- `src/hooks/useSkeletonLoader.js` - Skeleton loading hook

**Modified Files:**
- `src/context/AuthContext.js` - Added SSE connect on login, disconnect on logout

**Implementation:**
```javascript
// Connect on login
import SSEClient from '../services/SSEClient';

const login = useCallback(async (username, password) => {
    // ... login logic
    SSEClient.connect();
}, []);

// Disconnect on logout
const logout = useCallback(async () => {
    await api.logout();
    SSEClient.disconnect();
    // ... clear tokens
}, []);

// Event listeners
SSEClient.onCorrection((data) => {
    console.log('[Auth] Correction event received:', data);
});
```

**Event Types:**
- `correction_approved`
- `correction_rejected`
- `correction_created`
- `allowance_approved`
- `allowance_rejected`
- `punch_created`

---

## 22.4 Backend Fixes

### Correction Review 500 Error Fix

**Issue:** POST to `/correction-requests/{id}/review/` returns 500 Internal Server Error

**Root Cause:**
1. Missing `select_related` for related fields (`employee`, `reviewed_by`)
2. No error handling in serialization

**Solution:**
```python
# Added select_related to queryset
class CorrectionRequestViewSet(viewsets.ModelViewSet):
    queryset = CorrectionRequest.objects.select_related('employee', 'reviewed_by').all()
    
    def get_queryset(self):
        user = self.request.user
        if user.role.name == 'SUPER_ADMIN':
            return CorrectionRequest.objects.select_related('employee', 'reviewed_by').all()
        if user.role.name == 'ADMIN':
            return CorrectionRequest.objects.select_related('employee', 'reviewed_by').filter(
                employee__branch=user.branch
            )
        return CorrectionRequest.objects.select_related('employee', 'reviewed_by').filter(employee=user)
```

**Branch:** `fix/correction-review-error`

---

## 22.5 Skeleton Loader Feature

**New Hook:**
```javascript
// src/hooks/useSkeletonLoader.js
import { useState, useCallback } from 'react';

export const useSkeletonLoader = (initialLoading = true) => {
  const [loading, setLoading] = useState(initialLoading);
  const [data, setData] = useState(null);

  const startLoading = useCallback(() => setLoading(true), []);
  const stopLoading = useCallback((newData = null) => {
    setLoading(false);
    if (newData) setData(newData);
  }, []);

  return { loading, data, startLoading, stopLoading, setLoading };
};
```

**Existing Components:**
- `src/common/components/SkeletonLoader.js`
- `src/components/SkeletonActivityList.js`
- `src/components/SkeletonComponents.js`

---

## 22.6 Git Workflow

**Current Branching Strategy:**
1. Each fix/task → new branch
2. Commit changes
3. Push to remote
4. Create PR (wait for approval before merging to main)

**Backend Branches:**
- `main` - Main production branch
- `fix/correction-review-error` - Fix for correction review 500 error

**Mobile Branches:**
- `feature/ui-correction-employee` - Employee correction UI
- `fix/sse-integration` - SSE integration

---

## 22.7 API Endpoints Summary

### Attendance
```
GET    /api/v1/attendance/correction-requests/
POST   /api/v1/attendance/correction-requests/
GET    /api/v1/attendance/correction-requests/{id}/
POST   /api/v1/attendance/correction-requests/{id}/review/
GET    /api/v1/attendance/correction-requests/my_requests/
```

### Notifications (SSE)
```
GET    /api/v1/notifications/events/
```

### Distance Calculation
- Mobile calculates using Google Distance Matrix API
- Sends `calculated_distance` to backend
- Backend prioritizes mobile-provided distance
- Falls back to backend calculation if not provided

---

## 22.8 Known Issues (Resolved)

1. **Navigation Reset Error** - Fixed by removing manual reset() calls
2. **Distance showing 0** - Mobile now calculates and sends to backend
3. **Correction review 500** - Added select_related and error handling
4. **SSE import error** - Fixed import path `./api` → `../api/api`

---

# Conclusion

This application must behave like a real enterprise-grade field tracking system. Every feature must be reliable, secure, and scalable. No shortcuts should be taken that compromise data integrity or user trust.

The goal is to build a production-ready mobile application that can handle large-scale usage with accuracy and stability.
