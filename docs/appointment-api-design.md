# Donfra Appointment API - Design Document

> **Version**: 1.0
> **Last Updated**: 2025-12-27
> **Author**: Architecture Team
> **Status**: Draft

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. System Architecture](#2-system-architecture)
- [3. Data Model](#3-data-model)
- [4. API Specification](#4-api-specification)
- [5. Business Rules](#5-business-rules)
- [6. Edge Cases & Considerations](#6-edge-cases--considerations)
- [7. Design Rationale](#7-design-rationale)
- [8. Future Roadmap](#8-future-roadmap)
- [9. Implementation Guide](#9-implementation-guide)

---

## 1. Executive Summary

### 1.1 Overview

Appointment API 是 Donfra 平台的核心模块之一，实现了 **User** (学员) 向 **Mentor** (导师) 预约 1对1 辅导课程的完整流程。系统遵循 RESTful 设计原则，采用三层架构，确保高可用性、数据一致性和良好的可扩展性。

### 1.2 Key Features

- ✅ **时间段预约**: 用户选择导师和时间段发起预约
- ✅ **冲突检测**: 防止同一导师在同一时间被重复预订
- ✅ **状态管理**: 完整的预约生命周期 (pending → confirmed → completed)
- ✅ **权限控制**: 基于角色的细粒度访问控制
- ✅ **并发安全**: 使用事务和行锁防止竞态条件
- ✅ **自动化流程**: 过期未确认预约的自动处理

### 1.3 Technical Stack

| Layer | Technology |
|-------|------------|
| **Language** | Go 1.24 |
| **Database** | PostgreSQL 16 |
| **ORM** | GORM |
| **Auth** | JWT (existing system) |
| **API Style** | RESTful HTTP/JSON |
| **Observability** | OpenTelemetry + Jaeger |

---

## 2. System Architecture

### 2.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Layer (handlers)                       │
│  Location: internal/http/handlers/appointment.go                │
│                                                                  │
│  Responsibilities:                                               │
│  • Request parsing & validation                                 │
│  • Response serialization (JSON)                                │
│  • Authentication/Authorization middleware integration          │
│  • Error handling & HTTP status codes                           │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Domain Layer (appointment)                     │
│  Location: internal/domain/appointment/                         │
│                                                                  │
│  Responsibilities:                                               │
│  • Business logic (conflict detection, validation)              │
│  • State machine transitions                                    │
│  • Repository interface definition                              │
│  • Domain models & value objects                                │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│              Persistence Layer (repository)                      │
│  Location: internal/domain/appointment/repository_postgres.go   │
│                                                                  │
│  Responsibilities:                                               │
│  • CRUD operations                                               │
│  • Transaction management                                        │
│  • Query optimization                                            │
│  • Data mapping (DB ↔ Domain)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
donfra-api/
├── internal/
│   ├── domain/
│   │   └── appointment/
│   │       ├── service.go              # Business logic
│   │       ├── repository.go           # Interface definition
│   │       ├── repository_postgres.go  # PostgreSQL implementation
│   │       ├── models.go               # Domain models
│   │       ├── errors.go               # Custom errors
│   │       └── service_test.go         # Unit tests
│   │
│   └── http/
│       └── handlers/
│           ├── appointment.go          # HTTP handlers
│           └── appointment_test.go     # Handler tests
│
└── migrations/
    ├── 003_create_appointments_table.sql
    └── 004_create_mentor_availability_table.sql
```

### 2.3 Request Flow

```
Client Request
      ↓
[Chi Router] → Route matching
      ↓
[Middleware] → JWT validation → Role check → Request ID
      ↓
[Handler] → Parse JSON → Validate input
      ↓
[Service] → Business logic → Conflict detection
      ↓
[Repository] → SQL query (with transaction)
      ↓
[Database] → PostgreSQL with row-level locks
      ↓
Response ← JSON serialization ← Domain model
```

---

## 3. Data Model

### 3.1 Database Schema

#### 3.1.1 `appointments` Table

```sql
CREATE TABLE appointments (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Time Information
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS
        (EXTRACT(EPOCH FROM (end_time - start_time)) / 60) STORED,

    -- Status Management
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Enum: pending | confirmed | completed |
    --       cancelled_by_user | cancelled_by_mentor | expired

    -- Metadata
    title VARCHAR(255),
    description TEXT,
    notes TEXT,  -- Mentor-only private notes

    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_duration CHECK (duration_minutes >= 15),
    CONSTRAINT future_appointment CHECK (start_time > NOW()),
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'confirmed', 'completed',
        'cancelled_by_user', 'cancelled_by_mentor', 'expired'
    ))
);

-- Performance Indexes
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_mentor_id ON appointments(mentor_id);
CREATE INDEX idx_appointments_time_range ON appointments(start_time, end_time);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Conflict Detection Index (partial index for active appointments)
CREATE INDEX idx_appointments_mentor_time_status ON appointments(
    mentor_id, start_time, end_time, status
) WHERE status NOT IN ('cancelled_by_user', 'cancelled_by_mentor', 'expired');

-- Auto-update trigger
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### 3.1.2 `mentor_availability` Table (Phase 2)

```sql
CREATE TABLE mentor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Recurring availability (e.g., every Monday 9-10am)
    day_of_week INTEGER,  -- 0=Sunday, 6=Saturday, NULL=specific date
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- One-time availability (e.g., 2025-01-15)
    specific_date DATE,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_availability_time CHECK (end_time > start_time),
    CONSTRAINT availability_type CHECK (
        (day_of_week IS NOT NULL AND specific_date IS NULL) OR
        (day_of_week IS NULL AND specific_date IS NOT NULL)
    )
);

CREATE INDEX idx_mentor_availability_mentor_id ON mentor_availability(mentor_id);
CREATE INDEX idx_mentor_availability_day ON mentor_availability(day_of_week)
    WHERE day_of_week IS NOT NULL;
CREATE INDEX idx_mentor_availability_date ON mentor_availability(specific_date)
    WHERE specific_date IS NOT NULL;
```

### 3.2 Go Domain Models

#### 3.2.1 Core Models

```go
package appointment

import (
    "time"
    "github.com/google/uuid"
)

// Status represents the lifecycle state of an appointment
type Status string

const (
    StatusPending           Status = "pending"
    StatusConfirmed         Status = "confirmed"
    StatusCompleted         Status = "completed"
    StatusCancelledByUser   Status = "cancelled_by_user"
    StatusCancelledByMentor Status = "cancelled_by_mentor"
    StatusExpired           Status = "expired"
)

// Appointment represents a scheduled 1-on-1 session
type Appointment struct {
    ID              uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
    UserID          uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
    MentorID        uuid.UUID  `json:"mentor_id" gorm:"type:uuid;not null"`

    StartTime       time.Time  `json:"start_time" gorm:"not null"`
    EndTime         time.Time  `json:"end_time" gorm:"not null"`
    DurationMinutes int        `json:"duration_minutes" gorm:"-"`

    Status          Status     `json:"status" gorm:"type:varchar(20);default:'pending'"`
    Title           string     `json:"title,omitempty" gorm:"type:varchar(255)"`
    Description     string     `json:"description,omitempty"`
    Notes           string     `json:"notes,omitempty"`  // Mentor-only

    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
    ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
    CancelledAt     *time.Time `json:"cancelled_at,omitempty"`
    CancellationReason string  `json:"cancellation_reason,omitempty"`

    // Associations (not always loaded)
    User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID"`
    Mentor *User   `json:"mentor,omitempty" gorm:"foreignKey:MentorID"`
}

// TableName specifies the table name
func (Appointment) TableName() string {
    return "appointments"
}
```

#### 3.2.2 Request/Response DTOs

```go
// CreateRequest is the payload for creating an appointment
type CreateRequest struct {
    MentorID    uuid.UUID `json:"mentor_id" validate:"required"`
    StartTime   time.Time `json:"start_time" validate:"required"`
    EndTime     time.Time `json:"end_time" validate:"required"`
    Title       string    `json:"title" validate:"max=255"`
    Description string    `json:"description" validate:"max=2000"`
}

// UpdateRequest is the payload for updating an appointment
type UpdateRequest struct {
    Title       *string `json:"title,omitempty"`
    Description *string `json:"description,omitempty"`
    Notes       *string `json:"notes,omitempty"`  // Mentor-only
}

// CancelRequest is the payload for cancelling an appointment
type CancelRequest struct {
    Reason string `json:"reason" validate:"required,max=500"`
}

// ListQuery defines query parameters for listing appointments
type ListQuery struct {
    Status    *Status    `form:"status"`
    StartDate *time.Time `form:"start_date"`
    EndDate   *time.Time `form:"end_date"`
    MentorID  *uuid.UUID `form:"mentor_id"`
    Page      int        `form:"page" validate:"min=1"`
    Limit     int        `form:"limit" validate:"min=1,max=100"`
}

// ListResponse is the response for listing appointments
type ListResponse struct {
    Appointments []Appointment `json:"appointments"`
    Pagination   Pagination    `json:"pagination"`
}

type Pagination struct {
    Page       int `json:"page"`
    Limit      int `json:"limit"`
    Total      int `json:"total"`
    TotalPages int `json:"total_pages"`
}
```

#### 3.2.3 Custom Errors

```go
package appointment

import "fmt"

// ConflictError indicates a scheduling conflict
type ConflictError struct {
    MentorID        uuid.UUID
    ConflictingID   uuid.UUID
    ConflictingSlot TimeSlot
}

func (e *ConflictError) Error() string {
    return fmt.Sprintf(
        "mentor %s already has appointment %s from %v to %v",
        e.MentorID, e.ConflictingID,
        e.ConflictingSlot.StartTime, e.ConflictingSlot.EndTime,
    )
}

// ValidationError indicates invalid input
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// StateTransitionError indicates invalid state change
type StateTransitionError struct {
    From Status
    To   Status
}

func (e *StateTransitionError) Error() string {
    return fmt.Sprintf("cannot transition from %s to %s", e.From, e.To)
}
```

---

## 4. API Specification

### 4.1 Endpoint Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/appointments` | User | Create appointment |
| `GET` | `/api/v1/appointments` | User/Mentor | List appointments |
| `GET` | `/api/v1/appointments/:id` | User/Mentor | Get appointment details |
| `PATCH` | `/api/v1/appointments/:id/confirm` | Mentor | Confirm appointment |
| `PATCH` | `/api/v1/appointments/:id/cancel` | User/Mentor | Cancel appointment |
| `PATCH` | `/api/v1/appointments/:id/complete` | Mentor | Mark as completed |
| `GET` | `/api/v1/mentors/:id/availability` | Any | Get mentor's available slots |

### 4.2 Detailed Specifications

#### 4.2.1 Create Appointment

```http
POST /api/v1/appointments
Authorization: Bearer <user_jwt_token>
Content-Type: application/json

Request Body:
{
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_time": "2025-01-15T10:00:00Z",
  "end_time": "2025-01-15T11:00:00Z",
  "title": "Python 基础入门",
  "description": "希望学习 Python 函数、类和模块的使用"
}

Success Response (201 Created):
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "user_id": "750e8400-e29b-41d4-a716-446655440002",
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_time": "2025-01-15T10:00:00Z",
  "end_time": "2025-01-15T11:00:00Z",
  "duration_minutes": 60,
  "status": "pending",
  "title": "Python 基础入门",
  "description": "希望学习 Python 函数、类和模块的使用",
  "created_at": "2025-01-10T08:30:15Z",
  "updated_at": "2025-01-10T08:30:15Z"
}

Error Responses:

400 Bad Request - Invalid time range:
{
  "error": "INVALID_TIME_RANGE",
  "message": "end_time must be after start_time",
  "request_id": "req_abc123"
}

409 Conflict - Time slot unavailable:
{
  "error": "TIME_CONFLICT",
  "message": "Mentor already has an appointment during this time",
  "details": {
    "conflicting_appointment_id": "850e8400-e29b-41d4-a716-446655440003",
    "conflicting_time": {
      "start": "2025-01-15T09:30:00Z",
      "end": "2025-01-15T11:00:00Z"
    }
  },
  "request_id": "req_abc123"
}

404 Not Found - Mentor doesn't exist:
{
  "error": "MENTOR_NOT_FOUND",
  "message": "Mentor with id '550e8400-e29b-41d4-a716-446655440000' not found or unavailable",
  "request_id": "req_abc123"
}

403 Forbidden - Insufficient permissions:
{
  "error": "INSUFFICIENT_PERMISSIONS",
  "message": "Only users with role=user can create appointments",
  "request_id": "req_abc123"
}

429 Too Many Requests - Rate limit exceeded:
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You can only create 10 appointments per hour",
  "retry_after": 3600,
  "request_id": "req_abc123"
}
```

**Validation Rules:**
- `mentor_id`: Must be a valid UUID and exist in users table with `role=mentor`
- `start_time`:
  - Must be in ISO 8601 format with timezone
  - Must be at least 1 hour in the future
  - Must be within 90 days from now
  - Must align to 15-minute intervals (e.g., 09:00, 09:15, 09:30)
- `end_time`:
  - Must be after `start_time`
  - Duration must be between 15 minutes and 4 hours
- `title`: Optional, max 255 characters
- `description`: Optional, max 2000 characters

#### 4.2.2 List Appointments

```http
GET /api/v1/appointments?status=confirmed&start_date=2025-01-01&page=1&limit=20
Authorization: Bearer <token>

Query Parameters:
- status (optional): Filter by status
  - Values: pending | confirmed | completed | cancelled_by_user | cancelled_by_mentor | expired
- start_date (optional): Filter appointments starting from this date (ISO 8601)
- end_date (optional): Filter appointments ending before this date (ISO 8601)
- mentor_id (optional): Filter by mentor UUID
- page (optional, default: 1): Page number
- limit (optional, default: 20, max: 100): Items per page

Success Response (200 OK):
{
  "appointments": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "user_id": "750e8400-e29b-41d4-a716-446655440002",
      "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
      "start_time": "2025-01-15T10:00:00Z",
      "end_time": "2025-01-15T11:00:00Z",
      "duration_minutes": 60,
      "status": "confirmed",
      "title": "Python 基础入门",
      "created_at": "2025-01-10T08:30:15Z",
      "confirmed_at": "2025-01-10T09:15:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

**Permission Rules:**
- **User** (role=user): Can only see appointments where they are the user
- **Mentor** (role=mentor): Can only see appointments where they are the mentor
- **Admin** (role=admin): Can see all appointments

#### 4.2.3 Get Appointment Details

```http
GET /api/v1/appointments/650e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>

Success Response (200 OK):
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "user_id": "750e8400-e29b-41d4-a716-446655440002",
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_time": "2025-01-15T10:00:00Z",
  "end_time": "2025-01-15T11:00:00Z",
  "duration_minutes": 60,
  "status": "confirmed",
  "title": "Python 基础入门",
  "description": "希望学习 Python 函数、类和模块的使用",
  "notes": "学生有编程基础，可以直接讲高级特性",  // Only visible to mentor
  "created_at": "2025-01-10T08:30:15Z",
  "updated_at": "2025-01-10T09:15:30Z",
  "confirmed_at": "2025-01-10T09:15:30Z"
}

Error Response (404 Not Found):
{
  "error": "NOT_FOUND",
  "message": "Appointment not found",
  "request_id": "req_xyz789"
}

Error Response (403 Forbidden):
{
  "error": "FORBIDDEN",
  "message": "You don't have permission to view this appointment",
  "request_id": "req_xyz789"
}
```

**Field Visibility:**
- `notes`: Only visible to the mentor, hidden from user

#### 4.2.4 Confirm Appointment (Mentor Only)

```http
PATCH /api/v1/appointments/650e8400-e29b-41d4-a716-446655440001/confirm
Authorization: Bearer <mentor_token>
Content-Type: application/json

Request Body (optional):
{
  "notes": "已确认，提前准备 Python 装饰器和上下文管理器的案例"
}

Success Response (200 OK):
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "status": "confirmed",
  "confirmed_at": "2025-01-10T09:15:30Z",
  "notes": "已确认，提前准备 Python 装饰器和上下文管理器的案例",
  "updated_at": "2025-01-10T09:15:30Z"
}

Error Response (400 Bad Request):
{
  "error": "INVALID_STATE_TRANSITION",
  "message": "Cannot confirm appointment with status 'cancelled_by_user'",
  "request_id": "req_abc123"
}

Error Response (403 Forbidden):
{
  "error": "FORBIDDEN",
  "message": "Only the assigned mentor can confirm this appointment",
  "request_id": "req_abc123"
}
```

**Business Rules:**
- Only mentor assigned to this appointment can confirm
- Can only confirm appointments with status `pending`
- Confirmation can happen anytime before `start_time`

#### 4.2.5 Cancel Appointment

```http
PATCH /api/v1/appointments/650e8400-e29b-41d4-a716-446655440001/cancel
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "reason": "临时有事，需要重新安排时间"
}

Success Response (200 OK):
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "status": "cancelled_by_user",  // or "cancelled_by_mentor"
  "cancelled_at": "2025-01-10T10:30:00Z",
  "cancellation_reason": "临时有事，需要重新安排时间",
  "updated_at": "2025-01-10T10:30:00Z"
}

Error Response (400 Bad Request):
{
  "error": "CANCELLATION_TOO_LATE",
  "message": "Cannot cancel appointment less than 24 hours before start time",
  "details": {
    "start_time": "2025-01-11T10:00:00Z",
    "now": "2025-01-11T09:00:00Z",
    "hours_remaining": 1
  },
  "request_id": "req_abc123"
}

Error Response (403 Forbidden):
{
  "error": "FORBIDDEN",
  "message": "You don't have permission to cancel this appointment",
  "request_id": "req_abc123"
}
```

**Business Rules:**
- Must cancel at least 24 hours before `start_time`
- User can cancel their own appointments
- Mentor can cancel appointments assigned to them
- Status transitions:
  - `pending` → `cancelled_by_user` or `cancelled_by_mentor`
  - `confirmed` → `cancelled_by_user` or `cancelled_by_mentor`
- `reason` is required, max 500 characters

#### 4.2.6 Mark as Completed (Mentor Only)

```http
PATCH /api/v1/appointments/650e8400-e29b-41d4-a716-446655440001/complete
Authorization: Bearer <mentor_token>
Content-Type: application/json

Request Body (optional):
{
  "notes": "学生掌握良好，下次可以学习异步编程和多线程"
}

Success Response (200 OK):
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "status": "completed",
  "notes": "学生掌握良好，下次可以学习异步编程和多线程",
  "updated_at": "2025-01-15T11:05:00Z"
}

Error Response (400 Bad Request):
{
  "error": "INVALID_COMPLETION",
  "message": "Cannot mark appointment as completed before end_time",
  "details": {
    "end_time": "2025-01-15T11:00:00Z",
    "now": "2025-01-15T10:30:00Z"
  },
  "request_id": "req_abc123"
}
```

**Business Rules:**
- Only mentor can mark as completed
- Can only complete appointments with status `confirmed`
- Can only complete after `end_time` has passed
- Auto-completion: System automatically marks as `completed` 7 days after `end_time` if still in `confirmed` status

#### 4.2.7 Get Mentor Availability

```http
GET /api/v1/mentors/550e8400-e29b-41d4-a716-446655440000/availability?date=2025-01-15&duration=60
Authorization: Bearer <token> (optional for public mentors)

Query Parameters:
- date (required): Target date in YYYY-MM-DD format
- duration (optional, default: 60): Desired duration in minutes

Success Response (200 OK):
{
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2025-01-15",
  "timezone": "UTC",
  "available_slots": [
    {
      "start_time": "2025-01-15T09:00:00Z",
      "end_time": "2025-01-15T10:00:00Z",
      "duration_minutes": 60
    },
    {
      "start_time": "2025-01-15T14:00:00Z",
      "end_time": "2025-01-15T15:00:00Z",
      "duration_minutes": 60
    },
    {
      "start_time": "2025-01-15T15:00:00Z",
      "end_time": "2025-01-15T17:00:00Z",
      "duration_minutes": 120
    }
  ],
  "booked_slots": [
    {
      "start_time": "2025-01-15T10:00:00Z",
      "end_time": "2025-01-15T11:00:00Z",
      "appointment_id": "650e8400-e29b-41d4-a716-446655440001",
      "status": "confirmed"
    },
    {
      "start_time": "2025-01-15T13:00:00Z",
      "end_time": "2025-01-15T14:00:00Z",
      "appointment_id": "750e8400-e29b-41d4-a716-446655440005",
      "status": "pending"
    }
  ]
}
```

**Algorithm (Phase 1 - Simple):**
```
1. Get mentor's working hours (e.g., 09:00-17:00)
2. Get all active appointments for the date
3. Calculate gaps between appointments
4. Return gaps >= requested duration
```

**Algorithm (Phase 2 - With Availability Table):**
```
1. Query mentor_availability table for the date
2. Get all active appointments for the date
3. Subtract booked slots from available slots
4. Return remaining slots >= requested duration
```

---

## 5. Business Rules

### 5.1 Time Conflict Detection

#### 5.1.1 Conflict Definition

Two appointments **conflict** if they overlap in time and belong to the same mentor:

```
Appointment A: [start_A, end_A]
Appointment B: [start_B, end_B]

Conflict exists if:
  NOT (end_A <= start_B OR start_A >= end_B)

Simplified (overlap condition):
  start_A < end_B AND end_A > start_B
```

#### 5.1.2 Detection Query

```sql
SELECT id, start_time, end_time, status
FROM appointments
WHERE mentor_id = $1
  AND status IN ('pending', 'confirmed')
  AND start_time < $3  -- new_end_time
  AND end_time > $2    -- new_start_time
LIMIT 1;
```

**Note**: Only `pending` and `confirmed` appointments participate in conflict detection. Cancelled and expired appointments are ignored.

#### 5.1.3 Concurrency Control

To prevent race conditions in concurrent requests:

```sql
-- Use serializable transaction with row-level locks
BEGIN ISOLATION LEVEL SERIALIZABLE;

  -- Lock all active appointments for this mentor
  SELECT id FROM appointments
  WHERE mentor_id = $1
    AND status IN ('pending', 'confirmed')
  FOR UPDATE;

  -- Check for conflicts
  -- If no conflict, insert new appointment

COMMIT;
```

**Alternative (optimistic locking):**
```sql
-- Add version column to appointments table
ALTER TABLE appointments ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE appointments
SET status = 'confirmed', version = version + 1
WHERE id = $1 AND version = $2;

-- If affected rows = 0, conflict occurred
```

### 5.2 State Machine

#### 5.2.1 State Transition Diagram

```
                    [User creates appointment]
                              ↓
                      ┌───────────────┐
                      │    pending    │
                      └───────────────┘
                       ↙       ↓      ↘
              [User/Mentor  [Mentor]  [System]
               cancels]     confirms  expires
                  ↓           ↓         ↓
        ┌─────────────┐  ┌──────────┐  ┌─────────┐
        │ cancelled_  │  │confirmed │  │ expired │
        │   by_user   │  └──────────┘  └─────────┘
        └─────────────┘   ↙    ↓    ↘
                    [Cancel]   │   [Mentor]
                       ↓       │   completes
              ┌─────────────┐  │       ↓
              │ cancelled_  │  │  ┌───────────┐
              │ by_mentor   │  │  │ completed │
              └─────────────┘  │  └───────────┘
                              [System]
                           auto-complete
                                ↓
                          ┌───────────┐
                          │ completed │
                          └───────────┘
```

#### 5.2.2 Allowed Transitions

| From State | To State | Actor | Condition |
|------------|----------|-------|-----------|
| `pending` | `confirmed` | Mentor | Anytime before `start_time` |
| `pending` | `cancelled_by_user` | User | ≥ 24h before `start_time` |
| `pending` | `cancelled_by_mentor` | Mentor | ≥ 24h before `start_time` |
| `pending` | `expired` | System | Auto after 24h if not confirmed |
| `confirmed` | `cancelled_by_user` | User | ≥ 24h before `start_time` |
| `confirmed` | `cancelled_by_mentor` | Mentor | ≥ 24h before `start_time` |
| `confirmed` | `completed` | Mentor | After `end_time` |
| `confirmed` | `completed` | System | Auto 7 days after `end_time` |

**Invalid transitions** (all other combinations) will result in `INVALID_STATE_TRANSITION` error.

### 5.3 Cancellation Policy

#### 5.3.1 24-Hour Window

```go
func canCancel(appointment *Appointment, now time.Time) error {
    hoursUntilStart := appointment.StartTime.Sub(now).Hours()

    if hoursUntilStart < 24 {
        return &CancellationError{
            Code: "CANCELLATION_TOO_LATE",
            Message: fmt.Sprintf(
                "Cannot cancel less than 24 hours before start (%.1f hours remaining)",
                hoursUntilStart,
            ),
        }
    }

    return nil
}
```

#### 5.3.2 Cancellation Limits (Phase 2)

```sql
-- Track cancellation history
CREATE TABLE appointment_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT
);

-- Check cancellation count in last 30 days
SELECT COUNT(*) FROM appointment_cancellations
WHERE user_id = $1
  AND cancelled_at > NOW() - INTERVAL '30 days';

-- Limit: 3 cancellations per 30 days
```

### 5.4 Automated Processes

#### 5.4.1 Auto-Expire Unconfirmed Appointments

```sql
-- Cron job: Every hour
UPDATE appointments
SET status = 'expired',
    updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';
```

#### 5.4.2 Auto-Complete Past Appointments

```sql
-- Cron job: Daily at 00:00 UTC
UPDATE appointments
SET status = 'completed',
    updated_at = NOW()
WHERE status = 'confirmed'
  AND end_time < NOW() - INTERVAL '7 days';
```

#### 5.4.3 Reminder Notifications (Phase 2)

```sql
-- Cron job: Every 15 minutes
SELECT id, user_id, mentor_id, start_time
FROM appointments
WHERE status = 'confirmed'
  AND start_time BETWEEN NOW() + INTERVAL '23 hours 45 minutes'
                     AND NOW() + INTERVAL '24 hours';

-- Send reminder emails/push notifications
```

### 5.5 Time Validation Rules

#### 5.5.1 Creation Constraints

```go
type TimeValidator struct {
    MinDuration   time.Duration  // 15 minutes
    MaxDuration   time.Duration  // 4 hours
    MinAdvance    time.Duration  // 1 hour
    MaxAdvance    time.Duration  // 90 days
    SlotAlignment time.Duration  // 15 minutes
}

func (v *TimeValidator) Validate(req *CreateRequest, now time.Time) error {
    duration := req.EndTime.Sub(req.StartTime)

    // Check duration bounds
    if duration < v.MinDuration {
        return &ValidationError{
            Field: "duration",
            Message: fmt.Sprintf("Duration must be at least %v", v.MinDuration),
        }
    }

    if duration > v.MaxDuration {
        return &ValidationError{
            Field: "duration",
            Message: fmt.Sprintf("Duration cannot exceed %v", v.MaxDuration),
        }
    }

    // Check advance booking window
    advance := req.StartTime.Sub(now)
    if advance < v.MinAdvance {
        return &ValidationError{
            Field: "start_time",
            Message: fmt.Sprintf("Must book at least %v in advance", v.MinAdvance),
        }
    }

    if advance > v.MaxAdvance {
        return &ValidationError{
            Field: "start_time",
            Message: fmt.Sprintf("Cannot book more than %v in advance", v.MaxAdvance),
        }
    }

    // Check time slot alignment
    if req.StartTime.Minute() % 15 != 0 || req.StartTime.Second() != 0 {
        return &ValidationError{
            Field: "start_time",
            Message: "Start time must align to 15-minute intervals (e.g., 09:00, 09:15)",
        }
    }

    return nil
}
```

#### 5.5.2 Timezone Handling

- **Storage**: All timestamps stored as `TIMESTAMPTZ` (UTC)
- **API**: Accept ISO 8601 format with timezone (e.g., `2025-01-15T10:00:00+08:00`)
- **Conversion**: PostgreSQL automatically converts to UTC
- **Response**: Return UTC timestamps, client handles timezone display

---

## 6. Edge Cases & Considerations

### 6.1 Concurrency Issues

#### 6.1.1 Double Booking Race Condition

**Scenario**: Two users simultaneously book the same mentor's last available slot.

```
Time    User A                          User B
------  ------------------------------  ------------------------------
T0      GET /availability (sees slot)
T1                                      GET /availability (sees slot)
T2      POST /appointments (checking)
T3                                      POST /appointments (checking)
T4      INSERT appointment (success)
T5                                      INSERT appointment (CONFLICT!)
```

**Solution**: Serializable transaction isolation

```go
func (r *PostgresRepository) Create(ctx context.Context, appt *Appointment) error {
    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,
    })
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Lock all active appointments for this mentor
    var conflicts []Appointment
    err = tx.Where(
        "mentor_id = ? AND status IN (?, ?) AND start_time < ? AND end_time > ?",
        appt.MentorID, StatusPending, StatusConfirmed, appt.EndTime, appt.StartTime,
    ).Find(&conflicts).Error

    if err != nil {
        return err
    }

    if len(conflicts) > 0 {
        return &ConflictError{
            MentorID: appt.MentorID,
            ConflictingID: conflicts[0].ID,
            ConflictingSlot: TimeSlot{
                StartTime: conflicts[0].StartTime,
                EndTime: conflicts[0].EndTime,
            },
        }
    }

    if err := tx.Create(appt).Error; err != nil {
        return err
    }

    return tx.Commit()
}
```

#### 6.1.2 Idempotency

**Problem**: User clicks "Create Appointment" button twice due to slow network.

**Solution**: Idempotency key header

```http
POST /api/v1/appointments
Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json
```

```go
// Idempotency table
CREATE TABLE idempotency_keys (
    key UUID PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,  -- SHA-256 of request body
    response_body TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

// Middleware
func IdempotencyMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        key := r.Header.Get("Idempotency-Key")
        if key == "" {
            next.ServeHTTP(w, r)
            return
        }

        // Check if key exists
        var cached IdempotencyRecord
        if db.Where("key = ?", key).First(&cached).Error == nil {
            // Return cached response
            w.WriteHeader(cached.ResponseStatus)
            w.Write([]byte(cached.ResponseBody))
            return
        }

        // Proceed with request, cache response
        next.ServeHTTP(w, r)
    })
}
```

### 6.2 Data Integrity

#### 6.2.1 Orphaned Appointments

**Problem**: User or mentor account is deleted, what happens to appointments?

**Solution**: Soft delete + foreign key constraints

```sql
-- Option 1: Prevent deletion if active appointments exist
ALTER TABLE appointments
ADD CONSTRAINT fk_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT;

-- Option 2: Soft delete users table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Query active users only
SELECT * FROM users WHERE deleted_at IS NULL;
```

#### 6.2.2 Audit Trail

```sql
-- Appointment history table
CREATE TABLE appointment_audit (
    id BIGSERIAL PRIMARY KEY,
    appointment_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,  -- created, confirmed, cancelled, completed
    actor_id UUID NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointment_audit_id ON appointment_audit(appointment_id);
```

### 6.3 Performance Optimization

#### 6.3.1 Index Strategy

```sql
-- Covering index for conflict detection
CREATE INDEX idx_conflict_detection ON appointments(
    mentor_id,
    start_time,
    end_time,
    status
) WHERE status IN ('pending', 'confirmed');

-- Index for user's upcoming appointments
CREATE INDEX idx_user_upcoming ON appointments(
    user_id,
    start_time
) WHERE status IN ('pending', 'confirmed') AND start_time > NOW();

-- Index for mentor's daily schedule
CREATE INDEX idx_mentor_daily ON appointments(
    mentor_id,
    start_time
) WHERE status IN ('pending', 'confirmed');
```

#### 6.3.2 Caching Strategy

```go
// Redis cache for mentor availability
type AvailabilityCache struct {
    redis *redis.Client
    ttl   time.Duration  // 5 minutes
}

func (c *AvailabilityCache) Get(mentorID uuid.UUID, date time.Time) (*Availability, error) {
    key := fmt.Sprintf("mentor:%s:availability:%s", mentorID, date.Format("2006-01-02"))

    val, err := c.redis.Get(context.Background(), key).Result()
    if err == redis.Nil {
        return nil, nil  // Cache miss
    }
    if err != nil {
        return nil, err
    }

    var avail Availability
    json.Unmarshal([]byte(val), &avail)
    return &avail, nil
}

func (c *AvailabilityCache) Set(mentorID uuid.UUID, date time.Time, avail *Availability) error {
    key := fmt.Sprintf("mentor:%s:availability:%s", mentorID, date.Format("2006-01-02"))

    data, _ := json.Marshal(avail)
    return c.redis.Set(context.Background(), key, data, c.ttl).Err()
}

// Invalidate cache on appointment creation/cancellation
func (c *AvailabilityCache) Invalidate(mentorID uuid.UUID, date time.Time) error {
    key := fmt.Sprintf("mentor:%s:availability:%s", mentorID, date.Format("2006-01-02"))
    return c.redis.Del(context.Background(), key).Err()
}
```

#### 6.3.3 Query Optimization

```go
// Batch load user/mentor info with appointments
func (r *PostgresRepository) List(ctx context.Context, query ListQuery) ([]Appointment, error) {
    var appointments []Appointment

    q := r.db.WithContext(ctx).
        Preload("User", func(db *gorm.DB) *gorm.DB {
            return db.Select("id", "name", "email", "role")  // Select only needed fields
        }).
        Preload("Mentor", func(db *gorm.DB) *gorm.DB {
            return db.Select("id", "name", "email", "role")
        })

    // Apply filters
    if query.Status != nil {
        q = q.Where("status = ?", *query.Status)
    }

    if query.StartDate != nil {
        q = q.Where("start_time >= ?", *query.StartDate)
    }

    // Pagination
    offset := (query.Page - 1) * query.Limit
    q = q.Offset(offset).Limit(query.Limit)

    return appointments, q.Find(&appointments).Error
}
```

### 6.4 Security Considerations

#### 6.4.1 Authorization Middleware

```go
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userRole := r.Context().Value("user_role").(string)

            allowed := false
            for _, role := range allowedRoles {
                if userRole == role {
                    allowed = true
                    break
                }
            }

            if !allowed {
                httputil.WriteError(w, http.StatusForbidden, "INSUFFICIENT_PERMISSIONS",
                    fmt.Sprintf("Requires role: %v", allowedRoles))
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// Usage in router
r.Route("/api/v1/appointments", func(r chi.Router) {
    r.Use(middleware.RequireAuth)

    r.With(RequireRole("user")).Post("/", handlers.CreateAppointment)
    r.Get("/", handlers.ListAppointments)  // Both user and mentor
    r.Get("/{id}", handlers.GetAppointment)

    r.With(RequireRole("mentor")).Patch("/{id}/confirm", handlers.ConfirmAppointment)
    r.With(RequireRole("user", "mentor")).Patch("/{id}/cancel", handlers.CancelAppointment)
    r.With(RequireRole("mentor")).Patch("/{id}/complete", handlers.CompleteAppointment)
})
```

#### 6.4.2 Rate Limiting

```go
// Rate limit: 10 appointments per hour per user
func AppointmentRateLimiter(next http.Handler) http.Handler {
    limiter := rate.NewLimiter(rate.Every(6*time.Minute), 10)  // 10 tokens, refill every 6min

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := r.Context().Value("user_id").(uuid.UUID)

        key := fmt.Sprintf("ratelimit:appointment:create:%s", userID)

        if !limiter.Allow() {
            httputil.WriteError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED",
                "You can only create 10 appointments per hour")
            w.Header().Set("Retry-After", "3600")
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

#### 6.4.3 Input Sanitization

```go
func sanitizeInput(req *CreateRequest) {
    req.Title = strings.TrimSpace(req.Title)
    req.Description = strings.TrimSpace(req.Description)

    // Remove null bytes
    req.Title = strings.ReplaceAll(req.Title, "\x00", "")
    req.Description = strings.ReplaceAll(req.Description, "\x00", "")

    // HTML escape to prevent XSS
    req.Title = html.EscapeString(req.Title)
    req.Description = html.EscapeString(req.Description)
}
```

### 6.5 Observability

#### 6.5.1 Metrics

```go
var (
    appointmentsCreated = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "appointments_created_total",
            Help: "Total number of appointments created",
        },
        []string{"status"},
    )

    appointmentsCancelled = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "appointments_cancelled_total",
            Help: "Total number of appointments cancelled",
        },
        []string{"cancelled_by"},
    )

    conflictDetectionErrors = promauto.NewCounter(
        prometheus.CounterOpts{
            Name: "appointment_conflict_errors_total",
            Help: "Total number of conflict detection errors",
        },
    )

    appointmentCreationDuration = promauto.NewHistogram(
        prometheus.HistogramOpts{
            Name: "appointment_creation_duration_seconds",
            Help: "Duration of appointment creation",
            Buckets: prometheus.DefBuckets,
        },
    )
)

// Usage
start := time.Now()
err := service.CreateAppointment(ctx, req)
appointmentCreationDuration.Observe(time.Since(start).Seconds())

if err != nil {
    if _, ok := err.(*ConflictError); ok {
        conflictDetectionErrors.Inc()
    }
} else {
    appointmentsCreated.WithLabelValues("pending").Inc()
}
```

#### 6.5.2 Structured Logging

```go
logger.Info("appointment created",
    "appointment_id", appt.ID,
    "user_id", appt.UserID,
    "mentor_id", appt.MentorID,
    "start_time", appt.StartTime,
    "end_time", appt.EndTime,
    "duration_minutes", appt.DurationMinutes,
    "trace_id", ctx.Value("trace_id"),
)

logger.Warn("appointment conflict detected",
    "user_id", req.UserID,
    "mentor_id", req.MentorID,
    "requested_slot", fmt.Sprintf("%v - %v", req.StartTime, req.EndTime),
    "conflicting_appointment_id", conflict.ID,
    "conflicting_slot", fmt.Sprintf("%v - %v", conflict.StartTime, conflict.EndTime),
    "trace_id", ctx.Value("trace_id"),
)
```

#### 6.5.3 Distributed Tracing

```go
func (s *Service) CreateAppointment(ctx context.Context, req *CreateRequest) (*Appointment, error) {
    ctx, span := otel.Tracer("appointment-service").Start(ctx, "CreateAppointment")
    defer span.End()

    span.SetAttributes(
        attribute.String("user_id", req.UserID.String()),
        attribute.String("mentor_id", req.MentorID.String()),
        attribute.String("start_time", req.StartTime.Format(time.RFC3339)),
    )

    // Validate input
    if err := s.validator.Validate(req); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "validation failed")
        return nil, err
    }

    // Check for conflicts
    ctx, conflictSpan := otel.Tracer("appointment-service").Start(ctx, "CheckConflicts")
    conflict, err := s.repo.FindConflict(ctx, req.MentorID, req.StartTime, req.EndTime)
    conflictSpan.End()

    if conflict != nil {
        span.RecordError(ConflictError{})
        span.SetStatus(codes.Error, "time conflict")
        return nil, &ConflictError{...}
    }

    // Create appointment
    appt := &Appointment{...}
    if err := s.repo.Create(ctx, appt); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "database error")
        return nil, err
    }

    span.SetStatus(codes.Ok, "appointment created")
    return appt, nil
}
```

---

## 7. Design Rationale

### 7.1 Architecture Decisions

#### Why Three-Tier Architecture?

- **Separation of Concerns**: HTTP layer handles protocol, domain layer handles business logic, persistence layer handles data access
- **Testability**: Each layer can be tested independently with mocks
- **Maintainability**: Changes in one layer don't cascade to others
- **Reusability**: Domain logic can be reused in different contexts (HTTP, gRPC, CLI)

#### Why UUID over Auto-Increment ID?

- **Security**: Prevents enumeration attacks (guessing appointment IDs)
- **Distribution**: UUIDs can be generated independently without coordination
- **Merging**: Easier to merge data from different sources
- **Client-side Generation**: Frontend can generate IDs for optimistic UI updates

### 7.2 Data Model Decisions

#### Why Separate User and Mentor Foreign Keys?

- **Clarity**: Makes it explicit who is booking and who is being booked
- **Queries**: Easy to filter "my bookings as user" vs "my bookings as mentor"
- **Permissions**: Simple to check "can this user cancel this appointment?" based on FKs
- **Statistics**: Easy to calculate "total appointments taught" vs "total appointments taken"

#### Why Status Enum Instead of Multiple Booleans?

- **State Machine**: Enforces valid state transitions
- **Audit Trail**: Clear history of status changes
- **Business Logic**: Different actions allowed based on status
- **Reporting**: Easy to count appointments by status

#### Why `notes` Field Visible Only to Mentor?

- **Privacy**: Mentors need to record teaching notes without students seeing
- **Professionalism**: Encourages honest feedback and improvement tracking
- **Future Use**: Can add shared notes field if needed

### 7.3 API Design Decisions

#### Why PATCH Instead of PUT for Updates?

- **Partial Updates**: Only send changed fields, reducing payload size
- **Flexibility**: Different endpoints can update different fields
- **Idempotency**: PATCH can be made idempotent with version numbers

#### Why Separate Confirm/Cancel/Complete Endpoints?

- **Intent**: Clear action semantics (RESTful resource-oriented design)
- **Permissions**: Each action has different authorization rules
- **Validation**: Each action has different validation requirements
- **Audit**: Easy to log specific actions

#### Why Include Pagination in List Response?

- **Performance**: Prevents loading thousands of appointments
- **UX**: Frontend can implement infinite scroll or page navigation
- **Consistency**: Standard pattern across all list endpoints

### 7.4 Business Logic Decisions

#### Why 24-Hour Cancellation Window?

- **Industry Standard**: Most booking systems use 24-48h window
- **Mentor Protection**: Gives mentors time to fill the slot
- **User Flexibility**: Balances convenience with commitment
- **No-Show Prevention**: Reduces last-minute cancellations

#### Why Auto-Expire Unconfirmed Appointments?

- **Resource Optimization**: Prevents "slot hoarding"
- **User Experience**: Forces timely decision-making
- **System Health**: Keeps database clean of stale records

#### Why Auto-Complete After 7 Days?

- **Data Quality**: Ensures appointments eventually reach terminal state
- **Reporting**: Accurate completion statistics
- **Cleanup**: Allows archival of old data

### 7.5 Security Decisions

#### Why Row-Level Locking for Conflict Detection?

- **Correctness**: Prevents double-booking race condition
- **Performance**: Row locks are finer-grained than table locks
- **Simplicity**: Database handles concurrency, not application code

#### Why Idempotency Keys?

- **Reliability**: Network retries don't create duplicate appointments
- **User Experience**: Safe to click "Submit" multiple times
- **Standard Practice**: Common pattern in payment APIs (Stripe, PayPal)

---

## 8. Future Roadmap

### Phase 2: Enhanced Features (Q2 2025)

- **Recurring Appointments**: Weekly/monthly recurring sessions
- **Group Appointments**: Multiple users in one session
- **Mentor Availability Calendar**: Self-service availability management
- **Email/SMS Notifications**: Reminders and confirmations
- **Rating & Review System**: Post-appointment feedback

### Phase 3: Advanced Features (Q3 2025)

- **Waitlist Management**: Auto-assign when slots open up
- **Smart Rescheduling**: Suggest alternative times on conflict
- **Payment Integration**: Paid appointments with Stripe
- **Video Conferencing**: Embedded Zoom/Teams/Jitsi
- **Analytics Dashboard**: Appointment metrics and reports

### Phase 4: AI-Powered Features (Q4 2025)

- **AI Scheduling Assistant**: Optimal time recommendations
- **Conflict Resolution**: Automated rescheduling proposals
- **No-Show Prediction**: ML model to predict cancellations
- **Dynamic Pricing**: Peak time pricing adjustments

---

## 9. Implementation Guide

### 9.1 Development Phases

#### Phase 1: Foundation (Week 1-2)

1. **Database Setup**
   ```bash
   cd donfra-api
   make migration-create NAME=create_appointments_table
   ```

2. **Domain Layer**
   - Create `internal/domain/appointment/` directory
   - Implement models, service interface, repository interface
   - Write unit tests with mocks

3. **Repository Layer**
   - Implement PostgreSQL repository
   - Write integration tests with test database

4. **HTTP Layer**
   - Implement handlers
   - Add routes to router
   - Write handler tests with mock service

#### Phase 2: Core Features (Week 3-4)

5. **Conflict Detection**
   - Implement transaction-based conflict checking
   - Add comprehensive tests for race conditions

6. **State Machine**
   - Implement state transition validation
   - Add tests for all valid/invalid transitions

7. **Authorization**
   - Add permission checks to handlers
   - Test with different user roles

#### Phase 3: Polish (Week 5-6)

8. **Observability**
   - Add metrics
   - Add structured logging
   - Add distributed tracing

9. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Code comments
   - README

10. **Deployment**
    - Docker image
    - Kubernetes manifests
    - CI/CD pipeline

### 9.2 Testing Strategy

```go
// Unit tests (domain/appointment/service_test.go)
func TestService_CreateAppointment_Success(t *testing.T)
func TestService_CreateAppointment_Conflict(t *testing.T)
func TestService_ConfirmAppointment_InvalidState(t *testing.T)

// Integration tests (domain/appointment/repository_test.go)
func TestRepository_Create_Success(t *testing.T)
func TestRepository_FindConflict_NoConflict(t *testing.T)
func TestRepository_FindConflict_HasConflict(t *testing.T)

// Handler tests (http/handlers/appointment_test.go)
func TestCreateAppointment_Success(t *testing.T)
func TestCreateAppointment_Unauthorized(t *testing.T)
func TestListAppointments_AsUser(t *testing.T)
func TestListAppointments_AsMentor(t *testing.T)

// E2E tests (e2e/appointment_test.go)
func TestE2E_AppointmentLifecycle(t *testing.T)
```

### 9.3 Deployment Checklist

- [ ] Database migrations tested
- [ ] All tests passing (unit + integration + e2e)
- [ ] API documentation published
- [ ] Metrics dashboard configured
- [ ] Alerts configured (high error rate, slow queries)
- [ ] Load testing completed
- [ ] Rollback plan documented
- [ ] Feature flags enabled (for gradual rollout)

---

## Appendix A: Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_TIME_RANGE` | 400 | end_time must be after start_time |
| `INVALID_DURATION` | 400 | Duration outside allowed range (15min - 4h) |
| `INVALID_TIME_ALIGNMENT` | 400 | Times must align to 15-minute intervals |
| `BOOKING_TOO_EARLY` | 400 | Cannot book less than 1 hour in advance |
| `BOOKING_TOO_FAR` | 400 | Cannot book more than 90 days in advance |
| `TIME_CONFLICT` | 409 | Mentor has another appointment at this time |
| `MENTOR_NOT_FOUND` | 404 | Mentor does not exist or is unavailable |
| `APPOINTMENT_NOT_FOUND` | 404 | Appointment does not exist |
| `INVALID_STATE_TRANSITION` | 400 | Cannot transition from current status to requested status |
| `CANCELLATION_TOO_LATE` | 400 | Cannot cancel less than 24h before start |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role or ownership |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many appointments created |

---

## Appendix B: Database Indexes Summary

```sql
-- Primary indexes (automatically created)
PRIMARY KEY (id) -- on appointments

-- Foreign key indexes
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_mentor_id ON appointments(mentor_id);

-- Query optimization indexes
CREATE INDEX idx_appointments_time_range ON appointments(start_time, end_time);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Conflict detection (partial index)
CREATE INDEX idx_appointments_mentor_time_status ON appointments(
    mentor_id, start_time, end_time, status
) WHERE status IN ('pending', 'confirmed');

-- User's upcoming appointments
CREATE INDEX idx_user_upcoming ON appointments(user_id, start_time)
WHERE status IN ('pending', 'confirmed') AND start_time > NOW();

-- Mentor's daily schedule
CREATE INDEX idx_mentor_daily ON appointments(mentor_id, start_time)
WHERE status IN ('pending', 'confirmed');

-- Auto-expire job
CREATE INDEX idx_pending_created ON appointments(status, created_at)
WHERE status = 'pending';

-- Auto-complete job
CREATE INDEX idx_confirmed_ended ON appointments(status, end_time)
WHERE status = 'confirmed';
```

---

**End of Document**
