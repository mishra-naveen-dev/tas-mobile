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

This section defines how employees can edit, delete, and add punches with a strict approval workflow.

---

## 19.1 Edit Punch (Restricted Editing)

Employees can edit existing punches within a controlled time window.

### Rules:

* Editable only within **0–4 days** from punch date
* Only specific fields can be edited:

  * loan_id
  * amount
  * visit_type
  * payment_type (cash / UPI / cheque)

### Restrictions:

* Location, time, and GPS data cannot be modified
* All edits must be logged

### Audit Fields:

* edited_by
* edited_at
* previous_value (history tracking)

---

## 19.2 Delete Punch (Controlled + Audited)

### Rules:

* Same-day delete → allowed with approval
* After same day → requires higher authority approval

### Critical Requirement:

Deleted punches must NOT be permanently removed.

### Store in DB:

* punch_id
* user_id
* deleted_by
* approved_by
* deleted_at
* reason
* original data snapshot

### Behavior:

* Mark as "DELETED" (soft delete)
* Maintain full audit trail

---

## 19.3 Add Punch (Missed Punch Entry – Complex Flow)

This is a controlled feature for adding missed punches.

### Input Fields:

* punch_type (only Punch In)
* visit_type
* date
* time
* from_address
* from_pincode
* to_address
* to_pincode
* reason
* travel_with (alone / employee)
* distance (auto-calculated, non-editable)

### Distance Calculation:

* Initially disabled in UI
* Backend calculates using **Google Maps API**
* Based on from_address → to_address
* Automatically returned and displayed

### Rules:

* User cannot manually edit distance
* Submission only after distance calculation

---

## 19.4 Approval Workflow System

All correction actions (Edit / Delete / Add Punch) must go through approval hierarchy.

### Default Flow:

User → Admin → Superadmin

### Behavior:

* Request created by user
* Sent to assigned Admin
* Admin approves/rejects
* If required → escalated to Superadmin

---

## 19.5 Dynamic Approval Hierarchy (Superadmin Control)

Superadmin must have full control over approval routing.

### Capabilities:

* Assign specific Admin to specific Users

* Example:

  * UserA → AdminB
  * UserB → AdminA

* Configure multi-level approval chains

* Modify approval roles dynamically

### Rules:

* Only Superadmin can change hierarchy
* Changes must reflect instantly in approval flow

---

## 19.6 Approval Window System

Approval requests must follow fixed time windows.

### Default Windows:

* 1st – 15th of month
* 16th – End of month

### Behavior:

* Users can submit correction requests only within active window
* After window closes:

  * No new requests allowed
  * System locks entries

### Superadmin Control:

* Can modify date ranges dynamically

---

## 19.7 Notifications System

### Triggers:

* When approval window opens → notify users
* Before window closes → reminder notification
* After window closes → notify missed users

### Purpose:

* Ensure users apply for missed punches on time

---

## 19.8 Enterprise Rules

* Every action must be auditable
* No hard delete allowed
* Approval is mandatory for all corrections
* Distance must always be system-calculated
* Role-based access must be strictly enforced

---

# 20. Allowance System (Enterprise Logic)

Allowance calculation and application must support both manual and system-driven workflows.

---

## 20.1 Manual Allowance (User Applied)

This is based on missed punches or manually added entries by the user.

### Source:

* Add Punch (missed entry)
* Corrected punch data

### Behavior:

* Allowance is calculated based on:

  * Distance (auto-calculated)
  * Visit type
  * Organization rules

### Flow:

* User adds missed punch
* Distance is calculated via backend
* Allowance value derived from that distance
* Submitted for approval (same approval hierarchy)

### Rules:

* User cannot manually edit allowance amount
* Amount must always be system-derived
* Linked directly with punch record

---

## 20.2 System-Based Allowance (Auto Calculated)

This is based on total travel done by the user in a month.

### Source:

* All valid punches
* Route tracking data
* Total distance traveled

### Behavior:

* System calculates total monthly distance
* Applies organization policy:

  * Rate per km
  * Slab-based allowance
  * Fixed + variable structure (if applicable)

### Output:

* Monthly allowance summary
* Auto-generated record for user

### Rules:

* Fully backend controlled
* No manual intervention
* Must be transparent and auditable

---

## 20.3 Enterprise Rules

* Manual and system allowances must not conflict
* Each allowance entry must be traceable to source (punch / distance)
* Approval required for manual entries
* Monthly allowance must be auto-generated and locked after cycle

---

# 21. Approval Status Dashboard (Enterprise Visibility)

A unified approval tracking system must be implemented across User, Admin, and Superadmin interfaces.

---

## 21.1 Core Status Types

All correction and allowance requests must have standardized statuses:

* PENDING
* APPROVED
* REJECTED

Each request must include:

* request_id
* user_id
* request_type (Edit / Delete / Add Punch / Allowance)
* status
* created_at
* updated_at
* approved_by
* rejection_reason (if rejected)

---

## 21.2 User View (Employee)

### Home Screen Integration

* Show summary widget:

  * Pending Requests Count
  * Approved Requests Count
  * Rejected Requests Count

### Detailed Screen

* List all requests with filters:

  * Status (Pending / Approved / Rejected)
  * Date range

### Behavior:

* User can track status in real-time
* Rejected requests must show reason
* Approved requests must show approver details

---

## 21.3 Admin View

### Dashboard

* List of all requests from assigned users

### Features:

* Filter by:

  * Status
  * User
  * Date
  * Request type

### Actions:

* Approve
* Reject (mandatory reason)

### Rules:

* Cannot modify request data
* Only decision allowed

---

## 21.4 Superadmin View

### Full Control Dashboard

* Access to all requests across organization

### Features:

* Override decisions
* Reassign approvals
* View complete audit trail

### Filters:

* Region / Branch / User
* Status / Type / Date

---

## 21.5 UI/UX Guidelines

### Design Requirements:

* Clean tab-based UI:

  * Pending | Approved | Rejected
* Color Coding:

  * Pending → Yellow
  * Approved → Green
  * Rejected → Red

### Components:

* Status badges
* Timeline view for each request
* Expandable cards with details

### Performance:

* Pagination for large data
* Lazy loading

---

## 21.6 Backend Requirements

* Centralized Approval Table
* Status-based indexing for fast queries
* Audit logs for every action

### APIs:

* GET /approvals?status=pending
* POST /approvals/{id}/approve
* POST /approvals/{id}/reject

---

## 21.7 Real-Time Updates

* Use polling or websocket (future)
* Refresh status automatically
* Notify user on status change

---

## 21.8 Enterprise Rules

* Status must be consistent across all roles
* No data duplication
* Every action must be logged
* UI must reflect backend truth only

---

# Conclusion

This application must behave like a real enterprise-grade field tracking system. Every feature must be reliable, secure, and scalable. No shortcuts should be taken that compromise data integrity or user trust.

The goal is to build a production-ready mobile application that can handle large-scale usage with accuracy and stability.
