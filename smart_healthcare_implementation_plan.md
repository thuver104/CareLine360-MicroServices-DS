# Smart Healthcare Appointment & Telemedicine Platform
## Implementation Plan

This document outlines the step-by-step implementation, architectural components, and code examples for extending the existing microservices-based healthcare system to a full AI-enabled Telemedicine platform.

### 1. Folder Structure Setup

The new architecture adds several focused microservices to handle domain-specific logic securely while maintaining separation of concerns:

```text
microservices-health-care-master/
├── api-gateway/            # REST interface, Authentication Middleware
├── admin-service/          # Admin verification & monitoring
├── patient-service/        # Patient profiles, document management
├── doctor-service/         # Doctor schedules, prescriptions (Updated)
├── appointment-service/    # Booking management & SAGA Orchestrator (Updated)
├── payment-service/        # Stripe/PayHere mock integration
├── notification-service/   # Email/SMS notifications (Mock)
├── telemedicine-service/   # Video meeting generation (Mock)
├── ai-service/             # AI Symptom checker (Mock)
├── infrastructure/         
│   └── protos/             # Shared gRPC (.proto) definitions
└── docker-compose.yml      # Orchestration definition
```

---

### 2. Standardized gRPC Contracts (.proto)

We must define clear communication boundaries for the new services using Protocol Buffers. These will be added to `api-gateway/src/modules/grpc/protos/`.

#### `patient.proto`
```protobuf
syntax = "proto3";
package patient;

service PatientService {
  rpc CreatePatient(PatientProfileRequest) returns (PatientResponse);
  rpc UploadMedicalReport(ReportRequest) returns (ReportResponse);
  rpc GetPatientProfile(PatientIdRequest) returns (PatientResponse);
}

message PatientProfileRequest {
  string userId = 1;
  string name = 2;
  string dob = 3;
  string contact = 4;
}

message ReportRequest {
  string patientId = 1;
  string fileUrl = 2;
  string reportType = 3;
}

message PatientResponse {
  string id = 1;
  string userId = 2;
  string name = 3;
  bool success = 4;
}

message ReportResponse {
  string reportId = 1;
  bool success = 2;
}

message PatientIdRequest {
  string patientId = 1;
}
```

#### `payment.proto`
```protobuf
syntax = "proto3";
package payment;

service PaymentService {
  rpc ProcessPayment(PaymentRequest) returns (PaymentResponse);
}

message PaymentRequest {
  string appointmentId = 1;
  string patientId = 2;
  double amount = 3;
  string currency = 4;
}

message PaymentResponse {
  string transactionId = 1;
  string status = 2; // PAID, FAILED
  bool success = 3;
}
```

#### `notification.proto`
```protobuf
syntax = "proto3";
package notification;

service NotificationService {
  rpc SendNotification(NotificationRequest) returns (NotificationResponse);
}

message NotificationRequest {
  string userId = 1;
  string message = 2;
  string type = 3; // SMS, EMAIL
}

message NotificationResponse {
  bool success = 1;
}
```

---

### 3. Database Schema Design (PostgreSQL / Sequelize)

Following microservices principles, each service has an isolated database context (achieved using schemas or isolated tables if resources strictly forbid separate DB instances).

**Patient Service DB (`PatientProfile` Table):**
- `id` (UUID, PK)
- `user_id` (UUID, Foreign reference to User Auth)
- `name` (String)
- `dob` (Date)
- `contact_number` (String)

**Patient Service DB (`MedicalReports` Table):**
- `id` (UUID, PK)
- `patient_id` (UUID, FK)
- `file_url` (String) - Local filesystem or S3 generic URL
- `upload_date` (Date)

**Appointment Service DB (`Appointments` Table):**
- `id` (UUID, PK)
- `patient_id` (UUID)
- `doctor_id` (UUID)
- `status` (Enum: PENDING, CONFIRMED, COMPLETED, CANCELLED)
- `start_time` (Date)
- `end_time` (Date)
- `telemedicine_link` (String)

**Payment Service DB (`Transactions` Table):**
- `id` (UUID, PK)
- `appointment_id` (UUID)
- `amount` (Decimal)
- `status` (Enum: PAID, FAILED)

---

### 4. Appointment Booking Flow & SAGA Pattern

For distributed transactions (Booking = Appointment + Payment + Notification), we use a **Choreography or Orchestrator SAGA Pattern**. The `appointment-service` will logically orchestrate:

#### SAGA Implementation (`appointment-service/src/services/appointment.js`)
```javascript
async function createAppointmentSequence(req) {
  const { patientId, doctorId, amount } = req.body;
  
  // 1. Create Appointment local record
  const appointment = await AppointmentModel.create({
    patient_id: patientId, doctor_id: doctorId, status: 'PENDING'
  });

  try {
    // 2. Call Payment Service (via gRPC)
    const payRes = await paymentGrpcClient.ProcessPayment({ 
       appointmentId: appointment.id, patientId, amount 
    });

    if (payRes.status === 'PAID') {
       // 3. Mark Confirmed
       await appointment.update({ status: 'CONFIRMED' });

       // 4. Generate Telemedicine Link (Mock gRPC call)
       const linkRes = await telemedicineGrpcClient.GenerateLink({ appointmentId: appointment.id });
       await appointment.update({ telemedicine_link: linkRes.url });

       // 5. Send Notification
       await notificationGrpcClient.SendNotification({ 
           userId: patientId, message: `Appt Confirmed with Dr. ${doctorId}` 
       });

       return appointment;
    } else {
       throw new Error("Payment Failed");
    }
  } catch (err) {
    // SAGA Rollback/Compensation
    await appointment.update({ status: 'CANCELLED' });
    throw new Error(`Booking aborted: ${err.message}`);
  }
}
```

---

### 5. API Gateway (REST Endpoints & JWT)

The `api-gateway` will handle REST endpoints. Include an authentication middleware protecting roles.

#### JWT Middleware Setup (`api-gateway/src/modules/http/middlewares/auth.js`)
```javascript
import jwt from 'jsonwebtoken';

export function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).send('Unauthorized');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).send('Forbidden: Insufficient Role');
      }
      req.user = decoded; // Contains id, role (PATIENT, DOCTOR, ADMIN)
      next();
    } catch (e) {
      return res.status(401).send('Invalid Token');
    }
  };
}
```

#### Endpoints definition (`api-gateway/src/modules/http/routes/index.js`)
```javascript
// Patient Routes
router.post('/patient/reports', roleMiddleware(['PATIENT']), upload.single('report'), PatientController.uploadReport);
router.get('/patient/history', roleMiddleware(['PATIENT', 'DOCTOR']), PatientController.getHistory);

// Appointment Routes
router.post('/appointments', roleMiddleware(['PATIENT']), AppointmentController.book);
router.get('/appointments/doctor/:id', roleMiddleware(['DOCTOR', 'ADMIN']), AppointmentController.getByDoctor);

// AI Symptom Checker
router.post('/ai/symptoms', roleMiddleware(['PATIENT']), AIController.analyzeSymptoms);
```

#### Upload Handling (Multer in Gateway)
Use `multer` library strictly for handling multipart/form-data.
```javascript
import multer from 'multer';
const dest = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
export const upload = multer({ storage: dest });
```

---

### 6. Docker Configuration Update

Extending your `docker-compose.yml` to define the new microservices:

```yaml
version: '3.0'
services:
  # ... existing services ...

  patient-service:
    build:
      context: ./patient-service
    container_name: patient_service
    ports:
      - "50052"
    depends_on:
      - postgres
    networks: 
      - health_network

  payment-service:
    build:
      context: ./payment-service
    container_name: payment_service
    ports:
      - "50053"
    depends_on:
      - postgres
    networks: 
      - health_network

  notification-service:
    build:
      context: ./notification-service
    container_name: notification_service
    ports:
      - "50054"
    networks: 
      - health_network
```

---

### 7. Example API Requests

**1. Patient Authentication (Login)**
```http
POST /auth/login
Content-Type: application/json
{
  "email": "patient@mail.com",
  "password": "securepassword",
  "role": "PATIENT"
}
Response: { "token": "jwt_ey..." }
```

**2. Book Appointment & Initiate SAGA**
```http
POST /appointments
Authorization: Bearer <jwt_ey...>
Content-Type: application/json
{
  "doctorId": "uuid-123",
  "scheduleTime": "2026-10-12T10:00:00Z",
  "amount": 50.00
}
Response: 
{ 
  "appointmentId": "uuid-456", 
  "status": "CONFIRMED", 
  "telemedicine_link": "https://meet.healthcare.com/xyz123" 
}
```

**3. AI Symptom Checker**
```http
POST /ai/symptoms
Authorization: Bearer <jwt_ey...>
Content-Type: application/json
{
  "symptoms": ["headache", "fever", "nausea"]
}
Response: 
{ 
  "suggested_specialty": "General Medicine",
  "urgency": "Moderate"
}
```
