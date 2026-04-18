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

# Conclusion

This application must behave like a real enterprise-grade field tracking system. Every feature must be reliable, secure, and scalable. No shortcuts should be taken that compromise data integrity or user trust.

The goal is to build a production-ready mobile application that can handle large-scale usage with accuracy and stability.
