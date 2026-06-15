# Punch Correction & Allowance Feature Specification

## Overview

This document defines the MVP for Punch Correction & Allowance system across:
- Backend (API + DB)
- Frontend (Web Admin Panel)
- TAS-Mobile (React Native App)

---

## 1. Backend (Core System)

### 1.1 Models (Already Implemented)

#### CorrectionRequest
```python
# Location: backend/apps/attendance/models.py - Line 283-379

Fields:
- id (BigAutoField)
- employee (ForeignKey → User)
- correction_type: ADD | EDIT | DELETE
- original_punch (ForeignKey → AttendancePunch, nullable)
- correction_date, correction_time
- punch_type: PUNCH_IN | PUNCH_OUT
- visit_type (nullable)
- loan_id, amount, payment_method
- from_address, pincode, from_latitude, from_longitude
- to_address, to_latitude, to_longitude
- punch_sequence (JSONField - array of punch points)
- calculated_distance (FloatField)
- reason (TextField)
- status: PENDING | APPROVED | REJECTED
- reviewed_by, reviewed_at, review_comment
- created_at, updated_at
```

#### AllowanceRequest
```python
# Location: backend/apps/allowance/models.py - Line 8-73

Fields:
- id (BigAutoField)
- employee (ForeignKey → User)
- travel_date
- from_location, to_location
- total_distance
- amount
- reason
- status: DRAFT | PENDING | APPROVED | REJECTED | PAID
- loan_id
- approved_by, approved_at
- rejection_reason
- created_at, updated_at
```

#### AllowanceConfig
```python
# Location: backend/apps/allowance/models.py - Line 123-127

Fields:
- per_km: DecimalField (rate per kilometer)
```

### 1.2 Core Logic (Already Implemented)

#### Correction Window
- Default: 7 days (configurable via CorrectionSettings)
- Checked in `CorrectionRequestViewSet.create()` - Line 840-850
- Uses `CorrectionSettings.correction_window_days`

#### Distance Calculation
- Uses Google Geocoding API via `common.services.geocoding`
- Calculates distance between from/to addresses
- Stores in `calculated_distance`

#### Approval Flow
- User submits correction → Admin reviews → Approve/Reject
- `_process_correction()` handles approved corrections
- Creates/Edits/Deletes actual AttendancePunch records

### 1.3 APIs (Already Implemented)

#### Correction Requests
| Method | Endpoint | Description |
|--------|-----------|-------------|
| GET | `/api/attendance/correction-requests/` | List all (admin sees all, employee sees own) |
| GET | `/api/attendance/correction-requests/my_requests/` | Employee's own requests |
| GET | `/api/attendance/correction-requests/pending/` | Admin: pending requests only |
| POST | `/api/attendance/correction-requests/` | Create correction request |
| POST | `/api/attendance/correction-requests/{id}/review/` | Admin: approve/reject |

**Create Request Body:**
```json
{
  "correction_type": "ADD|EDIT|DELETE",
  "original_punch_id": 123 (for EDIT/DELETE only),
  "correction_date": "2024-01-15",
  "correction_time": "09:00",
  "punch_type": "PUNCH_IN|PUNCH_OUT",
  "visit_type": "COLLECTION|DISBURSEMENT|null",
  "from_address": "123 Main St, City",
  "pincode": "123456",
  "to_address": "456 Other St, City|null",
  "reason": "Reason for correction",
  "amount": 5000.00 (optional),
  "loan_id": "LOAN-123 (optional)"
}
```

**Review Request Body:**
```json
{
  "action": "APPROVE|REJECT",
  "comment": "Optional review comment"
}
```

#### Allowance Requests
| Method | Endpoint | Description |
|--------|-----------|-------------|
| GET | `/api/allowance/` | List all allowances |
| POST | `/api/allowance/` | Submit allowance claim |
| POST | `/api/allowance/{id}/approve/` | Admin: approve |
| POST | `/api/allowance/{id}/reject/` | Admin: reject |
| GET | `/api/allowance/{id}/` | Get allowance details |

---

## 2. Frontend (Web Admin Panel)

### 2.1 API Integration Required

The frontend needs to integrate with backend APIs:

```javascript
// Correction API
GET /api/attendance/correction-requests/pending/ → Admin sees all pending
GET /api/attendance/correction-requests/?status=PENDING → Filter by status
POST /api/attendance/correction-requests/{id}/review/ → Approve/Reject

// Allowance API
GET /api/allowance/?status=PENDING → Pending allowances
POST /api/allowance/{id}/approve/ → Approve
POST /api/allowance/{id}/reject/ → Reject
```

### 2.2 Screens Required

#### Approval Dashboard
- **Tabs:** Pending | Approved | Rejected
- **Filters:** By user, request type, date range
- **Actions:**
  - Approve button
  - Reject button (with reason input modal)
  - View details modal

---

## 3. TAS-Mobile (Employee App)

### 3.1 Existing Screens ✅

| Screen | File | Status |
|--------|------|--------|
| Correction List | `src/screens/Employee/EmployeeCorrectionScreen.js` | ✅ Exists |
| Punch Correction | `src/screens/Common/PunchCorrectionScreen.js` | ✅ Exists |
| Allowance Screen | `src/screens/Employee/EmployeeAllowanceScreen.js` | ✅ Exists |

### 3.2 API Endpoints to Use

```javascript
// src/api/api.js - Add these methods:

// Corrections
getMyCorrectionRequests() → GET /attendance/correction-requests/my_requests/
createCorrectionRequest(data) → POST /attendance/correction-requests/
reviewCorrection(id, action, comment) → POST /attendance/correction-requests/{id}/review/

// Allowances
getMyAllowances() → GET /allowance/
createAllowance(data) → POST /allowance/
```

### 3.3 UX Rules (Must Follow)

1. **Correction Window**
   - Disable edit after 7 days (from correction date)
   - Show message: "Corrections only allowed within X days"

2. **Address Input**
   - Use Google Places Autocomplete
   - Don't allow manual distance input
   - Calculate distance on backend

3. **Status Display**
   - Show status badges: 🟡 Pending | 🟢 Approved | 🔴 Rejected
   - Show rejection reason if available

4. **Loading States**
   - Show loading while calculating distance
   - Disable submit button during API call

---

## 4. Data Flow

### Example: Add Punch Correction

```
1. Employee opens Punch Correction screen
2. Fills form:
   - Date: 2024-01-15
   - Time: 09:00
   - From Address: Shop A
   - To Address: Customer Location
   - Reason: Missed punch
3. App calls POST /api/attendance/correction-requests/
4. Backend:
   - Validates 7-day window
   - Geocodes addresses
   - Calculates distance
   - Creates CorrectionRequest (status=PENDING)
5. App shows: "Request submitted for approval"
6. Admin sees in dashboard
7. Admin clicks Approve
8. Backend creates AttendancePunch
9. App updates status to APPROVED
```

---

## 5. Enterprise Rules

| Rule | Implementation |
|------|----------------|
| No direct DB updates | All go through CorrectionRequest |
| 7-day correction window | CorrectionSettings.correction_window_days |
| No hard delete | is_deleted flag on AttendancePunch |
| Distance backend-calculated | Google Geocoding API |
| Audit trail | reviewed_by, reviewed_at, review_comment |
| Multi-level approval | User → Admin workflow |

---

## 6. Build Commands

### Backend
```bash
cd backend
python manage.py migrate
python manage.py runserver
```

### TAS-Mobile
```bash
cd TASmobile
# Debug APK
cd android && ./gradlew assembleDebug
# Release APK
cd android && ./gradlew assembleRelease
```

---

## 7. Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Models | ✅ Ready | CorrectionRequest, AllowanceRequest |
| Backend APIs | ✅ Ready | CRUD + review endpoints |
| Frontend Web | ⚠️ TODO | Needs API integration |
| Mobile App | ✅ Ready | Existing screens |
| Distance Calc | ✅ Ready | Google Geocoding API |
| Approval Flow | ✅ Ready | Admin review workflow |

---

## 8. Next Steps

1. **Frontend:** Create/update admin web panel to use existing APIs
2. **Mobile App:** Verify existing screens work with backend APIs
3. **Testing:** Test full correction flow on multiple devices
4. **Build:** Generate release APKs for field testing