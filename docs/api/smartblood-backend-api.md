# SmartBlood Backend API & Real-Time Contract

**Base URL (REST):** `/api/v1` (Health checks at `/api/health` and `/api/health/ready`)  
**Source of Truth:** `backend/src/app.ts`, `backend/src/modules/*/routes.ts`, `backend/src/modules/*/schemas.ts`, `backend/src/sockets/index.ts`  
**Language & Stack:** 100% TypeScript (Express + Zod + JWT + MSSQL 2019 + Socket.io v4)

---

## 1. Standard Response Envelope & Error Codes

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Optional success description",
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable Vietnamese error message",
    "details": []
  }
}
```

HTTP Status Mapping: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict` (84-day interval, duplicate check-in, donor identity mismatch, stock insufficient), `422 Unprocessable Entity` (`VALIDATION_ERROR` from Zod), `429 Too Many Requests`, `500 Internal Server Error`, `503 Service Unavailable` (`/api/health/ready`).

---

## 2. Health & Readiness

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Liveness probe returning service timestamp |
| `GET` | `/api/health/ready` | Public | Executes `SELECT 1` via `mainPool` (`503 DATABASE_NOT_READY` on failure) |

---

## 3. Module 1 — Events & QR (`/api/v1/events`)

| Method | Path | Role(s) | Schema / Query | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/events` | `ADMIN`, `RED_CROSS_STAFF` | `createEventSchema`: `tenSuKien`, `diaDiem`, `diaChiChiTiet?`, `ngayToChuc` (`YYYY-MM-DD`), `gioBatDau` (`HH:mm`), `gioKetThuc` (`HH:mm`), `chiTieuSoLuong`, `ghiChu?` | Generates unique event code (`SK-...`) |
| `GET` | `/api/v1/events` | `ADMIN`, `RED_CROSS_STAFF` | `listEventsQuerySchema`: `page`, `limit` (`10\|20\|50\|all`), `trangThai?`, `search?`, `sortOrder` (`asc\|desc`) | Paginated event list |
| `GET` | `/api/v1/events/:id/progress` | `ADMIN`, `RED_CROSS_STAFF` | `eventIdParamSchema`: `id` (UUID) | Real-time completion progress & counts |
| `GET` | `/api/v1/events/:id/qr-download` | Public | `qrDownloadQuerySchema`: `format` (`png\|svg\|pdf`) | Cached in `MemoryStore` (max 100, `Cache-Control: public, max-age=86400`) |
| `PATCH` | `/api/v1/events/:id/status` | `ADMIN` | `updateEventStatusSchema`: `trangThai` (`UPCOMING\|ACTIVE\|COMPLETED\|CANCELLED`) | Writes `AuditLogs` |

---

## 4. Module 2 — Public Check-In & Triage (`/api/v1/public/checkin`)

| Method | Path | Rate Limit | Schema | Behavior |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/public/checkin/lookup-cccd` | `60 req/min/IP` + `5 failed lookups/hr/CCCD` | `lookupCccdSchema`: `cccd` (12 digits), `ngaySinh` (`YYYY-MM-DD`) | Wrong DOB returns `{ isNewDonor: true }` without PII leak; enforces 84-day rule |
| `POST` | `/api/v1/public/checkin/submit` | `300 req/min/IP` | `submitCheckInSchema`: `clientRequestId` (UUID), `eventId`, `cccd`, `hoTen`, `ngaySinh`, `gioiTinh`, `soDienThoai`, `diaChi`, `luongMauDangKy` (`250\|350\|450`), `daDongYXuLyDuLieu` (`true`), `khaiBaoSucKhoe` | Idempotent by `clientRequestId`; seals `Rh-` donor immediately if known rare; returns `checkInId`, `stt`, `trackingToken`; emits `donor:checkin_submitted` |

---

## 5. Module 3 — Medical Workflow (`/api/v1/medical`)

All endpoints require `RED_CROSS_STAFF` or `ADMIN`.

| Method | Path | Schema | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/v1/medical/queue/:eventId` | `queueListQuerySchema`: `page`, `limit`, `buocHienTai?`, `search?`, `sortOrder` | Event triage queue |
| `POST` | `/api/v1/medical/exam/clinical` | `clinicalExamSchema`: `checkInId`, `huyetApTamThu`, `huyetApTamTruong`, `nhipTim`, `canNang`, `theTichDuocPhep?`, `ketLuan` (`DAT\|TAM_HOAN`), `lyDo?` | Transitions `CHO_KHAM -> CHO_XET_NGHIEM` or `TAM_HOAN`; emits `medical:step_updated` |
| `POST` | `/api/v1/medical/exam/rapid-test` | `rapidTestSchema`: `checkInId`, `hemoglobin`, `testHbsAg`, `testHCV`, `testHIV`, `nhomMauXacNhan`, `rhFactor` | Transitions `CHO_XET_NGHIEM -> CHO_LAY_MAU` or `TAM_HOAN`; returns `isRareBloodCandidate` |
| `POST` | `/api/v1/medical/blood-bag/collect` | `collectBloodBagSchema`: `checkInId`, `theTichThucTe` (`250\|350\|450`), `viTriKhoLanhTamThoi?` | Creates `BAG-{YearVN}-{6-digit}` in `QUARANTINE`, records `DonationHistory`, updates event progress |

---

## 6. Module 4 — Inventory & Rare Blood Vault (`/api/v1/inventory`, `/api/v1/vault`)

### Inventory (`/api/v1/inventory`)
| Method | Path | Role(s) | Schema / Query | Behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/inventory/summary` | `ADMIN`, `RED_CROSS_STAFF` | — | Reads `dbo.vw_BloodInventorySummary` |
| `GET` | `/api/v1/inventory/fefo-list` | `ADMIN`, `RED_CROSS_STAFF` | `fefoListQuerySchema`: `page`, `limit`, `nhomMau?`, `rhFactor?`, `expiryLevel?` (`RED\|YELLOW\|GREEN`), `search?`, `sortOrder` | Ordered by `ngayHetHan ASC` |
| `GET` | `/api/v1/inventory/quarantine` | `ADMIN`, `RED_CROSS_STAFF` | `quarantineListQuerySchema`: `page`, `limit`, `nhomMau?`, `rhFactor?`, `search?` | Bags awaiting screening confirmation |
| `POST` | `/api/v1/inventory/blood-bag/:id/lab-result` | `ADMIN`, `RED_CROSS_STAFF` | `recordLabResultSchema`: `ketQuaSangLoc` (`DAT\|KHONG_DAT`), `nhomMauChinhThuc`, `rhFactorChinhThuc`, `viTriKhoLanh?` | Moves to `IN_STOCK` or `DISCARDED`; if `DAT` & `Rh-`, seals PII via AES-256-GCM & nulls plaintext `Donors.soDienThoai/diaChi` |
| `GET` | `/api/v1/inventory/audit-logs` | `ADMIN` | — | Reads immutable `AuditLogs` via `analyticsPool` |

### Zero-Trust Vault (`/api/v1/vault`)
| Method | Path | Guard | Schema | Behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/vault/donors` | `ADMIN` | — | Returns masked phones (`091***678`) |
| `POST` | `/api/v1/vault/request-unlock` | `ADMIN` | `requestVaultUnlockSchema`: `donorId`, `maBenhAn` | Requires at least 1 other active `laNguoiPheDuyet = true` admin; emails 6-digit OTP solely to approvers (TTL 5m) |
| `POST` | `/api/v1/vault/approve` | `requireApprover` (`ADMIN` + `laNguoiPheDuyet`) | `approveVaultUnlockSchema`: `requestId`, `otp` | Enforces `requesterId <> approverId` (dual custody); 3 failed OTPs evict token; grants 15-min reveal window |
| `GET` | `/api/v1/vault/:requestId/reveal` | `ADMIN` | `requestIdParamSchema` | Decrypts AES-256-GCM contact if `APPROVED` and `expiresAt > SYSUTCDATETIME()`, writes `AuditLogs` |

---

## 7. Module 5 — Hospital & Emergency (`/api/v1/hospital`, `/api/v1/emergency`)

| Method | Path | Role(s) | Schema | Behavior |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/hospital/inventory-overview` | `HOSPITAL_STAFF`, `ADMIN` | — | Aggregated stock levels without bag barcodes or donor PII |
| `POST` | `/api/v1/hospital/emergency-alert` | `HOSPITAL_STAFF` (`emergencyAlertLimiter`: skipped for active `HOSPITAL_STAFF`) | `emergencyAlertSchema`: `bloodType`, `rhFactor`, `unitsNeeded`, `urgencyLevel` (`NGUY_CAP\|RAT_KHAN`), `patientCaseId` | Broadcasts `emergency:red_alert`; triggers backup email escalation if unacknowledged within timeout |
| `GET` | `/api/v1/hospital/emergency-requests` | `HOSPITAL_STAFF`, `RED_CROSS_STAFF`, `ADMIN` | — | Scoped to own hospital for `HOSPITAL_STAFF` |
| `POST` | `/api/v1/hospital/emergency/:id/acknowledge` | `RED_CROSS_STAFF`, `ADMIN` | `emergencyIdParamSchema` | Cancels escalation timer |
| `POST` | `/api/v1/emergency/:id/acknowledge` | `RED_CROSS_STAFF`, `ADMIN` | `emergencyIdParamSchema` | Alias under `/api/v1/emergency` |
| `POST` | `/api/v1/hospital/dispatch` | `ADMIN`, `RED_CROSS_STAFF` | `dispatchBloodBagsSchema`: `hospitalId`, `bloodType`, `rhFactor`, `unitsNeeded`, `bienSoXe`, `taiXeHotline`, `emergencyRequestId?` | FEFO allocation via `UPDLOCK, ROWLOCK, READPAST` (`IN_STOCK -> IN_TRANSIT`) |
| `GET` | `/api/v1/hospital/dispatches` | `ADMIN`, `RED_CROSS_STAFF`, `HOSPITAL_STAFF` | `listDispatchesQuerySchema` | Scoped for `HOSPITAL_STAFF` |
| `POST` | `/api/v1/hospital/verify-and-receive` | `HOSPITAL_STAFF` | `verifyAndReceiveSchema`: `bagCode`, `temperatureRecorded` | Anti-IDOR destination check (`destinationHospitalId === Users.hospitalId`); closes loop & sends thank-you email |

---

## 8. Module 6 — Auth, Admin Users & Donor Portal (`/api/v1/auth`, `/api/v1/admin/users`, `/api/v1/donor`)

| Method | Path | Guard | Schema / Query | Behavior |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register-donor` | `authRateLimiter` | `cccd`, `ngaySinh`, `email`, `matKhau` | Creates `PENDING_VERIFY` account linked to verified `Donors` row + sends 6-digit email OTP (5m TTL) |
| `POST` | `/api/v1/auth/verify-email-otp` | `authRateLimiter` | `email`, `cccd`, `ngaySinh`, `otp` | Activates `ACTIVE` user after max 3 attempts |
| `POST` | `/api/v1/auth/login` | `authRateLimiter` | `identifier` (email or CCCD), `matKhau` | Progressive temp lock on 5 failures (3m -> 15m -> 1h via `MemoryStore`, never auto-`LOCKED`); returns JWT (`2h` TTL) |
| `POST` | `/api/v1/auth/forgot-password` | `authRateLimiter` | `email` | Uniform 200 anti-enumeration response; 60s resend cooldown |
| `POST` | `/api/v1/auth/reset-password` | `authRateLimiter` | `email`, `otp`, `matKhauMoi` | Resets bcrypt hash & clears temp brute-force lock |
| `GET` | `/api/v1/admin/users` | `ADMIN` | `vaiTro?`, `trangThai?`, `page`, `limit` | Lists accounts with real-time `tempLocked` flag |
| `PATCH` | `/api/v1/admin/users/:userId/status` | `ADMIN` | `trangThai` (`ACTIVE\|LOCKED`) | Calls `sp_AdminUpdateUserStatus` (blocks self-lock) & clears `lock:user:{userId}` on unlock |
| `GET` | `/api/v1/donor/history` | `REGISTERED_DONOR` | `historyListQuerySchema` | Returns donation history + 84-day recovery progress |
| `GET` | `/api/v1/donor/certificate/:historyId/download` | `REGISTERED_DONOR` | `historyIdParamSchema` | Streams landscape A4 PDF certificate with QR verification URL |

---

## 9. Socket.io Real-Time Namespaces

| Namespace | Handshake Auth | Server -> Client Events | Privacy & Masking Rules |
| --- | --- | --- | --- |
| `/staff` | JWT (`RED_CROSS_STAFF`, `ADMIN`) + optional `eventId` room | `donor:checkin_submitted`, `medical:step_updated`, `event:progress_updated` | Full clinical & queue details scoped to `event:{eventId}` |
| `/donor` | `checkInId` + `trackingToken` validated against DB | `medical:step_updated` (`{ checkInId, stt, buocHienTai }`) | **Never** transmits `lyDoTamHoan` or sensitive notes |
| `/display` | Valid `eventId` (`UPCOMING` or `ACTIVE`) | `queue:updated` (`{ stt, buocHienTai }`) | **Never** transmits `hoTen`, `cccd`, `soDienThoai`, or `lyDoTamHoan` |
| `/emergency` | JWT (`RED_CROSS_STAFF`, `ADMIN`) | `emergency:red_alert` | Red-alert dispatch payload within `< 1s` |
| `/inventory` | JWT (`ADMIN`, `RED_CROSS_STAFF`, `HOSPITAL_STAFF`) | `inventory:stock_changed` | Group/Rh summary updates |
| `/hospital` | JWT (`ADMIN`, `RED_CROSS_STAFF`, `HOSPITAL_STAFF`) | `hospital:bag_received` | Barcode + receiving hospital confirmation |
