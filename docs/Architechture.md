# TÀI LIỆU KIẾN TRÚC HỆ THỐNG (ARCHITECHTURE.MD)
## DỰ ÁN: SMARTBLOOD - HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA

---

## 1. TỔNG QUAN NỀN TẢNG CÔNG NGHỆ

Hệ thống là **một ứng dụng Node.js + Express** duy nhất (Modular Monolith: 6 module nghiệp vụ tách thành 6 thư mục), chạy **một instance** sau Nginx. Cách này đơn giản để học, để code và để vận hành; không dùng microservices.

> **Quy mô thiết kế (giả định, cần xác nhận với Hội CTĐ):** tối đa ~2.000 lượt check-in mỗi sự kiện, đỉnh ≤ 50 request/giây ngay sau khi mở sự kiện. Một instance Node.js + SQL Server xử lý được quy mô này. Nếu thực tế lớn hơn nhiều thì mới cân nhắc chạy nhiều instance (khi đó phải thêm Redis để dùng chung bộ đếm/OTP và đồng bộ Socket.io).
>
> **Mục tiêu hiệu năng thống nhất:** API thông thường p95 < 300ms; phát báo động đỏ tới màn hình Hội CTĐ < 1 giây.

```
                            ┌──────────────────────────────────────────────┐
                            │                  TECH STACK                  │
                            ├───────────────────┬──────────────────────────┤
                            │ Frontend UI       │ React 19 + TypeScript    │
                            │ Build tool        │ Vite                     │
                            │ Styling           │ Tailwind CSS             │
                            │ Client Caching    │ sessionStorage (bản nháp)│
                            │ Backend           │ Node.js + Express (TS)   │
                            │ Database          │ Microsoft SQL Server 2019│
                            │ Database Driver   │ mssql (gọi Stored Proc)  │
                            │ Real-time I/O     │ Socket.io                │
                            │ Reverse Proxy     │ Nginx                    │
                            │ Edge Network      │ Cloudflare (tùy chọn)    │
                            │ Containerization  │ Docker & Docker Compose  │
                            └───────────────────┴──────────────────────────┘
```

---

## 2. HẠ TẦNG & PHÂN LUỒNG TRUY CẬP (INFRASTRUCTURE TOPOLOGY)

```
                  [Khách vãng lai / Donor]            [Bác sĩ / Nhân viên Bệnh viện]
                  (Mobile: Quét QR Check-in)          (Web: Quét nhận túi máu / 115)
                               │                                     │
                               └──────────────────┬──────────────────┘
                                                  ▼
                                     ┌─────────────────────────┐
                                     │  CLOUDFLARE (tùy chọn)  │
                                     │  Static Cache, WAF      │
                                     └────────────┬────────────┘
                                                  ▼
                                     ┌─────────────────────────┐
                                     │   NGINX REVERSE PROXY   │
                                     │  SSL, Gzip, WebSocket,  │
                                     │  real_ip                │
                                     └────────────┬────────────┘
                                                  ▼
                                     ┌─────────────────────────┐
                                     │  NODE.JS + EXPRESS      │
                                     │  (1 instance)           │
                                     │  Middleware: JWT, Role, │
                                     │  Rate limit, Validate   │
                                     │  + 6 module nghiệp vụ   │
                                     │  + Socket.io            │
                                     │  + Bộ nhớ tạm (OTP,     │
                                     │    bộ đếm khóa)         │
                                     └────────────┬────────────┘
                                                  ▼
                                     ┌─────────────────────────┐
                                     │  MS SQL SERVER 2019     │
                                     │  HienMauDB              │
                                     │  Pool "main" (max 40)   │
                                     │  Pool "priority" (max 10)│
                                     └─────────────────────────┘
```

### 2.1 Nginx Reverse Proxy
* **SSL Termination:** Nginx giải mã HTTPS/TLS, giảm tải cho Node.js.
* **Nén động (Gzip / Brotli)** cho JSON và tài nguyên tĩnh; phục vụ luôn file tĩnh của frontend (build từ Vite).
* **Health check:** ứng dụng có endpoint `/api/health` để Docker kiểm tra và tự khởi động lại khi lỗi.
* **WebSocket Proxying:** `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
* **IP thật của client (bắt buộc nếu dùng Cloudflare):** cấu hình `set_real_ip_from <dải IP Cloudflare>` và `real_ip_header CF-Connecting-IP;`. Trong Express đặt `app.set('trust proxy', 1)`. Nếu bỏ qua, mọi request mang IP của Cloudflare/Nginx và bộ giới hạn tốc độ sẽ chặn nhầm toàn bộ người dùng.

### 2.2 Cấu trúc ứng dụng (một codebase, 6 module — 100% TypeScript)
Một ứng dụng Express viết bằng TypeScript (strict mode). Các việc chung do **middleware** đảm nhận, đăng ký theo thứ tự trong `app.ts`:
1. `helmet`, `cors`, ghi log (`winston`), parse JSON.
2. **Rate limit** (`express-rate-limit`, lưu trong bộ nhớ): khóa theo **IP + định danh nghiệp vụ**, xem `Skill.md` mục 2.
3. **Xác thực & phân quyền:** middleware `verifyJwt` + `requireRole(...)` (RBAC: `ADMIN`, `RED_CROSS_STAFF`, `HOSPITAL_STAFF`, `REGISTERED_DONOR`). Cờ `laNguoiPheDuyet` cho phép `ADMIN` lãnh đạo duyệt mở két.
4. **Kiểm tra dữ liệu đầu vào** bằng `zod` (mỗi route khai báo schema và suy diễn kiểu TypeScript bằng `z.infer<typeof ...>`).
5. **Xử lý lỗi tập trung:** class `AppError` và một error-handler cuối cùng trả đúng mã HTTP.

Mỗi module là một thư mục gồm: `routes.ts` (khai báo route + middleware), `service.ts` (nghiệp vụ), `repository.ts` (gọi Stored Procedure), `schemas.ts` (zod + TS types). 6 module: `event-qr`, `public-checkin`, `medical-workflow`, `inventory-vault`, `hospital`, `donor-portal`. Module không truy vấn bảng của module khác mà gọi hàm công khai trong `service.ts` của module đó.

**Hai connection pool** (hai đối tượng `mssql.ConnectionPool`): pool `main` (max 40) cho check-in và tác vụ thường; pool `priority` (max 10) dành riêng cho xuất kho, nhận máu và cấp cứu. Khi hàng ngàn người quét QR cùng lúc, luồng cấp cứu vẫn có kết nối để chạy.

### 2.3 Cấu trúc thư mục dự án (Project Folder Layout)
```text
smartblood/
├── backend/
│   ├── src/
│   │   ├── config/                 # Cấu hình env, 2 pool MSSQL (main & priority)
│   │   ├── middleware/             # verifyJwt, requireRole, rateLimiter, validate, errorHandler
│   │   ├── modules/                # 6 module nghiệp vụ độc lập
│   │   │   ├── event-qr/           # routes.ts, service.ts, repository.ts, schemas.ts
│   │   │   ├── public-checkin/
│   │   │   ├── medical-workflow/
│   │   │   ├── inventory-vault/
│   │   │   ├── hospital/
│   │   │   └── donor-portal/
│   │   ├── sockets/                # Đăng ký 6 namespace Socket.io & handshake JWT
│   │   ├── shared/                 # AppError, memory-store, mailer, vault-crypto, logger
│   │   ├── types/                  # Kiểu dữ liệu TypeScript dùng chung (DTO, Express Request)
│   │   ├── app.ts                  # Khởi tạo Express & thứ tự middleware
│   │   └── server.ts               # HTTP server + Socket.io + Graceful shutdown
│   ├── tsconfig.json               # Cấu hình TypeScript strict mode
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Trang .tsx theo vai trò (Check-in QR, Bàn y tế, Kho, Bệnh viện, 115)
│   │   ├── components/             # UI .tsx dùng chung (DataTable, Skeleton, EmptyState, ErrorState)
│   │   ├── hooks/                  # Socket hooks, debounce, sessionStorage draft (.ts)
│   │   ├── services/               # API client (fetch wrapper .ts)
│   │   ├── types/                  # Kiểu dữ liệu TypeScript cho API & State
│   │   └── main.tsx
│   ├── tsconfig.json               # Cấu hình TypeScript strict mode
│   └── package.json
├── database/
│   ├── ddl/                        # Script tạo 15 bảng, index, view vw_BloodInventorySummary
│   └── stored-procedures/        # 100% SP ghi dữ liệu & nghiệp vụ y tế
├── tests/
│   ├── unit/                       # Kiểm thử service, vault-crypto, memory-store
│   ├── integration/                # Kiểm thử API Express + Stored Procedure
│   └── e2e/                        # Kiểm thử luồng đầu-cuối (check-in → khám → xuất kho)
├── docs/
│   ├── api/                        # Đặc tả API / OpenAPI
│   └── architecture/
│       └── adr/                    # Architecture Decision Records
├── nginx/                          # Cấu hình reverse proxy, SSL, gzip, WebSocket, real_ip
├── docker-compose.yml              # App + Nginx + healthcheck
├── .env.example                    # Mẫu biến môi trường (commit lên git)
└── .gitignore                      # Chặn .env, node_modules, logs
```

### 2.4 Chuẩn thiết kế API & Response Envelope
* **Đường dẫn REST:** tiền tố `/api/v1/...`, dùng `kebab-case` và danh từ số nhiều cho tài nguyên (ví dụ: `/api/v1/events`, `/api/v1/blood-bags`, `/api/v1/emergency-requests`). Thao tác không khớp CRUD dùng động từ ở cuối (ví dụ: `POST /api/v1/vault/unlock-requests`).
* **Bảo mật URL:** tuyệt đối **không** đưa dữ liệu cá nhân (`cccd`, `soDienThoai`, `ngaySinh`) vào URL path hay query string (tránh lộ trong access log của Nginx/Cloudflare); dùng `POST` với request body.
* **Tên trường JSON:** dùng `camelCase` thống nhất cho request body, query params và response body.
* **Mã HTTP chuẩn:** `200` (OK), `201` (Created), `204` (No Content), `400` (Bad Request), `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `409` (Conflict - ví dụ trùng check-in/hết hạn), `422` (Validation Failed), `429` (Too Many Requests), `500` (Internal Error).
* **Response Envelope thống nhất:**
```json
// Thành công (đơn lẻ)
{ "success": true, "data": { ... }, "message": "Tùy chọn" }

// Thành công (danh sách phân trang - khớp DataTable 10/20/50/All)
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}

// Thất bại
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Thông báo dễ hiểu cho người dùng",
    "details": [ ... ]
  }
}
```

---

## 3. CACHING & BỘ NHỚ TẠM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TIER 1: CLIENT-SIDE (sessionStorage)                                     │
│    - Lưu tạm bản nháp form (KHÔNG gồm CCCD) khi mạng di động chập chờn      │
│    - Danh mục tĩnh (danh sách nhóm máu, quận/huyện)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TIER 2: EDGE CDN (Cloudflare, tùy chọn)                                  │
│    - Bundle JS, CSS, Web Fonts, SVG Logo                                    │
│    - Ảnh mã QR sự kiện: 'Cache-Control: public, max-age=86400'              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TIER 3: BỘ NHỚ TRONG ỨNG DỤNG (Map có thời hạn)                          │
│    - Mã OTP 6 số (TTL = 300s, tối đa số lần thử theo từng loại OTP)         │
│    - Bộ đếm sai đăng nhập / khóa tạm (Key: 'lock:user:{id}')                │
│    - Bộ đếm sai ngày sinh khi tra cứu theo CCCD (Key: 'lookup:{cccd}')      │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Giới hạn đã chấp nhận (`shortcut`):** Tier 3 nằm trong bộ nhớ của tiến trình, nên khi khởi động lại ứng dụng thì OTP đang chờ và bộ đếm bị mất (người dùng chỉ cần xin OTP mới), và chỉ chạy được **một instance**. Khi cần chạy nhiều instance thì chuyển Tier 3 sang Redis.
>
> **Không cache tồn kho và danh sách sự kiện**: truy vấn SQL (view/index) đủ nhanh ở quy mô này; chỉ cân nhắc thêm cache nếu đo được chậm.
>
> **Chống xuất trùng túi máu** do SQL Server đảm nhận (`UPDLOCK, ROWLOCK, READPAST` trong Stored Procedure), không cần khóa phân tán.

---

## 4. KIẾN TRÚC PHẦN MỀM (3 LỚP THEO MODULE)

Trong mỗi module backend, mã được chia 3 lớp rõ ràng (đủ đơn giản để cả nhóm cùng nắm):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. ROUTES / CONTROLLER (routes.ts)                                          │
│    - Khai báo endpoint, gắn middleware (auth, role, rate limit, zod)        │
│    - Chỉ nhận request, gọi service, trả response; không chứa nghiệp vụ      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. SERVICE (service.ts)                                                     │
│    - Nghiệp vụ: tra cứu CCCD, tiến trình 4 bước, xuất kho FEFO, duyệt két   │
│    - Quy tắc y tế (84 ngày, ngưỡng sinh hiệu) có bản chính nằm trong        │
│      Stored Procedure; service chỉ gọi và dịch lỗi sang AppError            │
│    - Phát sự kiện Socket.io, gửi email/SMS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. REPOSITORY (repository.ts)                                               │
│    - Gọi Stored Procedure MSSQL có Transaction qua thư viện mssql           │
│    - Luôn truyền tham số (không ghép chuỗi SQL)                             │
└─────────────────────────────────────────────────────────────────────────────┘
Dùng chung (thư mục shared/): AppError, bộ nhớ tạm (OTP/bộ đếm), mailer (nodemailer),
mã hóa AES-256-GCM (vault-crypto), cấu hình pool.
```

### 4.1 Kiến trúc Xử lý lỗi tập trung (`AppError` & Global Error Handler)
* **Phân loại lỗi:**
  * **Operational Error** (`isOperational = true`): Lỗi nghiệp vụ/đầu vào dự kiến (sai dữ liệu `zod` → `422`, chưa đủ 84 ngày → `409`, thiếu máu tồn kho `THROW 50001` từ SP → `409`, hết hạn quyền mở két → `403`, không tìm thấy → `404`). Trả về `error.code` và `error.message` rõ ràng cho client.
  * **Programmer / System Error** (`isOperational = false`): Lỗi ngoại lệ không mong muốn (mất kết nối DB, lỗi cú pháp). Ghi log đầy đủ ở server qua `winston`, **không** trả stack trace hay chi tiết nội bộ ra client (chỉ trả `500 INTERNAL_ERROR`).
* **Luồng bắt lỗi chuẩn:**
  * Mọi route async bọc bằng `asyncHandler(fn)` để chuyển lỗi về `next(err)` (không nuốt lỗi).
  * `repository.ts` / `service.ts` ánh xạ mã lỗi tùy biến từ Stored Procedure (`50001`, `50002`...) sang `AppError` tương ứng.
  * Một `errorHandler(err, req, res, next)` duy nhất đặt cuối `app.ts` chuẩn hóa đầu ra theo Response Envelope.

---

## 5. THIẾT KẾ CƠ SỞ DỮ LIỆU (15 BẢNG QUAN HỆ CỐT LÕI)

CSDL: **Microsoft SQL Server 2019**, tên `HienMauDB`. Mọi thao tác ghi đều qua Stored Procedure. **Quy ước thời gian:** lưu `DATETIME2` theo UTC (`SYSUTCDATETIME()`); các quy tắc tính theo ngày (84 ngày, STT trong ngày) quy đổi sang múi giờ Việt Nam (UTC+7) trước khi so sánh.

```
Users ──< Donors ──< DonationHistory >── BloodBags ──< HospitalDispatchBags >── HospitalDispatches ──> Hospitals
              │              ▲                 ▲                                         ▲                  ▲
              │              │                 │                                         │                  │
              ├──< RareBloodVault              │                                  EmergencyRequests ───────┘
              │         ▲                      │
              │   VaultUnlockRequests    DonorCheckIns ──< ClinicalExams
              ▼                                │    └────< ScreeningTests
        DonorCheckIns >── DonationEvents       │
                                         AuditLogs (ghi nhận từ mọi bảng)
```

### Chi tiết 15 bảng DDL:
1. **`Users`**: (`id`, `email`, `matKhauHash`, `vaiTro`, `hospitalId`, `laNguoiPheDuyet`, `emailDaXacThuc`, `trangThai`). `hospitalId` bắt buộc với `HOSPITAL_STAFF`, dùng để xác định bệnh viện của người đăng nhập. `laNguoiPheDuyet` = 1 chỉ cho `ADMIN` cấp lãnh đạo. `trangThai`: `PENDING_VERIFY` | `ACTIVE` | `LOCKED` (chỉ Admin đặt `LOCKED` thủ công). Bộ đếm sai và khóa tạm 3 phút nằm trong bộ nhớ ứng dụng, không lưu ở bảng này.
2. **`Donors`**: (`id`, `cccd` UNIQUE, `hoTen`, `ngaySinh`, `gioiTinh`, `soDienThoai`, `diaChi`, `nhomMau`, `rhFactor`, `laNhomMauHiem`, `userId`). Với người có `laNhomMauHiem = 1`, `soDienThoai` và `diaChi` luôn để `NULL` ở bảng này; dữ liệu liên hệ chỉ tồn tại dạng mã hóa trong `RareBloodVault`.
3. **`DonationHistory`**: (`id`, `donorId`, `checkInId`, `bloodBagId`, `ngayHien`, `theTich`, `trangThai`). **Nguồn sự thật duy nhất** cho luật 84 ngày: ngày hiến gần nhất = `MAX(ngayHien)` của các lần `HOAN_THANH`.
4. **`RareBloodVault`**: (`id`, `donorId`, `nhomMauHiem`, `keyVersion`, `encryptedPhone`, `ivPhone`, `authTagPhone`, `encryptedAddress`, `ivAddress`, `authTagAddress`, `createdAt`). **Mỗi trường có IV và authTag riêng** (GCM không được dùng lại IV với cùng khóa).
5. **`VaultUnlockRequests`**: (`id`, `requesterId`, `approverId`, `donorId`, `maBenhAn`, `trangThai`, `createdAt`, `approvedAt`, `expiresAt`). `trangThai`: `PENDING` | `APPROVED` | `REJECTED` | `EXPIRED`. Ràng buộc: `requesterId <> approverId`.
6. **`DonationEvents`**: (`id`, `maSuKien`, `tenSuKien`, `diaDiem`, `ngayToChuc`, `gioBatDau`, `gioKetThuc`, `chiTieuSoLuong`, `soLuongThucTe`, `qrCodeUrl`, `trangThai`).
7. **`DonorCheckIns`**: (`id`, `eventId`, `donorId`, `stt`, `clientRequestId` UNIQUE, `thoiGianCheckIn`, `luongMauDangKy`, `daDongYXuLyDuLieu`, `khaiBaoSucKhoe`, `buocHienTai`, `lyDoTamHoan`). UNIQUE (`eventId`, `donorId`). `clientRequestId` là UUID do client sinh, dùng để chống tạo trùng khi gửi lại.
8. **`ClinicalExams`**: (`id`, `checkInId`, `bacSiId`, `huyetApTamThu`, `huyetApTamTruong`, `nhipTim`, `canNang`, `theTichDuocPhep`, `ketLuan`, `lyDoTuChoi`).
9. **`ScreeningTests`**: Xét nghiệm nhanh mao mạch tại chỗ (`id`, `checkInId`, `kyThuatVienId`, `hemoglobin`, `hbsagTest`, `hcvTest`, `hivTest`, `ketLuan`).
10. **`BloodBags`**: (`id`, `checkInId`, `maVachTuiMau` UNIQUE, `qrCode`, `nhomMau`, `rhFactor`, `theTich`, `ngayLayMau`, `ngayHetHan`, `trangThai`, `destinationHospitalId`, `ketQuaSangLoc`, `viTriKhoLanh`). `destinationHospitalId` gán lúc xuất kho (NULL trước đó). `ketQuaSangLoc` là kết quả xét nghiệm sàng lọc chính thức.
11. **`Hospitals`**: (`id`, `tenBenhVien`, `diaChi`, `hotlineCapCuu`, `toaDoLat`, `toaDoLng`, `trangThaiHopTac`).
12. **`HospitalDispatches`**: Lệnh xuất kho (`id`, `hospitalId`, `emergencyRequestId`, `bienSoXe`, `taiXeHotline`, `thoiGianXuatKho`, `trangThaiGiao`). Biển số và hotline do nhân viên nhập tay (115 là hệ thống bên ngoài, không theo dõi GPS).
13. **`HospitalDispatchBags`**: Liên kết lệnh xuất với từng túi (`dispatchId`, `bagId`, `thoiGianTiepNhan`, `nhanVienNhanId`, `nhietDoGhiNhan`). Việc nhận máu được ghi theo từng túi.
14. **`EmergencyRequests`**: (`id`, `hospitalId`, `bacSiYeuCauId`, `maBenhAn`, `nhomMauCan`, `rhFactor`, `soLuongTui`, `mucDoKhan`, `trangThaiXuLy`, `thoiGianXacNhan`, `nguoiXacNhanId`).
15. **`AuditLogs`**: (`id`, `userId`, `hanhDong`, `chiTiet`, `diaChiIP`, `thoiGianTao`, `hashTruoc`, `hash`). Tài khoản ứng dụng chỉ có quyền `INSERT`, không có `UPDATE`/`DELETE`; chuỗi `hash` (băm bản ghi trước + bản ghi hiện tại) giúp phát hiện sửa/xóa. SQL Server 2019 không có Ledger table nên dùng cách này.

> **Tồn kho** không có bảng riêng: tổng hợp tính bằng `GROUP BY` trên `BloodBags` có `trangThai = 'IN_STOCK'` (view `vw_BloodInventorySummary`), không cache.

### 5.1 Máy trạng thái

**Lượt check-in (`DonorCheckIns.buocHienTai`):**
```
CHO_KHAM ──(khám đạt)──> CHO_XET_NGHIEM ──(XN đạt)──> CHO_LAY_MAU ──(lấy máu)──> HOAN_THANH
   │                           │
   └────(không đạt)────────────┴──> TAM_HOAN  (kèm lyDoTamHoan; kết thúc)
```

**Túi máu (`BloodBags.trangThai`):**
```
QUARANTINE ──(sàng lọc chính thức đạt)──> IN_STOCK ──(xuất kho)──> IN_TRANSIT ──(BV quét nhận)──> HOSPITAL_RECEIVED
    │                                        │
    └──(không đạt)──> DISCARDED              └──(quá hạn)──> EXPIRED
```
Túi máu mới lấy luôn vào `QUARANTINE`. Chỉ túi `IN_STOCK` mới được xuất kho hoặc hiển thị trong tồn kho khả dụng.

---

## 6. QUY CHUẨN STORED PROCEDURE VỚI TRANSACTION & UPDLOCK

### Quy chuẩn SP Xuất Kho FEFO có khóa chống tranh chấp:
```sql
CREATE PROCEDURE sp_DispatchBloodBagsFEFO
    @HospitalId UNIQUEIDENTIFIER,
    @BloodType VARCHAR(2),
    @RhFactor CHAR(1),
    @UnitsNeeded INT,
    @BienSoXe NVARCHAR(20),
    @TaiXeHotline VARCHAR(15),
    @EmergencyRequestId UNIQUEIDENTIFIER = NULL,
    @DispatchedBy UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DispatchId UNIQUEIDENTIFIER = NEWID();
        DECLARE @SelectedBags TABLE (BagId UNIQUEIDENTIFIER);

        -- 1. Chọn túi cận hạn nhất, khóa dòng; READPAST bỏ qua dòng đang bị giao dịch khác khóa
        INSERT INTO @SelectedBags (BagId)
        SELECT TOP (@UnitsNeeded) id
        FROM BloodBags WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE nhomMau = @BloodType
          AND rhFactor = @RhFactor
          AND trangThai = 'IN_STOCK'
          AND ngayHetHan > SYSUTCDATETIME()
        ORDER BY ngayHetHan ASC; -- Thuật toán FEFO

        IF (SELECT COUNT(*) FROM @SelectedBags) < @UnitsNeeded
            THROW 50001, N'Không đủ lượng máu tồn kho đạt chuẩn theo yêu cầu!', 1;

        -- 2. Tạo lệnh xuất và gắn từng túi vào lệnh
        INSERT INTO HospitalDispatches (id, hospitalId, emergencyRequestId, bienSoXe, taiXeHotline, thoiGianXuatKho, trangThaiGiao)
        VALUES (@DispatchId, @HospitalId, @EmergencyRequestId, @BienSoXe, @TaiXeHotline, SYSUTCDATETIME(), 'IN_TRANSIT');

        INSERT INTO HospitalDispatchBags (dispatchId, bagId)
        SELECT @DispatchId, BagId FROM @SelectedBags;

        -- 3. Cập nhật trạng thái và bệnh viện đích của túi máu
        UPDATE BloodBags
        SET trangThai = 'IN_TRANSIT',
            destinationHospitalId = @HospitalId,
            updatedAt = SYSUTCDATETIME()
        WHERE id IN (SELECT BagId FROM @SelectedBags);

        -- 4. Ghi nhật ký kiểm toán trong cùng transaction
        INSERT INTO AuditLogs (id, userId, hanhDong, chiTiet, thoiGianTao)
        VALUES (NEWID(), @DispatchedBy, 'DISPATCH_BLOOD', CONCAT(N'dispatch=', @DispatchId, N'; units=', @UnitsNeeded), SYSUTCDATETIME());
        -- (hashTruoc/hash được tính trong SP ghi log dùng chung sp_WriteAuditLog)

        COMMIT TRANSACTION;
        SELECT @DispatchId AS dispatchId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
```
**Lưu ý chung cho mọi SP:** `SET XACT_ABORT ON`; chuỗi tiếng Việt phải có tiền tố `N'...'`; cột văn bản tiếng Việt dùng `NVARCHAR`; chỉ `ROLLBACK` khi `@@TRANCOUNT > 0`.

### SP nhận máu tại bệnh viện (`sp_HospitalReceiveBloodBag`)
Tham số `@BagCode`, `@ReceiverUserId`, `@NhietDo`. `hospitalId` **lấy từ `Users.hospitalId` của người đăng nhập**, không nhận từ client. SP kiểm tra `BloodBags.destinationHospitalId = hospitalId`, đổi trạng thái `HOSPITAL_RECEIVED`, ghi `HospitalDispatchBags.thoiGianTiepNhan` và AuditLogs; khi mọi túi trong lệnh đã nhận thì `HospitalDispatches.trangThaiGiao = 'DELIVERED'`.

---

## 7. MÔ HÌNH BẢO MẬT ZERO-TRUST KÉT MÁU HIẾM (RARE BLOOD VAULT)

Nguyên tắc: người yêu cầu và người phê duyệt là **hai tài khoản khác nhau**; người phê duyệt tự nhập OTP trong **phiên đăng nhập của chính mình**, OTP không bao giờ được chuyển miệng cho người yêu cầu.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin (Người yêu cầu)
    actor Director as Lãnh đạo Hội CTĐ (laNguoiPheDuyet = 1)
    participant App as Express (Vault Service)
    participant Mem as Bộ nhớ tạm (OTP, TTL 5 phút)
    participant DB as MSSQL (RareBloodVault, VaultUnlockRequests)
    participant Audit as MSSQL (AuditLogs)

    Admin->>App: request-unlock (donorId + mã bệnh án)
    App->>DB: Tạo VaultUnlockRequests (PENDING)
    App->>Audit: Ghi nhật ký yêu cầu
    App->>Director: Thông báo (Socket + email) kèm OTP gửi riêng cho Lãnh đạo
    Director->>App: approve (JWT của chính Lãnh đạo + OTP)
    App->>Mem: Kiểm tra OTP (tối đa 3 lần thử)

    alt OTP hợp lệ và approver khác requester
        App->>DB: Đặt APPROVED, expiresAt = bây giờ + 15 phút
        App->>Audit: Ghi (ai yêu cầu, ai duyệt, lý do, mã ca bệnh, giờ)
        Admin->>App: reveal (mỗi lần xem)
        App->>DB: Kiểm tra grant còn hạn, đọc dữ liệu mã hóa
        App->>App: Giải mã AES-256-GCM (khóa theo keyVersion)
        App-->>Admin: SĐT (chỉ trả về khi grant còn hạn; hết hạn trả 403)
    else OTP sai / hết hạn / cùng một người
        App->>Audit: Ghi cảnh báo truy cập trái phép
        App-->>Director: 403 Forbidden
    end
```

**Quản lý khóa:** khóa AES-256 nạp từ biến môi trường hoặc secret store (`VAULT_KEY_V{n}`), không nằm trong mã nguồn hay CSDL; `keyVersion` cho phép đổi khóa. Giải mã diễn ra theo từng lần `reveal`, máy chủ không giữ bản rõ; sau `expiresAt` API trả 403. Dữ liệu đã hiện trên màn hình người xem không thu hồi được, nên giao diện phải ẩn số khi hết đồng hồ và cảnh báo không chép lại.

**Quy trình dự phòng (break-glass):** nếu Lãnh đạo không phản hồi trong thời gian ngắn, tổ chức cần có quy trình ngoài hệ thống (gọi điện trực tiếp) và ghi nhận vào AuditLogs. Nội dung do Hội CTĐ quyết định.

---

## 8. MÔ HÌNH REAL-TIME SOCKET.IO

Socket.io gắn trực tiếp vào HTTP server của Express (một instance nên không cần adapter). **Mọi kết nối socket đều phải xác thực ở bước handshake** (middleware `io.of('/staff').use(...)` kiểm tra JWT); payload chứa thông tin cá nhân chỉ gửi vào kênh yêu cầu JWT nhân viên.

| Namespace | Sự kiện | Nguồn phát | Đối tượng nhận | Xác thực | Ghi chú nội dung |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/staff` | `donor:checkin_submitted` | Hệ thống (sau khi check-in) | Bàn tiếp nhận y tế | JWT `RED_CROSS_STAFF` | Có họ tên, STT |
| `/staff` | `medical:step_updated` | Bác sĩ khám | Bàn tiếp nhận y tế | JWT `RED_CROSS_STAFF` | Có chi tiết |
| `/donor` | `medical:step_updated` | Bác sĩ khám | Điện thoại người hiến | Token theo `checkInId` (cấp lúc check-in) | Chỉ bước hiện tại, **không** lý do y tế |
| `/display` | `queue:updated` | Hệ thống | TV Bàn khám | Mã thiết bị / mã sự kiện | **Chỉ STT và bước**, không họ tên, không lý do |
| `/emergency` | `emergency:red_alert` | Bệnh viện | Trung tâm Hội CTĐ | JWT staff Hội CTĐ | Cần xác nhận đã nhận |
| `/inventory`| `inventory:stock_changed` | Bàn lấy máu / Xe 115 | Admin & Bệnh viện | JWT | Chỉ số lượng |
| `/hospital` | `hospital:bag_received` | Y tá Bệnh viện | Hội CTĐ (Donor nhận qua SMS/email) | JWT | Cập nhật tồn kho và kích hoạt thông báo cảm ơn |

Ngoài ra `event:progress_updated` (kênh `/staff`) phát tiến độ sự kiện khi một túi máu mới được lấy.

**Báo động đỏ không được chỉ dựa vào Socket:** trình duyệt chặn tự phát âm thanh cho đến khi người dùng bấm vào trang, nên màn hình trực phải có nút "Bật âm thanh báo động" ngay đầu ca. Mỗi `EmergencyRequests` cần được nhân viên Hội CTĐ bấm xác nhận (`thoiGianXacNhan`); nếu quá thời gian cấu hình (mặc định 2 phút) mà chưa xác nhận thì hệ thống gửi thêm SMS/email cho người trực.

---

## 9. QUY ƯỚC ĐẶT TÊN (NAMING CONVENTIONS)

| Thành phần | Quy ước | Ví dụ trong SmartBlood |
| :--- | :--- | :--- |
| **Bảng CSDL (MSSQL)** | `PascalCase`, số nhiều | `Users`, `Donors`, `BloodBags`, `AuditLogs` |
| **Cột CSDL** | `camelCase` (thống nhất với DDL mục 5) | `hoTen`, `ngaySinh`, `trangThai`, `hospitalId` |
| **Stored Procedure / View** | Tiền tố `sp_` / `vw_` + `PascalCase` | `sp_DispatchBloodBagsFEFO`, `vw_BloodInventorySummary` |
| **Index / Foreign Key** | `idx_{Bang}_{Cot}`, `uniq_{Bang}_{Cot}`, `fk_{BangCon}_{BangCha}` | `idx_BloodBags_trangThai_ngayHetHan`, `fk_BloodBags_Hospitals` |
| **Khóa Bộ nhớ tạm (`memory-store`)** | `{nhom}:{thuc_the}:{dinh_danh}` (chữ thường, ngăn cách `:`) | `otp:vault:{requestId}`, `otp:reset:{email}`, `lock:user:{id}`, `lookup:{cccd}` |
| **Sự kiện Socket.io** | `{domain}:{hanh_dong_qua_khu}` | `donor:checkin_submitted`, `medical:step_updated`, `emergency:red_alert` |
| **Biến môi trường (`.env`)** | `UPPER_SNAKE_CASE` | `DB_SERVER`, `JWT_SECRET`, `VAULT_KEY_V1`, `SMTP_HOST` |
| **Tệp & Thư mục Backend** | `kebab-case.ts` | `vault-crypto.ts`, `memory-store.ts`, `public-checkin/` |
| **Tệp Component React** | `PascalCase.tsx` (component), `kebab-case.ts` (hook/service) | `BloodBagTable.tsx`, `use-socket.ts`, `api-client.ts` |

### Thời hạn TTL chuẩn trong `memory-store.ts`:
| Loại dữ liệu tạm | TTL mặc định | Giới hạn thử sai |
| :--- | :--- | :--- |
| OTP mở Két máu hiếm | `300 giây` (5 phút) | Tối đa `3 lần` |
| OTP quên mật khẩu / xác thực email | `300 giây` (5 phút), cooldown gửi lại `60 giây` | Tối đa `5 lần` |
| Khóa tạm đăng nhập sai (`lock:user:{id}`) | `180 giây` → tăng dần `15 phút` → `1 giờ` | Ngưỡng `5 lần` liên tiếp |
| Tra cứu CCCD sai ngày sinh (`lookup:{cccd}`) | `3600 giây` (1 giờ) | Tối đa `5 lần` |

---

## 10. ĐỘ TIN CẬY, GIÁM SÁT & QUAN SÁT HỆ THỐNG (RELIABILITY & OBSERVABILITY)

### 10.1 Độ tin cậy & Vòng đời tiến trình
* **Health Checks (Liveness & Readiness):**
  * `GET /api/health` (Liveness): trả `200` khi tiến trình Express đang sống (dùng cho Docker `healthcheck`).
  * `GET /api/health/ready` (Readiness): kiểm tra nhanh kết nối của cả 2 pool MSSQL (`main` và `priority`) bằng `SELECT 1`; nếu một pool lỗi trả `503 Service Unavailable`.
* **Idempotency (Chống xử lý trùng lặp):**
  * Form check-in bắt buộc gửi `clientRequestId` (UUID duy nhất) để SP chống tạo trùng khi mạng 4G gửi lại.
  * Các thao tác tạo lệnh xuất kho / phát báo động đỏ khuyến nghị kiểm tra trùng trạng thái hoặc `Idempotency-Key` trong phạm vi phiên làm việc.
* **Graceful Shutdown:** Khi nhận tín hiệu `SIGTERM` / `SIGINT` (Docker restart/deploy), `server.ts` ngừng nhận request mới, đóng các kết nối Socket.io, rồi đóng lần lượt 2 pool `main` và `priority` trước khi thoát.
* **Graceful Degradation:** Báo động đỏ không phụ thuộc 100% vào Socket.io; nếu quá 2 phút chưa có `thoiGianXacNhan`, hệ thống tự chuyển sang kênh dự phòng SMS/email.

### 10.2 Ghi Log có cấu trúc (`winston`) & Bảo mật Log
Mọi log server xuất dạng **JSON có cấu trúc** (không dùng `console.log` trong production):
```json
{
  "level": "info",
  "timestamp": "2026-11-11T14:00:00.000Z",
  "service": "smartblood-api",
  "requestId": "req-uuid",
  "userId": "user-uuid",
  "event": "blood_bag.dispatched",
  "durationMs": 42
}
```
* **Danh sách TUYỆT ĐỐI KHÔNG ĐƯỢC LOG (theo NĐ 13/2023 & Zero-Trust):** số `cccd`, `matKhau` / `matKhauHash`, `JWT` / `Authorization` header, mã `OTP`, `soDienThoai` và `diaChi` đã giải mã từ `RareBloodVault`, chi tiết bệnh lý/lý do tạm hoãn nhạy cảm.

### 10.3 Chỉ số theo dõi (Metrics) & Ngưỡng cảnh báo
* **Theo phương pháp RED (cho API & Socket):**
  * *Rate*: Số request/giây vào `/public/checkin` (ngưỡng thiết kế đỉnh ≤ 50 req/s).
  * *Errors*: Tỷ lệ phản hồi `5xx` và lỗi Stored Procedure (`50001+`).
  * *Duration*: Độ trễ `p95` của API thường (mục tiêu `< 300ms`) và thời gian phát `emergency:red_alert` (mục tiêu `< 1s`).
* **Theo phương pháp USE (cho Tài nguyên hạ tầng):**
  * *Pool MSSQL*: Số kết nối đang bận / hàng chờ trên pool `main` (max 40) và pool `priority` (max 10).
  * *Memory Store*: Kích thước `Map` trong `memory-store.ts` và bộ nhớ tiến trình Node.js (đảm bảo dọn key hết hạn định kỳ).

---

## 11. GHI NHẬN QUYẾT ĐỊNH KIẾN TRÚC (ADR)

Mọi thay đổi kiến trúc lớn (ví dụ: chuyển Tier 3 sang Redis để chạy nhiều instance, đổi nhà cung cấp SMS, bổ sung thư viện ngoài danh mục khóa) phải được ghi lại thành tệp `docs/architecture/adr/ADR-NNN-ten-quyet-dinh.md` theo mẫu:
1. **Ngày & Trạng thái:** `Proposed | Accepted | Deprecated | Superseded`
2. **Bối cảnh (Context):** Vấn đề cần giải quyết và ràng buộc thực tế (quy mô, chi phí, pháp lý).
3. **Các phương án đã cân nhắc (Options Considered):** So sánh Ưu/Nhược điểm từng phương án.
4. **Quyết định (Decision):** Phương án được chọn và lý do.
5. **Hệ quả & Rủi ro (Consequences & Risks):** Đánh đổi chấp nhận (`shortcut`) và hướng mở rộng về sau.
