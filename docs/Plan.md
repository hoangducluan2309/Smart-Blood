# KẾ HOẠCH TỔNG THỂ & PHÂN RÃ TASK CON CHỨC NĂNG (PLAN.MD)
## DỰ ÁN: SMARTBLOOD - HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA

---

## 1. LỘ TRÌNH TRIỂN KHAI TỔNG THỂ (5 PHASES)

Kế hoạch phát triển dự án được chia làm **5 giai đoạn tuần tự**, mỗi giai đoạn đều phân rã thành các **task con chi tiết (kèm checklist `[ ]`)** tương ứng với từng chức năng của hệ thống:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Nền tảng Hạ tầng & Database DDL Stored Procedure (Tuần 1)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Quản lý Sự kiện, Mã QR & Check-in Di động không cần Login (Tuần 2) │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Điều phối Tiến trình Y tế Bàn tiếp nhận Hội Chữ Thập Đỏ (Tuần 3)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Quản lý Kho FEFO, Két Máu Hiếm & Bệnh viện Quét QR Nhận Máu (Tuần 4)│
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Cấp cứu Hỏa tốc 115, Cổng Donor & Tối ưu Chịu tải cao (Tuần 5)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PHÂN RÃ CHI TIẾT TỪNG PHASE THÀNH TASK CON (CHECKLIST)

### GIAI ĐOẠN 1: NỀN TẢNG HẠ TẦNG & CSDL SQL SERVER (PHASE 1)
> **Mục tiêu:** Khởi tạo cấu trúc dự án Monorepo (100% TypeScript), thiết lập toàn bộ 15 bảng CSDL SQL Server 2019 và các Stored Procedure có Transaction khóa `UPDLOCK, ROWLOCK, READPAST`.

#### 1.1 Khởi tạo Hạ tầng & Cấu hình Monorepo
* [x] **Task 1.1.1:** Khởi tạo cấu trúc thư mục Monorepo bằng `pnpm workspace` (`backend/`, `frontend/`, `database/`, `tests/`, `docs/`).
* [x] **Task 1.1.2:** Khởi tạo dự án Node.js + Express (TypeScript strict mode, ES Modules), dạng Modular Monolith: 6 thư mục module (mỗi module `routes.ts` / `service.ts` / `repository.ts` / `schemas.ts`), middleware dùng chung (`verifyJwt`, `requireRole`, `express-rate-limit`, `zod`, error-handler `AppError`), thư mục `shared/`, `types/`, hai connection pool `mssql` (`main` và `priority`), endpoint `/api/health`.
* [ ] **Task 1.1.3:** Khởi tạo dự án Frontend React 19 + TypeScript (strict mode) + Vite + Tailwind CSS + Lucide Icons.
* [x] **Task 1.1.4:** Thiết lập module bộ nhớ tạm `shared/memory-store.ts` (Map có TTL cho OTP và bộ đếm khóa) và Socket.io gắn vào HTTP server của Express (xác thực JWT ngay ở handshake; các namespace `/staff`, `/donor`, `/display`, `/emergency`, `/inventory`, `/hospital`). Không dùng Redis.

#### 1.2 Thiết kế Cơ sở dữ liệu SQL Server 2019 (DDL)
* [x] **Task 1.2.1:** Soạn thảo kịch bản `01-init-schema.sql` tạo 15 bảng quan hệ (đúng theo `Architechture.md` mục 5): `Users`, `Donors`, `DonationHistory`, `RareBloodVault`, `VaultUnlockRequests`, `DonationEvents`, `DonorCheckIns`, `ClinicalExams`, `ScreeningTests`, `BloodBags`, `Hospitals`, `HospitalDispatches`, `HospitalDispatchBags`, `EmergencyRequests`, `AuditLogs`; kèm view `vw_BloodInventorySummary`.
* [x] **Task 1.2.2:** Thiết lập các ràng buộc toàn vẹn khóa chính (PK), khóa ngoại (FK), chỉ mục hiệu năng (`INDEX`) trên các cột thường xuyên tìm kiếm (`cccd`, `soDienThoai`, `maVachTuiMau`, `destinationHospitalId`).
* [x] **Task 1.2.3:** Thiết lập tài khoản database chuyên dụng `hienmau_app` với nguyên tắc phân quyền tối thiểu (Least Privilege): chỉ `EXECUTE` trên Stored Procedure; trên `AuditLogs` chỉ `INSERT`, không `UPDATE`/`DELETE`.

#### 1.3 Lập trình các Stored Procedure cốt lõi (Transaction & Lock)
* [x] **Task 1.3.1:** Viết Stored Procedure `sp_LookupDonorByCCCD`: nhận CCCD + ngày sinh; chỉ trả dữ liệu auto-fill khi ngày sinh khớp; tính số ngày từ `MAX(DonationHistory.ngayHien)` so với mốc 84 ngày (Thông tư 26/BYT); người hiến máu hiếm không trả SĐT/địa chỉ.
* [x] **Task 1.3.2:** Viết Stored Procedure `sp_SubmitDonorCheckIn`: kiểm tra lại 84 ngày và sự kiện đang mở đúng khung giờ; không ghi đè họ tên/ngày sinh/nhóm máu hồ sơ đã có; cấp STT bằng bộ đếm một dòng; idempotent theo `clientRequestId`.
* [x] **Task 1.3.3:** Viết Stored Procedure `sp_ProcessBloodBagStockIn`: tạo túi máu ở trạng thái `QUARANTINE`, tính hạn sử dụng 35 ngày (giả định túi hồng cầu; thành phần khác do bộ phận y tế xác nhận), tạo `DonationHistory`, chuyển check-in sang `HOAN_THANH` trong một Transaction. Viết thêm `sp_RecordBloodBagLabResult`: đạt → `IN_STOCK`, không đạt → `DISCARDED`.
* [x] **Task 1.3.4:** Viết Stored Procedure `sp_DispatchBloodBagsFEFO` theo mẫu trong `Architechture.md` mục 6: chọn túi `IN_STOCK` có hạn gần nhất (`ORDER BY ngayHetHan ASC`) với `WITH (UPDLOCK, ROWLOCK, READPAST)`, gán túi vào `HospitalDispatchBags`, ghi `destinationHospitalId` và AuditLogs.
* [x] **Task 1.3.5:** Viết Stored Procedure `sp_HospitalReceiveBloodBag`: bệnh viện lấy từ `Users.hospitalId` của người đăng nhập, kiểm tra đúng bệnh viện đích, cập nhật `HOSPITAL_RECEIVED`, ghi nhận lịch sử nhận theo từng túi.

---

### GIAI ĐOẠN 2: SỰ KIỆN, MÃ QR & CHECK-IN CÔNG KHAI KHÔNG CẦN LOGIN (PHASE 2)
> **Mục tiêu:** Người dân dùng điện thoại quét mã QR tại sự kiện, tự động điền thông tin cá nhân qua 12 số CCCD, kiểm tra chu kỳ an toàn 84 ngày và cấp số thứ tự STT.

#### 2.1 Phân hệ Quản lý Sự kiện & Sinh mã QR (Module 1)
* [x] **Task 2.1.1:** Viết schema `zod` và route/service cho module `event-qr`: API tạo mới sự kiện hiến máu (`tenSuKien`, `diaDiem`, `ngayToChuc`, `chiTieuSoLuong`).
* [x] **Task 2.1.2:** Lập trình dịch vụ sinh mã QR động (chuẩn hóa URL: `https://smartblood.vn/checkin?eventId=...`).
* [x] **Task 2.1.3:** Tích hợp sinh ảnh vector SVG độ phân giải cao và file ảnh PNG phục vụ in ấn Standee khổ lớn.
* [ ] **Task 2.1.4:** Xây dựng màn hình Quản lý sự kiện phía Admin: Danh sách sự kiện chuẩn DataTable (Tất cả/50/20/10, Sắp xếp, Lọc, Tìm kiếm Debounce).

#### 2.2 Phân hệ Check-in Công khai không cần Đăng nhập (Module 2)
* [x] **Task 2.2.1:** Viết API `POST /api/v1/public/checkin/lookup-cccd` (body: `cccd`, `ngaySinh`), gọi Stored Procedure kiểm tra:
  * Nếu là người hiến mới: Trả về trạng thái nhập mới.
  * Nếu đã từng hiến và đúng ngày sinh: Trả về dữ liệu cũ (`hoTen`, `ngaySinh`, `gioiTinh`, `soDienThoai`, `diaChi`, `nhomMau`; người hiến máu hiếm không có SĐT/địa chỉ).
  * Nếu không có hồ sơ hoặc sai ngày sinh: trả kết quả như người hiến mới (không lộ việc CCCD đã có hồ sơ); giới hạn 5 lần sai/giờ/CCCD.
  * Nếu chưa đủ 84 ngày: Trả về mã cảnh báo từ chối kèm ngày sớm nhất được hiến tiếp.
* [x] **Task 2.2.2:** Viết API `POST /api/v1/public/checkin/submit` (kèm `clientRequestId`, đồng ý xử lý dữ liệu, khai báo sức khỏe): gọi `sp_SubmitDonorCheckIn`, trả STT và token theo dõi, phát WebSocket `donor:checkin_submitted` vào kênh `/staff`.
* [ ] **Task 2.2.3:** Thiết kế giao diện Mobile Check-in (`MobileCheckInPage.tsx`):
  * Tối ưu giao diện cho màn hình điện thoại (Touch-friendly).
  * Ô nhập CCCD + ngày sinh, tự động định dạng và gửi request tra cứu tự điền.
  * Ô đồng ý xử lý dữ liệu cá nhân và phiếu khai báo sức khỏe ngắn (do bộ phận y tế biên soạn).
  * Bộ chọn thể tích máu dự kiến (250ml / 350ml / 450ml; bác sĩ xác nhận ở bước khám).
  * Màn hình kết quả hiển thị Số thứ tự (STT) cỡ lớn nổi bật: *"SỐ THỨ TỰ CỦA BẠN LÀ: 15"*.
* [ ] **Task 2.2.4:** Lưu nháp form vào `sessionStorage` (TTL 24 giờ, **không chứa CCCD**) để chống mất dữ liệu khi mất mạng; gửi lại `submit` dùng cùng `clientRequestId` nên không tạo trùng.

---

### GIAI ĐOẠN 3: ĐIỀU PHỐI TIẾN TRÌNH Y TẾ BÀN TIẾP NHẬN HỘI CHỮ THẬP ĐỎ (PHASE 3)
> **Mục tiêu:** Bàn tiếp nhận y tế thời gian thực điều phối người hiến qua 4 bước: Tiếp nhận $\rightarrow$ Khám lâm sàng $\rightarrow$ Xét nghiệm $\rightarrow$ Lấy máu & in tem mã vạch.

#### 3.1 Bàn Tiếp Nhận Thời Gian Thực (Module 3 - Medical Workflow)
* [ ] **Task 3.1.1:** Xây dựng màn hình Bàn tiếp nhận `MedicalWorkflowBoard.tsx` dạng 4 cột Kanban:
  * Cột 1: *Chờ tiếp nhận & Khám lâm sàng*
  * Cột 2: *Chờ xét nghiệm nhanh mao mạch*
  * Cột 3: *Chờ lấy máu*
  * Cột 4: *Đã hoàn thành*
  * Người bị tạm hoãn hiển thị ở Cột 4 với nhãn "Tạm hoãn". Lý do y tế chỉ nhân viên có quyền mới xem.
* [ ] **Task 3.1.2:** Tích hợp Socket.io (kênh `/staff`, cần JWT): Khi có người hiến mới quét QR $\rightarrow$ Tự động chèn thẻ vào Cột 1 không cần tải lại trang. TV công cộng dùng kênh `/display`, chỉ hiện STT và bước.

#### 3.2 Khám Sàng Lọc Lâm Sàng & Đo Sinh Hiệu (Bước 1)
* [x] **Task 3.2.1:** Viết API `POST /api/v1/medical/exam/clinical`: Nhập huyết áp tâm thu/tâm trương, nhịp tim, cân nặng; bác sĩ xác nhận thể tích được phép lấy.
* [x] **Task 3.2.2:** Logic kiểm tra điều kiện sinh hiệu theo **bảng ngưỡng cấu hình** (giá trị tạm: cân nặng $\ge 45\text{ kg}$, huyết áp tâm thu $100 - 140\text{ mmHg}$, tâm trương $60 - 90\text{ mmHg}$, nhịp tim $60 - 90$; ngưỡng theo giới và theo thể tích do bộ phận y tế xác nhận theo Thông tư). Nếu không đạt $\rightarrow$ `TAM_HOAN`, lưu lý do y tế.
* [ ] **Task 3.2.3:** Giao diện Modal nhập nhanh sinh hiệu cho bác sĩ khám.

#### 3.3 Xét Nghiệm Nhanh Mao Mạch (Bước 2)
* [x] **Task 3.3.1:** Viết API `POST /api/v1/medical/exam/rapid-test`: Ghi nhận Hemoglobin (ngưỡng trong bảng cấu hình, giá trị tạm $\ge 12.0\text{ g/dL}$) và test nhanh (HBsAg, HCV, HIV). Không đạt $\rightarrow$ `TAM_HOAN`; kết quả dương tính chỉ báo riêng cho nhân viên có quyền để tư vấn, không hiện trên TV hay điện thoại người hiến.
* [x] **Task 3.3.2:** Ghi nhóm máu sơ bộ vào hồ sơ `Donors`; nhóm máu chính thức được xác nhận ở bước xét nghiệm sàng lọc chính thức (Task 4.1.4).

#### 3.4 Lấy Máu, Sinh Mã Túi Máu & Nhập Kho Cách Ly (Bước 3 & 4)
* [x] **Task 3.4.1:** Sinh mã túi máu nội bộ `BAG-<năm>-<số seri 6 chữ số>` từ SQL `SEQUENCE` (duy nhất, không trùng qua nhiều ngày/sự kiện). Đây **không phải** mã ISBT-128 chính thức; ánh xạ sang ISBT-128 (cần mã cơ sở được cấp) là việc của giai đoạn sau nếu bệnh viện yêu cầu.
* [x] **Task 3.4.2:** Sinh mã QR định danh riêng dán trên nhãn túi máu phục vụ Bệnh viện quét nhận (QR chỉ chứa mã túi, không chứa dữ liệu cá nhân).
* [x] **Task 3.4.3:** Viết API `POST /api/v1/medical/blood-bag/collect`: Lưu túi máu vào `BloodBags` ở trạng thái `QUARANTINE` (hạn dùng $+35$ ngày), tạo `DonationHistory`, qua Stored Procedure. Túi chỉ vào tồn kho khả dụng sau khi có kết quả sàng lọc chính thức (Task 4.1.4).

---

### GIAI ĐOẠN 4: KHO MÁU FEFO, KÉT MÁU HIẾM & BỆNH VIỆN QUÉT QR NHẬN MÁU (PHASE 4)
> **Mục tiêu:** Quản trị kho lạnh bảo quản máu theo hạn dùng FEFO, bảo vệ thông tin người hiến máu hiếm bằng AES-256-GCM, và Bệnh viện quét QR trên túi máu xác nhận nhập kho viện.

#### 4.1 Quản Trị Kho Máu FEFO & Cảnh Báo An Toàn (Module 4)
* [x] **Task 4.1.1:** Viết API `GET /api/v1/inventory/fefo-list`: Truy vấn túi `IN_STOCK` sắp xếp theo hạn sử dụng tăng dần (`ORDER BY ngayHetHan ASC`).
* [x] **Task 4.1.2:** Thiết lập phân loại cảnh báo 3 màu trực quan, kèm biểu tượng/nhãn chữ: Đỏ ($< 7$ ngày), Vàng ($7 - 15$ ngày), Xanh ($> 15$ ngày).
* [ ] **Task 4.1.3:** Xây dựng màn hình `BloodInventoryPage.tsx` chuẩn DataTable (All/50/20/10, Sắp xếp, Bộ lọc 8 nhóm máu, Tìm kiếm Debounce).
* [ ] **Task 4.1.4:** Viết API `POST /api/v1/inventory/blood-bag/:id/lab-result` và màn hình `QuarantineBagsPage.tsx`: nhập kết quả xét nghiệm sàng lọc chính thức và nhóm máu xác nhận; đạt $\rightarrow$ `IN_STOCK`, không đạt $\rightarrow$ `DISCARDED`.

#### 4.2 Két Bảo Mật Nhóm Máu Hiếm (Zero-Trust Rare Blood Vault)
* [x] **Task 4.2.1:** Lập trình tiện ích mã hóa đối xứng **AES-256-GCM**: mã hóa SĐT và Địa chỉ của người có nhóm máu hiếm ($Rh-, Bombay...$) trước khi lưu vào `RareBloodVault`, **mỗi trường một IV ngẫu nhiên và một authTag riêng**, có `keyVersion`; đồng thời để `NULL` SĐT/địa chỉ ở bảng `Donors`.
* [x] **Task 4.2.2:** Viết API quy trình phê duyệt 2 lớp (hai tài khoản khác nhau):
  * Bước 1: Admin gửi yêu cầu kèm mã bệnh án khẩn cấp (`VaultUnlockRequests` = `PENDING`).
  * Bước 2: Hệ thống thông báo và gửi OTP cho người phê duyệt (`laNguoiPheDuyet = 1`); người này tự nhập OTP trong phiên của mình (TTL 5 phút, tối đa 3 lần).
  * Bước 3: Duyệt thành công $\rightarrow$ `expiresAt` = +15 phút; mỗi lần xem, máy chủ giải mã theo yêu cầu; hết hạn trả `403`.
* [x] **Task 4.2.3:** Ghi nhật ký bất biến vào `AuditLogs` cho mọi bước (yêu cầu, duyệt, từ chối, xem).

#### 4.3 Phân Phối Túi Máu & Bệnh Viện Quét Mã QR Nhận Máu (Module 5)
* [x] **Task 4.3.1:** Viết API `POST /api/v1/hospital/dispatch`: Lập lệnh xuất kho theo thuật toán FEFO (pool `priority`), nhập tay biển số xe và hotline tài xế, gán bệnh viện tiếp nhận.
* [ ] **Task 4.3.2:** Xây dựng màn hình Mobile cho Bệnh viện `HospitalScanReceivePage.tsx` (yêu cầu đăng nhập):
  * Mở camera quét mã QR in trên nhãn túi máu.
  * Tự động điều hướng đến URL xác thực: `https://smartblood.vn/hospital/verify-bag?bagCode=...`.
* [x] **Task 4.3.3:** Viết API `POST /api/v1/hospital/verify-and-receive` (bệnh viện lấy từ tài khoản đăng nhập, không nhận từ client):
  * Kiểm tra đúng bệnh viện đích.
  * Cập nhật trạng thái túi máu sang `HOSPITAL_RECEIVED`.
  * **Kích hoạt đóng vòng lặp cung ứng:** Tự động gửi SMS/Email cảm ơn đến người hiến: *"Túi máu của bạn đã được BV Đa khoa Đồng Nai tiếp nhận an toàn!"*.

---

### GIAI ĐOẠN 5: CẤP CỨU HỎA TỐC 115, CỔNG DONOR & TỐI ƯU HẠ TẦNG (PHASE 5)
> **Mục tiêu:** Bệnh viện phát lệnh cấp cứu báo động đỏ, Người hiến đăng ký tài khoản tra cứu lịch sử và đóng gói hạ tầng (Nginx, CDN tùy chọn, Docker).

#### 5.1 Điều Phối Cấp Cứu Khẩn Cấp 115 & Báo Động Đỏ Socket.io
* [x] **Task 5.1.1:** Viết API cho Bệnh viện `POST /api/v1/hospital/emergency-alert`: Phát lệnh cấp cứu hỏa tốc (`hospitalId`, `nhomMau`, `soLuong`, mức độ `NGUY_CAP`).
* [ ] **Task 5.1.2:** Tích hợp Socket.io: Phát `emergency:red_alert` kích hoạt còi hú và popup nhấp nháy đỏ trên màn hình trực Hội CTĐ. Có nút "Bật âm thanh báo động" đầu ca (trình duyệt chặn âm thanh tự phát), nút xác nhận "Đã nhận lệnh" (`thoiGianXacNhan`), và gửi SMS/email dự phòng cho người trực nếu quá 2 phút chưa xác nhận.
* [x] **Task 5.1.3:** Tự động gợi ý túi máu `IN_STOCK` tương thích (theo ma trận tương thích) xuất kho, hoặc kích hoạt quy trình mở Két máu hiếm để gọi hotline cho người hiến khẩn cấp.
* [ ] **Task 5.1.4:** Bàn điều phối xe 115: hiển thị biển số, hotline tài xế và trạng thái hành trình do nhân viên cập nhật. Không có GPS trừ khi 115 cung cấp API.

#### 5.2 Cổng Thông Tin Người Hiến & Lịch Sử Cá Nhân (Module 6)
* [x] **Task 5.2.1:** Viết API Đăng ký / Đăng nhập liên kết số CCCD: yêu cầu khớp ngày sinh và xác minh email bằng OTP trước khi gom các lần hiến cũ vào tài khoản mới.
* [x] **Task 5.2.2:** Chống Brute-force: sai 5 lần $\rightarrow$ khóa tạm 3 phút (countdown, đếm trong bộ nhớ ứng dụng); tiếp tục sai $\rightarrow$ khóa tăng dần 15 phút / 1 giờ, cảnh báo email, yêu cầu đặt lại mật khẩu bằng OTP. **Không tự động khóa vĩnh viễn**; chỉ Admin đặt `LOCKED` thủ công.
* [x] **Task 5.2.3:** API Tra cứu lịch sử: Trả về danh sách các lần hiến máu, lượng máu, nhóm máu và bệnh viện đã nhận túi máu.
* [x] **Task 5.2.4:** Dịch vụ cấp Giấy chứng nhận điện tử: Render file PDF có hoa văn y tế, dấu đỏ điện tử của Hội Chữ Thập Đỏ TP. Biên Hòa và mã QR xác thực.
* [x] **Task 5.2.5:** Quên mật khẩu qua Google Gmail SMTP thực tế: Mã OTP 6 số ngẫu nhiên, TTL 5 phút, cooldown 60 giây.

#### 5.3 Tối Ưu Hạ Tầng Chịu Tải Cao, Cân Bằng Tải & Đóng Gói
* [ ] **Task 5.3.1:** Cấu hình Nginx Reverse Proxy: SSL Termination, nén Gzip/Brotli, phục vụ file tĩnh frontend, WebSocket Upgrade headers, và `real_ip` (`CF-Connecting-IP`) nếu dùng Cloudflare.
* [ ] **Task 5.3.2:** (Tùy chọn) Cấu hình Cloudflare CDN Caching cho static assets và ảnh SVG/PNG mã QR sự kiện, sau khi đánh giá yêu cầu về dữ liệu cá nhân (xem `Overview.md` mục 6).
* [x] **Task 5.3.3:** Rà soát bộ nhớ tạm (OTP TTL 5 phút, bộ đếm khóa) và đảm bảo chống xuất trùng túi máu bằng khóa trong SQL Server. Không dùng Redis hay Redlock; không cache tồn kho/sự kiện trừ khi đo được chậm.
* [x] **Task 5.3.4:** Đóng gói toàn bộ hệ thống bằng Docker Compose (`docker-compose.yml`: Database MSSQL + Backend Express + Frontend Nginx), có `restart: always` và healthcheck.
* [x] **Task 5.3.5:** Chạy bộ kiểm thử tự động Unit Test & End-to-End Test (E2E) đối chiếu 100% tiêu chí AC trước khi nghiệm thu bàn giao.
