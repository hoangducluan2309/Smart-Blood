# DANH MỤC MODULE CHỨC NĂNG & CHECKLIST TRIỂN KHAI (MODUL.MD)
## DỰ ÁN: SMARTBLOOD - HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA

> 🎯 **Mục đích tài liệu:** Phân tách rạch ròi 100% các đầu mục công việc giữa **BACKEND** và **FRONTEND** cho từng Module. Bạn chỉ cần copy từng mục checklist và yêu cầu AI lập trình theo đúng phạm vi, không bị chồng chéo hay sót tính năng.

---

## BẢNG TỔNG QUAN TIẾN ĐỘ 6 MODULE CHỨC NĂNG

```
┌────────────┬───────────────────────────────────────┬──────────────┬──────────────┐
│ Mã Module  │ Tên Module Chức Năng                  │ Backend Tasks│Frontend Tasks│
├────────────┼───────────────────────────────────────┼──────────────┼──────────────┤
│ MODULE 01  │ Quản Lý Sự Kiện & Sinh Mã QR Động     │    [x] 5/5   │    [ ] 0/5   │
│ MODULE 02  │ Check-in Công Khai & CCCD Auto-fill   │    [x] 5/5   │    [ ] 0/5   │
│ MODULE 03  │ Bàn Tiếp Nhận Y Tế & Tiến Trình 4 Bước│    [x] 6/6   │    [ ] 0/5   │
│ MODULE 04  │ Kho Máu FEFO & Két Nhóm Máu Hiếm      │    [x] 7/7   │    [ ] 0/6   │
│ MODULE 05  │ Phân Phối Bệnh Viện & Cấp Cứu 115     │    [x] 7/7   │    [ ] 0/5   │
│ MODULE 06  │ Cổng Donor, Lịch Sử & Chứng Nhận Điện Tử│  [x] 6/6   │    [ ] 0/5   │
├────────────┴───────────────────────────────────────┼──────────────┼──────────────┤
│ TỔNG CỘNG TOÀN BỘ CHỨC NĂNG (67 TASKS)             │    [x] 36/36 │    [ ] 0/31  │
└────────────────────────────────────────────────────┴──────────────┴──────────────┘
```

---

## 🎪 MODULE 1: QUẢN LÝ SỰ KIỆN HIẾN MÁU & MÃ QR ĐỘNG (`EventQRModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M1-01:** Tạo bảng CSDL `DonationEvents` (id, tenSuKien, diaDiem, ngayToChuc, gioBatDau, gioKetThuc, chiTieuSoLuong, soLuongThucTe, qrCodeUrl, trangThai).
- [x] **BE-M1-02:** Xây dựng schema `zod` `createEventSchema` (kiểm tra ngày tổ chức $\ge$ hiện tại, chỉ tiêu $> 0$).
- [x] **BE-M1-03:** Viết Service sinh mã QR động chứa URL check-in: `https://smartblood.vn/checkin?eventId={id}` xuất ra cả 2 định dạng: SVG (in ấn khổ lớn) và PNG (hiển thị web).
- [x] **BE-M1-04:** Viết Controller `EventController` gồm các API:
  * `POST /api/v1/events` – Tạo sự kiện mới (Quyền: `ADMIN`, `RED_CROSS_STAFF`).
  * `GET /api/v1/events` – Lấy danh sách sự kiện kèm phân trang, lọc theo trạng thái.
  * `GET /api/v1/events/:id/qr-download` – Tải file ảnh QR hoặc file PDF Poster Standee.
- [x] **BE-M1-05:** Tích hợp Socket.io (kênh `/staff`) phát sự kiện `event:progress_updated` khi có túi máu mới được hoàn thành tại sự kiện.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M1-01:** Tạo trang Quản lý sự kiện `AdminEventsPage.tsx` chuẩn DataTable (Phân trang: Tất cả/50/20/10, Sắp xếp ngày, Lọc trạng thái, Tìm kiếm Debounce).
- [ ] **FE-M1-02:** Xây dựng Modal tạo mới / chỉnh sửa sự kiện `EventFormModal.tsx` có validate form đầy đủ.
- [ ] **FE-M1-03:** Tạo Component hiển thị mã QR `EventQRCodeCard.tsx` có nút bấm: *"Tải ảnh QR PNG"* và *"Xuất bản in Standee PDF"*.
- [ ] **FE-M1-04:** Thiết kế thanh tiến độ % hoàn thành chỉ tiêu sự kiện trực quan: $\frac{\text{Số túi thực tế}}{\text{Chỉ tiêu}} \times 100\%$.
- [ ] **FE-M1-05:** Tích hợp Socket.io Client tự động cập nhật thanh tiến độ theo thời gian thực mà không cần F5 trang.

---

## 📱 MODULE 2: TIẾP NHẬN CÔNG KHAI KHÔNG CẦN LOGIN & CCCD AUTO-FILL (`PublicCheckInModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M2-01:** Tạo bảng CSDL `Donors`, `DonationHistory` và `DonorCheckIns` (xem `Architechture.md` mục 5; `DonorCheckIns` có `clientRequestId`, UNIQUE (`eventId`, `donorId`), cờ đồng ý xử lý dữ liệu, khai báo sức khỏe, `buocHienTai`).
- [x] **BE-M2-02:** Viết Stored Procedure `sp_LookupDonorByCCCD`:
  * Nhận `@CCCD` (12 số) và `@NgaySinh`.
  * Tính số ngày từ `MAX(DonationHistory.ngayHien)`.
  * Nếu $< 84$ ngày: Trả `eligible = 0` kèm ngày sớm nhất được hiến tiếp.
  * Nếu $\ge 84$ ngày và **đúng ngày sinh**: Trả `eligible = 1` cùng dữ liệu cũ (`hoTen`, `ngaySinh`, `gioiTinh`, `soDienThoai`, `diaChi`, `nhomMau`). Người hiến máu hiếm không có SĐT/địa chỉ.
  * Không có hồ sơ hoặc sai ngày sinh: trả kết quả như người hiến mới (không lộ việc CCCD đã có hồ sơ).
- [x] **BE-M2-03:** Viết API Public `POST /api/v1/public/checkin/lookup-cccd` (body: `cccd`, `ngaySinh`; không JWT; tối đa 5 lần sai ngày sinh/giờ/CCCD và 60 req/phút/IP).
- [x] **BE-M2-04:** Viết Stored Procedure `sp_SubmitDonorCheckIn`: kiểm tra lại 84 ngày và sự kiện đang mở; không ghi đè họ tên/ngày sinh/nhóm máu hồ sơ cũ; cấp STT bằng bộ đếm một dòng; idempotent theo `clientRequestId`.
- [x] **BE-M2-05:** Viết API Public `POST /api/v1/public/checkin/submit` tiếp nhận đăng ký, trả STT và token theo dõi, bắn Socket.io `donor:checkin_submitted` vào kênh `/staff`.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M2-01:** Thiết kế trang Check-in di động `MobileCheckInPage.tsx`: Giao diện tối ưu chuẩn cảm ứng cho điện thoại khi quét mã QR tại sự kiện.
- [ ] **FE-M2-02:** Ô nhập CCCD + ngày sinh: Tự động format, gọi API tra cứu khi đủ 12 số và ngày sinh hợp lệ, hiển thị hiệu ứng Loading; có ô đồng ý xử lý dữ liệu cá nhân và phiếu khai báo sức khỏe.
- [ ] **FE-M2-03:** Cơ chế tự động điền (Auto-fill): Nạp dữ liệu cũ vào form; nếu người hiến lần đầu thì mở các ô nhập Họ tên, SĐT, Ngày sinh, Địa chỉ.
- [ ] **FE-M2-04:** Hộp cảnh báo đỏ Thông tư 26/BYT: Tự động khóa nút xác nhận và hiển thị ngày được hiến tiếp nếu chưa đủ khoảng cách 84 ngày.
- [ ] **FE-M2-05:** Màn hình kết quả cấp Số Thứ Tự: Thẻ thông báo nổi bật *"SỐ THỨ TỰ TIẾP NHẬN CỦA BẠN LÀ: 15"*, lưu nháp vào `sessionStorage` (không chứa CCCD) chống mất mạng; gửi lại dùng cùng `clientRequestId`.

---

## 🩺 MODULE 3: BÀN TIẾP NHẬN Y TẾ & ĐIỀU PHỐI 4 BƯỚC (`MedicalWorkflowModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M3-01:** Tạo bảng CSDL `ClinicalExams` (Khám lâm sàng) và `ScreeningTests` (Xét nghiệm nhanh).
- [x] **BE-M3-02:** Viết API `POST /api/v1/medical/exam/clinical` (Bước 1): Lưu sinh hiệu (huyết áp tâm thu/tâm trương, nhịp tim, cân nặng), so với bảng ngưỡng cấu hình (giá trị tạm: cân nặng $\ge 45\text{kg}$), bác sĩ xác nhận thể tích được phép lấy. Đạt $\rightarrow$ `CHO_XET_NGHIEM`; không đạt $\rightarrow$ `TAM_HOAN` kèm lý do.
- [x] **BE-M3-03:** Viết API `POST /api/v1/medical/exam/rapid-test` (Bước 2): Ghi nhận Hemoglobin (ngưỡng cấu hình, tạm $\ge 12.0\text{g/dL}$) và test nhanh (HBsAg, HCV, HIV). Đạt $\rightarrow$ `CHO_LAY_MAU`; **không đạt $\rightarrow$ `TAM_HOAN`**, kết quả dương tính chỉ báo riêng cho nhân viên có quyền. Ghi nhóm máu sơ bộ.
- [x] **BE-M3-04:** Lập trình sinh mã túi máu nội bộ `BAG-<năm>-<số seri 6 chữ số>` từ SQL `SEQUENCE` (không phải ISBT-128 chính thức) và mã QR dán trên nhãn túi máu (chỉ chứa mã túi).
- [x] **BE-M3-05:** Viết Stored Procedure `sp_ProcessBloodBagStockIn` (Bước 3 & 4): Tạo túi máu ở trạng thái `QUARANTINE` (hạn dùng $+35$ ngày), tạo `DonationHistory`, đổi check-in sang `HOAN_THANH` trong Transaction. Tồn kho chỉ tính túi `IN_STOCK` (view `vw_BloodInventorySummary`, không có bảng `KhoMau`).
- [x] **BE-M3-06:** Phát sự kiện WebSocket `medical:step_updated` đồng bộ trạng thái của người hiến trên toàn hệ thống.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M3-01:** Xây dựng màn hình Bàn tiếp nhận `MedicalWorkflowBoard.tsx` dạng 4 cột Kanban:
  * Cột 1: *Chờ tiếp nhận & khám lâm sàng* $\rightarrow$ Cột 2: *Chờ xét nghiệm* $\rightarrow$ Cột 3: *Chờ lấy máu* $\rightarrow$ Cột 4: *Hoàn tất / Tạm hoãn*. Lý do tạm hoãn chỉ nhân viên có quyền mới xem; TV công cộng chỉ hiện STT.
- [ ] **FE-M3-02:** Tích hợp Socket.io: Người vừa quét QR tự động xuất hiện ở Cột 1 với hiệu ứng nhấp nháy xanh mà không cần F5.
- [ ] **FE-M3-03:** Xây dựng Modal Khám lâm sàng `ClinicalExamModal.tsx`: Thao tác nhập nhanh huyết áp, cân nặng, nhịp tim có cảnh báo màu.
- [ ] **FE-M3-04:** Xây dựng Modal Xét nghiệm nhanh `RapidTestModal.tsx`: Tích chọn nhanh âm/dương tính và chọn nhóm máu xác nhận ($A, B, AB, O, Rh+, Rh-$).
- [ ] **FE-M3-05:** Xây dựng Component In Tem Nhãn Túi Máu: Xem trước và in tem mã vạch (mã `BAG-...`) kèm mã QR để dán lên túi máu.

---

## 🧊 MODULE 4: KHO MÁU FEFO & KÉT NHÓM MÁU HIẾM (`InventoryVaultModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M4-01:** Tạo bảng CSDL `BloodBags` (có trạng thái `QUARANTINE`, `destinationHospitalId`), `RareBloodVault` và `VaultUnlockRequests`.
- [x] **BE-M4-02:** Viết API `GET /api/v1/inventory/fefo-list`: Truy vấn túi `IN_STOCK` sắp xếp theo hạn sử dụng tăng dần (`ORDER BY ngayHetHan ASC`).
- [x] **BE-M4-03:** Viết API `GET /api/v1/inventory/summary`: Tổng hợp số túi và thể tích theo 8 nhóm máu từ view `vw_BloodInventorySummary` (không cache).
- [x] **BE-M4-04:** Lập trình Module **AES-256-GCM** bảo vệ SĐT và địa chỉ người có nhóm máu hiếm ($Rh-, Bombay...$): mỗi trường một IV và authTag riêng, có `keyVersion`.
- [x] **BE-M4-05:** Viết API mở két 2 lớp: `POST /api/v1/vault/request-unlock` (Admin) $\rightarrow$ `POST /api/v1/vault/approve` (người phê duyệt khác, tự nhập OTP trong phiên của mình) $\rightarrow$ `GET /api/v1/vault/:requestId/reveal` (giải mã theo từng lần xem trong 15 phút).
- [x] **BE-M4-06:** Tạo Service ghi nhật ký kiểm toán không thể sửa/xóa vào `AuditLogs` (chỉ `INSERT`, có chuỗi băm) cho mọi bước mở két và xuất kho.
- [x] **BE-M4-07:** Viết API `POST /api/v1/inventory/blood-bag/:id/lab-result`: nhập kết quả xét nghiệm sàng lọc chính thức; đạt $\rightarrow$ `IN_STOCK`, không đạt $\rightarrow$ `DISCARDED`; phát `inventory:stock_changed`.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M4-01:** Xây dựng trang Quản trị Kho máu `BloodInventoryPage.tsx` chuẩn DataTable (All/50/20/10, Sắp xếp hạn dùng, Lọc 8 nhóm máu, Tìm kiếm Debounce).
- [ ] **FE-M4-02:** Thiết kế 8 thẻ chỉ số tồn kho với 3 mức cảnh báo màu: 🔴 Báo động thiếu ($< 10$ túi) | 🟡 Đủ dùng ($10 - 30$ túi) | 🟢 Dồi dào ($> 30$ túi).
- [ ] **FE-M4-03:** Huy hiệu cảnh báo hạn dùng túi máu theo phương pháp FEFO: Đỏ ($< 7$ ngày) | Vàng ($7 - 15$ ngày) | Xanh ($> 15$ ngày).
- [ ] **FE-M4-04:** Xây dựng Modal Két Máu Hiếm `RareBloodVaultModal.tsx`: Che mặt nạ dữ liệu (`0908***123`); Admin gửi yêu cầu kèm mã bệnh án; người phê duyệt (tài khoản khác) có màn hình duyệt với ô nhập OTP của chính mình.
- [ ] **FE-M4-05:** Sau khi duyệt, Admin thấy số điện thoại với đồng hồ đếm ngược 15 phút (hết giờ tự ẩn, gọi lại API sẽ nhận 403) kèm nút gọi nhanh hotline.
- [ ] **FE-M4-06:** Xây dựng trang `QuarantineBagsPage.tsx` (DataTable): danh sách túi `QUARANTINE`, nhập kết quả sàng lọc chính thức để chuyển `IN_STOCK` hoặc `DISCARDED`.

---

## 🚑 MODULE 5: PHÂN PHỐI BỆNH VIỆN & CẤP CỨU KHẨN 115 (`HospitalIntegrationModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M5-01:** Tạo bảng CSDL `Hospitals`, `HospitalDispatches`, `HospitalDispatchBags` (nối túi máu với lệnh xuất) và `EmergencyRequests`.
- [x] **BE-M5-02:** Viết Stored Procedure `sp_DispatchBloodBagsFEFO` (theo mẫu `Architechture.md` mục 6): chọn túi `IN_STOCK` cận hạn nhất với `WITH (UPDLOCK, ROWLOCK, READPAST)`, gán vào lệnh xuất, ghi `destinationHospitalId`, chuyển `IN_TRANSIT`, ghi AuditLogs.
- [x] **BE-M5-03:** Viết API Bệnh viện xem kho Hội CTĐ: `GET /api/v1/hospital/inventory-overview` (Phân quyền: `HOSPITAL_STAFF`, chỉ đọc Read-only).
- [x] **BE-M5-04:** Viết API Phát lệnh cấp cứu: `POST /api/v1/hospital/emergency-alert` (bệnh viện lấy từ tài khoản) $\rightarrow$ Lưu ca bệnh, phát Socket.io `emergency:red_alert`; thêm `POST /api/v1/emergency/:id/acknowledge` để Hội CTĐ xác nhận, và gửi SMS/email dự phòng nếu quá 2 phút chưa xác nhận.
- [x] **BE-M5-05:** Viết Stored Procedure `sp_HospitalReceiveBloodBag`: lấy bệnh viện từ `Users.hospitalId` của người đăng nhập, kiểm tra đúng bệnh viện đích, đổi trạng thái túi máu sang `HOSPITAL_RECEIVED`, ghi nhận theo từng túi.
- [x] **BE-M5-06:** Lập trình Background Worker đóng vòng lặp cung ứng: Tự động gửi thông báo cảm ơn đến người hiến khi túi máu được quét nhận (kênh gửi chờ chốt nhà cung cấp, xem `Overview.md` mục 6).
- [x] **BE-M5-07:** Viết API `POST /api/v1/hospital/dispatch`: Lập lệnh xuất kho FEFO (pool `priority`), nhập tay biển số xe và hotline tài xế, trả `dispatchId` kèm danh sách túi.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M5-01:** Xây dựng Cổng thông tin Bệnh viện `HospitalPortalPage.tsx`: Hiển thị bảng tổng quan kho máu Hội Chữ Thập Đỏ dành riêng cho bác sĩ bệnh viện.
- [ ] **FE-M5-02:** Xây dựng Modal Phát lệnh cấp cứu máu `EmergencyAlertModal.tsx`: Chọn nhóm máu cần, số lượng túi, nhập mã bệnh án, chọn mức độ *"NGUY CẤP (Báo động đỏ)"*.
- [ ] **FE-M5-03:** Hiệu ứng Báo Động Đỏ thời gian thực: Khi nhận tín hiệu Socket cấp cứu $\rightarrow$ Toàn màn hình Hội CTĐ nhấp nháy đỏ kèm còi hú. Có nút "Bật âm thanh báo động" đầu ca (trình duyệt chặn âm thanh tự phát) và nút "Đã nhận lệnh".
- [ ] **FE-M5-04:** Xây dựng màn hình Bệnh viện quét nhận túi máu `HospitalScanReceivePage.tsx` (yêu cầu đăng nhập):
  * Mở camera quét mã QR trên túi máu.
  * Hiển thị thông tin kiểm chứng (Nhóm máu, hạn dùng, nhiệt độ bảo quản).
  * Nút bấm to nổi bật: *"XÁC NHẬN NHẬP KHO BỆNH VIỆN"*.
- [ ] **FE-M5-05:** Màn hình Giám sát điều phối xe 115: Hiển thị biển số xe, số điện thoại tài xế và trạng thái hành trình do nhân viên cập nhật (không có GPS).

---

## 👤 MODULE 6: CỔNG THÔNG TIN NGƯỜI HIẾN & LỊCH SỬ CÁ NHÂN (`DonorPortalModule`)

### ⚙️ PHẦN BACKEND (Node.js + Express + TypeScript + MSSQL)
- [x] **BE-M6-01:** Viết API Đăng ký tài khoản liên kết CCCD: `POST /api/v1/auth/register-donor` (kèm ngày sinh) $\rightarrow$ khớp ngày sinh với hồ sơ, xác minh email bằng OTP, sau đó mới liên kết các lần hiến cũ vào tài khoản (`PENDING_VERIFY` $\rightarrow$ `ACTIVE`).
- [x] **BE-M6-02:** Viết API Đăng nhập có chống Brute-force: sai 5 lần $\rightarrow$ khóa tạm 3 phút (bộ nhớ ứng dụng); tiếp tục sai $\rightarrow$ khóa tăng dần 15 phút / 1 giờ kèm cảnh báo email. Không tự động khóa vĩnh viễn; `LOCKED` chỉ do Admin đặt thủ công.
- [x] **BE-M6-03:** Viết API Quên mật khẩu qua Gmail SMTP (`nodemailer`): Tạo mã OTP 6 số ngẫu nhiên, TTL 5 phút, cooldown gửi lại 60 giây.
- [x] **BE-M6-04:** Viết API Tra cứu lịch sử hiến máu cá nhân: `GET /api/v1/donor/history` (Trả về ngày hiến, điểm hiến, lượng máu, bệnh viện đã nhận túi máu).
- [x] **BE-M6-05:** Lập trình dịch vụ sinh Giấy chứng nhận hiến máu điện tử: Xuất file PDF chuẩn thương hiệu SmartBlood có hoa văn bảo mật, con dấu đỏ điện tử và mã QR tra cứu.
- [x] **BE-M6-06:** Viết API `GET /api/v1/donor/certificate/:historyId/download` tải file PDF chứng nhận điện tử.

### 🖥️ PHẦN FRONTEND (React 19 + TypeScript + Tailwind CSS)
- [ ] **FE-M6-01:** Xây dựng Trang cá nhân Người hiến `DonorDashboardPage.tsx`: Thẻ tóm tắt tổng số lần hiến, tổng thể tích máu đóng góp cho cộng đồng.
- [ ] **FE-M6-02:** Thiết kế Vòng tròn chu kỳ an toàn 84 ngày: Hiển thị % phục hồi sinh học và thông báo: *"Bạn đủ điều kiện hiến máu tiếp theo sau X ngày nữa"*.
- [ ] **FE-M6-03:** Xây dựng Bảng lịch sử các lần hiến máu chuẩn DataTable: Hiển thị chi tiết từng lần hiến kèm tên bệnh viện đã tiếp nhận túi máu của người hiến.
- [ ] **FE-M6-04:** Component Xem trước và Tải Giấy chứng nhận điện tử: Xem trực tiếp thẻ chứng nhận trên điện thoại kèm nút *"Tải bản PDF in ấn"*.
- [ ] **FE-M6-05:** Modal Đăng nhập / Quên mật khẩu 2 bước (Glassmorphism): Đồng hồ đếm ngược 5:00 nhập OTP Gmail, hỗ trợ phím `Esc` và click ngoài nền mờ để đóng modal.

---

## 📋 BẢNG ÁNH XẠ CHỨC NĂNG HAI PHÍA (API $\leftrightarrow$ FRONTEND COMPONENT)

| Module | Tên Chức Năng Cốt Lõi | Backend API Endpoint | Frontend Component / Page |
| :--- | :--- | :--- | :--- |
| **M1** | Tạo sự kiện & Sinh mã QR | `POST /api/v1/events` | `AdminEventsPage.tsx` / `EventFormModal.tsx` |
| **M2** | Tra cứu CCCD Auto-fill | `POST /api/v1/public/checkin/lookup-cccd` | `MobileCheckInPage.tsx` |
| **M2** | Đăng ký quét QR cấp STT | `POST /api/v1/public/checkin/submit` | `MobileCheckInPage.tsx` |
| **M3** | Hàng đợi Bàn tiếp nhận y tế | WebSocket: `donor:checkin_submitted` | `MedicalWorkflowBoard.tsx` (Kanban) |
| **M3** | Khám lâm sàng & Xét nghiệm | `POST /api/v1/medical/exam/...` | `ClinicalExamModal.tsx` / `RapidTestModal.tsx` |
| **M4** | Danh sách kho máu FEFO | `GET /api/v1/inventory/fefo-list` | `BloodInventoryPage.tsx` |
| **M4** | Mở két bảo mật nhóm máu hiếm | `POST /api/v1/vault/request-unlock` / `approve` / `GET .../reveal` | `RareBloodVaultModal.tsx` |
| **M4** | Duyệt túi máu cách ly | `POST /api/v1/inventory/blood-bag/:id/lab-result` | `QuarantineBagsPage.tsx` |
| **M5** | Bệnh viện quét QR nhận máu | `POST /api/v1/hospital/verify-and-receive`| `HospitalScanReceivePage.tsx` |
| **M5** | Bệnh viện phát lệnh cấp cứu | `POST /api/v1/hospital/emergency-alert` | `EmergencyAlertModal.tsx` / Báo động đỏ |
| **M6** | Tra cứu lịch sử & Tải PDF | `GET /api/v1/donor/history` & `certificate`| `DonorDashboardPage.tsx` |
| **M6** | Quên mật khẩu OTP Gmail | `POST /api/v1/auth/forgot-password` | `ForgotPasswordModal.tsx` |
