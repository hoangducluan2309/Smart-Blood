# DANH MỤC TASK TỔNG BẮT BUỘC CHECKLIST (TASK.MD)
## DỰ ÁN: SMARTBLOOD - HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA

---

## BẢNG ĐIỀU KHIỂN TIẾN ĐỘ TỔNG THỂ (PROGRESS SUMMARY)

| Phân hệ kỹ thuật / Nghiệp vụ | Tổng số Task | Đã hoàn thành | Chưa thực hiện | Tỷ lệ hoàn thành |
| :--- | :---: | :---: | :---: | :---: |
| **Phân hệ 1: CSDL & Stored Procedure (MSSQL)** | 12 | 12 | 0 | 100% |
| **Phân hệ 2: Backend API (Node.js + Express + TS)** | 16 | 16 | 0 | 100% |
| **Phân hệ 3: Frontend UI & Mobile (React 19 + TS)** | 13 | 0 | 13 | 0% |
| **Phân hệ 4: Hạ tầng, Caching & An ninh** | 8 | 5 | 3 | 63% |
| **Phân hệ 5: Kiểm thử & Nghiệm thu (E2E)** | 7 | 7 | 0 | 100% |
| **TỔNG CỘNG TOÀN HỆ THỐNG** | **56** | **40** | **16** | **71%** |

> 📌 **Quy tắc thực hiện:** Bắt buộc phải đánh dấu `[x]` vào từng mục checklist ngay sau khi hoàn thành và kiểm thử thành công tính năng tương ứng.

---

## 1. PHÂN HỆ 1: CƠ SỞ DỮ LIỆU & STORED PROCEDURE (DATABASE CHECKLIST)

- [x] **TASK-DB-01: Tạo CSDL HienMauDB & Bảng Users**  
  *Nghiệp vụ:* Quản lý tài khoản Admin, Nhân viên Hội CTĐ, Nhân viên Bệnh viện, Người hiến có tài khoản. Cột `hospitalId` (bắt buộc với `HOSPITAL_STAFF`), `laNguoiPheDuyet`, `emailDaXacThuc`, `trangThai` (`PENDING_VERIFY`/`ACTIVE`/`LOCKED`). Bộ đếm sai và khóa tạm nằm trong bộ nhớ ứng dụng, không lưu ở bảng này.
- [x] **TASK-DB-02: Tạo Bảng Donors & DonationHistory**  
  *Nghiệp vụ:* `Donors` định danh duy nhất theo CCCD (họ tên, ngày sinh, nhóm máu, cờ `laNhomMauHiem`; SĐT và địa chỉ để `NULL` với người hiến máu hiếm). `DonationHistory` là nguồn sự thật duy nhất cho luật 84 ngày (không lưu `ngayHienGanNhat` ở `Donors`).
- [x] **TASK-DB-03: Tạo Bảng RareBloodVault & VaultUnlockRequests**  
  *Nghiệp vụ:* Lưu SĐT và địa chỉ mã hóa AES-256-GCM, **mỗi trường có `iv` và `authTag` riêng**, kèm `keyVersion`. `VaultUnlockRequests` lưu yêu cầu mở két (người yêu cầu, người duyệt khác người yêu cầu, mã bệnh án, `expiresAt`).
- [x] **TASK-DB-04: Tạo Bảng DonationEvents & DonorCheckIns**  
  *Nghiệp vụ:* Quản lý chiến dịch hiến máu, mã QR sự kiện, lượt check-in và STT tiếp nhận. `DonorCheckIns` có `clientRequestId` UNIQUE (chống gửi trùng), UNIQUE (`eventId`, `donorId`), cờ đồng ý xử lý dữ liệu, khai báo sức khỏe và `buocHienTai` (`CHO_KHAM`/`CHO_XET_NGHIEM`/`CHO_LAY_MAU`/`HOAN_THANH`/`TAM_HOAN`).
- [x] **TASK-DB-05: Tạo Bảng ClinicalExams & ScreeningTests**  
  *Nghiệp vụ:* Lưu kết quả khám sàng lọc sinh hiệu (Huyết áp, Tim mạch, Cân nặng) và xét nghiệm nhanh mao mạch (Hb, Viêm gan B/C, HIV).
- [x] **TASK-DB-06: Tạo Bảng BloodBags (và view tồn kho)**  
  *Nghiệp vụ:* Túi máu với mã nội bộ `maVachTuiMau` UNIQUE, mã QR, hạn dùng, `destinationHospitalId`, `ketQuaSangLoc`, trạng thái `QUARANTINE`/`IN_STOCK`/`IN_TRANSIT`/`HOSPITAL_RECEIVED`/`DISCARDED`/`EXPIRED`. Không có bảng `KhoMau`: tồn kho là view `vw_BloodInventorySummary` (chỉ tính `IN_STOCK`).
- [x] **TASK-DB-07: Tạo Bảng Hospitals, HospitalDispatches, HospitalDispatchBags & EmergencyRequests**  
  *Nghiệp vụ:* Danh mục bệnh viện, lệnh xuất kho (biển số xe, hotline tài xế), bảng nối từng túi máu với lệnh xuất (ghi nhận nhận máu theo từng túi), lệnh cấp cứu và xác nhận đã nhận lệnh.
- [x] **TASK-DB-08: Tạo Bảng AuditLogs (Nhật ký an ninh bất biến)**  
  *Nghiệp vụ:* Ghi mọi hành động mở két, xuất kho, đăng nhập sai. Tài khoản ứng dụng chỉ có quyền `INSERT`; cột `hashTruoc`/`hash` tạo chuỗi băm phát hiện sửa/xóa.
- [x] **TASK-DB-09: Lập trình Stored Procedure sp_LookupDonorByCCCD**  
  *Tiêu chí:* Nhận CCCD + ngày sinh; kiểm tra ngày sinh khớp mới trả dữ liệu auto-fill (không khớp thì trả kết quả như người hiến mới, không lộ việc CCCD đã có hồ sơ); tính số ngày từ `MAX(DonationHistory.ngayHien)` so với mốc 84 ngày. Người hiến máu hiếm không trả SĐT/địa chỉ.
- [x] **TASK-DB-10: Lập trình Stored Procedure sp_DispatchBloodBagsFEFO & sp_HospitalReceiveBloodBag**  
  *Tiêu chí:* FEFO với `WITH (UPDLOCK, ROWLOCK, READPAST)`; gán túi vào lệnh xuất, ghi `destinationHospitalId` và AuditLogs trong cùng transaction. `sp_HospitalReceiveBloodBag` nhận `userId`, tự lấy bệnh viện từ `Users.hospitalId`, kiểm tra bệnh viện đích rồi đổi sang `HOSPITAL_RECEIVED`.
- [x] **TASK-DB-11: Lập trình Stored Procedure sp_SubmitDonorCheckIn**  
  *Tiêu chí:* Kiểm tra lại 84 ngày, sự kiện đang mở đúng khung giờ, không ghi đè họ tên/ngày sinh/nhóm máu của hồ sơ đã có; cấp STT bằng bộ đếm một dòng; idempotent theo `clientRequestId` (gửi lại trả về STT cũ).
- [x] **TASK-DB-12: Lập trình Stored Procedure sp_ProcessBloodBagStockIn & sp_RecordBloodBagLabResult**  
  *Tiêu chí:* Lấy máu → tạo túi ở trạng thái `QUARANTINE` và `DonationHistory`; ghi kết quả sàng lọc chính thức → `IN_STOCK` (đạt) hoặc `DISCARDED` (không đạt).

---

## 2. PHÂN HỆ 2: BACKEND API & DỊCH VỤ MICROSERVICES (BACKEND CHECKLIST)

### Module 1: Sự kiện & Mã QR Động (`EventQRModule`)
- [x] **TASK-BE-01: API Tạo sự kiện & Sinh mã QR động**  
  *Endpoint:* `POST /api/v1/events` $\rightarrow$ Tự động sinh mã URL check-in và ảnh QR Code vector SVG/PNG.
- [x] **TASK-BE-02: API Giám sát tiến độ sự kiện Real-time**  
  *Endpoint:* `GET /api/v1/events/:id/progress` $\rightarrow$ Trả về tỷ lệ % chỉ tiêu và số lượng người đã quét QR.

### Module 2: Check-in Công Khai Không Cần Login (`PublicCheckInModule`)
- [x] **TASK-BE-03: API Tra cứu CCCD Auto-fill & Kiểm tra 84 ngày**  
  *Endpoint:* `POST /api/v1/public/checkin/lookup-cccd` (body: `cccd`, `ngaySinh`; không đưa CCCD vào URL)  
  *Tiêu chí:* Người mới $\rightarrow$ Form trống; Người cũ $\ge 84$ ngày và đúng ngày sinh $\rightarrow$ Trả về thông tin tự điền; sai ngày sinh $\rightarrow$ phản hồi như người mới (không lộ hồ sơ), tính vào giới hạn 5 lần sai/giờ/CCCD; Người cũ $< 84$ ngày $\rightarrow$ Báo từ chối kèm ngày hiến tiếp.
- [x] **TASK-BE-04: API Đăng ký hiến máu tại sự kiện & Cấp số thứ tự STT**  
  *Endpoint:* `POST /api/v1/public/checkin/submit` (body có `clientRequestId`, đồng ý xử lý dữ liệu, khai báo sức khỏe) $\rightarrow$ Gọi `sp_SubmitDonorCheckIn`, trả STT và token theo dõi `checkInId`, bắn Socket.io `donor:checkin_submitted` vào kênh `/staff`.

### Module 3: Điều Phối Tiến Trình Y Tế Hội CTĐ (`MedicalWorkflowModule`)
- [x] **TASK-BE-05: API Tiếp nhận & Khám lâm sàng sinh hiệu (Bước 1)**  
  *Endpoint:* `POST /api/v1/medical/exam/clinical` $\rightarrow$ Lưu huyết áp (tâm thu và tâm trương), nhịp tim, cân nặng; so với bảng ngưỡng cấu hình, xác nhận thể tích được phép lấy; đạt $\rightarrow$ `CHO_XET_NGHIEM`, không đạt $\rightarrow$ `TAM_HOAN` kèm lý do.
- [x] **TASK-BE-06: API Xét nghiệm nhanh mao mạch (Bước 2)**  
  *Endpoint:* `POST /api/v1/medical/exam/rapid-test` $\rightarrow$ Ghi nhận Hemoglobin và test nhanh; đạt $\rightarrow$ `CHO_LAY_MAU`; **không đạt (Hb thấp hoặc test dương tính) $\rightarrow$ `TAM_HOAN`**, lý do chỉ hiển thị cho nhân viên có quyền, không đẩy ra TV hay điện thoại người hiến.
- [x] **TASK-BE-07: API Lấy máu & Nhập kho cách ly (Bước 3 & 4)**  
  *Endpoint:* `POST /api/v1/medical/blood-bag/collect` $\rightarrow$ Sinh mã túi máu nội bộ, mã QR, tạo túi ở trạng thái `QUARANTINE` và `DonationHistory` trong Transaction.

### Module 4: Kho Máu FEFO & Két Nhóm Máu Hiếm (`InventoryVaultModule`)
- [x] **TASK-BE-08: API Danh sách kho máu FEFO**  
  *Endpoint:* `GET /api/v1/inventory/fefo-list` $\rightarrow$ Sắp xếp theo hạn dùng gần nhất, phân loại 3 màu cảnh báo.
- [x] **TASK-BE-09: Tiện ích mã hóa AES-256-GCM & API Két máu hiếm 2 lớp**  
  *Endpoint:* `POST /api/v1/vault/request-unlock` (Admin yêu cầu) $\rightarrow$ `POST /api/v1/vault/approve` (người phê duyệt khác, tự nhập OTP trong phiên của mình) $\rightarrow$ `GET /api/v1/vault/:requestId/reveal` (giải mã theo từng lần xem trong 15 phút, hết hạn trả 403). Mỗi trường dùng IV riêng; ghi Audit Log cho mọi bước.

### Module 5: Phân Phối Bệnh Viện & Cấp Cứu 115 (`HospitalIntegrationModule`)
- [x] **TASK-BE-10: API Bệnh viện xem tồn kho Hội Chữ Thập Đỏ (Read-only)**  
  *Endpoint:* `GET /api/v1/hospital/inventory-overview` $\rightarrow$ Trả về số lượng túi `IN_STOCK` theo 8 nhóm máu.
- [x] **TASK-BE-11: API Bệnh viện quét mã QR xác nhận nhận túi máu**  
  *Endpoint:* `POST /api/v1/hospital/verify-and-receive` (body: `bagCode`, nhiệt độ; **bệnh viện lấy từ tài khoản đăng nhập, không nhận từ client**) $\rightarrow$ Đổi trạng thái sang `HOSPITAL_RECEIVED`, kích hoạt thông báo cảm ơn người hiến.
- [x] **TASK-BE-12: API Phát lệnh cấp cứu hỏa tốc & Báo động đỏ Socket.io**  
  *Endpoint:* `POST /api/v1/hospital/emergency-alert` (bệnh viện lấy từ tài khoản) $\rightarrow$ Kích hoạt `emergency:red_alert`; cần nhân viên Hội CTĐ xác nhận (`POST /api/v1/emergency/:id/acknowledge`); quá 2 phút chưa xác nhận thì gửi thêm SMS/email cho người trực.

### Module 6: Cổng Cá Nhân Người Hiến (`DonorPortalModule`)
- [x] **TASK-BE-13: API Đăng ký / Đăng nhập liên kết số CCCD**  
  *Tiêu chí:* Đăng ký phải khớp ngày sinh và xác minh email bằng OTP trước khi liên kết các lần hiến cũ; chống Brute-force: sai 5 lần khóa tạm 3 phút, sau đó khóa tăng dần 15 phút / 1 giờ và cảnh báo email, **không khóa vĩnh viễn tự động**.
- [x] **TASK-BE-14: API Tra cứu lịch sử & Xuất Giấy chứng nhận điện tử (PDF)**  
  *Endpoint:* `GET /api/v1/donor/history` & `GET /api/v1/donor/certificate/:id/download` $\rightarrow$ Render PDF có dấu đỏ điện tử và QR xác thực.

### Module 4 & 5 bổ sung
- [x] **TASK-BE-15: API Nhập kết quả xét nghiệm sàng lọc chính thức (duyệt túi cách ly)**  
  *Endpoint:* `POST /api/v1/inventory/blood-bag/:id/lab-result` $\rightarrow$ Gọi `sp_RecordBloodBagLabResult`: đạt $\rightarrow$ `IN_STOCK`, không đạt $\rightarrow$ `DISCARDED`; phát `inventory:stock_changed`.
- [x] **TASK-BE-16: API Lập lệnh xuất kho FEFO cho bệnh viện**  
  *Endpoint:* `POST /api/v1/hospital/dispatch` $\rightarrow$ Gọi `sp_DispatchBloodBagsFEFO` (dùng pool `priority`), gán biển số xe và hotline tài xế do nhân viên nhập, trả `dispatchId` kèm danh sách túi.

---

## 3. PHÂN HỆ 3: FRONTEND UI & MOBILE RESPONSIVE (FRONTEND CHECKLIST)

- [ ] **TASK-FE-01: Cấu hình Theme y tế chuẩn & Layout điều hướng**  
  *Tiêu chí:* Áp dụng đúng 4 mã màu: Đỏ `#BA1C1D`, Cam `#F37021`, Xanh `#00558F`, Vàng `#EAB308`. Tuyệt đối không dùng màu đen `#000000`.
- [ ] **TASK-FE-02: Xây dựng Component DataTable chuẩn cho tất cả danh sách**  
  *Tiêu chí:* Hỗ trợ phân trang 4 mức (All, 50, 20, 10), sắp xếp cột, bộ lọc đa tiêu chí, tìm kiếm Debounce 300ms.
- [ ] **TASK-FE-03: Màn hình Mobile Check-in không cần Đăng nhập (`MobileCheckInPage.tsx`)**  
  *Tiêu chí:* Tối ưu cảm ứng điện thoại; nhập CCCD + ngày sinh rồi tự gửi tra cứu; có ô đồng ý xử lý dữ liệu và phiếu khai báo sức khỏe; gửi `submit` kèm `clientRequestId` (bấm lại không tạo trùng); hiển thị STT cỡ lớn.
- [ ] **TASK-FE-04: Lưu nháp form đăng ký (sessionStorage)**  
  *Tiêu chí:* Chống mất dữ liệu khi mạng 4G chập chờn. **Bản nháp không chứa CCCD**, tự xóa sau khi gửi thành công hoặc sau 24 giờ.
- [ ] **TASK-FE-05: Màn hình Bàn tiếp nhận y tế 4 cột Kanban (`MedicalWorkflowBoard.tsx`)**  
  *Tiêu chí:* Cột 1 (Chờ tiếp nhận & khám lâm sàng) $\rightarrow$ Cột 2 (Chờ xét nghiệm) $\rightarrow$ Cột 3 (Chờ lấy máu) $\rightarrow$ Cột 4 (Hoàn tất / Tạm hoãn); tự động cập nhật qua Socket.io (kênh `/staff`, cần JWT). Màn hình TV công cộng (`/display`) chỉ hiện STT và bước.
- [ ] **TASK-FE-06: Modal khám sàng lọc đo sinh hiệu & xét nghiệm nhanh**  
  *Tiêu chí:* Thao tác 1 chạm nhanh gọn cho bác sĩ và kỹ thuật viên y tế.
- [ ] **TASK-FE-07: Màn hình Quản trị Kho máu FEFO (`BloodInventoryPage.tsx`)**  
  *Tiêu chí:* Thẻ chỉ số 8 nhóm máu, bảng danh sách túi máu phân màu cảnh báo hạn dùng (Đỏ/Vàng/Xanh).
- [ ] **TASK-FE-08: Modal Két bảo mật Nhóm Máu Hiếm (Phê duyệt 2 lớp OTP)**  
  *Tiêu chí:* Admin gửi yêu cầu kèm mã bệnh án; Lãnh đạo (tài khoản khác) nhận thông báo và tự nhập OTP trong phiên của mình để duyệt; sau khi duyệt, Admin thấy SĐT với đồng hồ đếm ngược 15 phút, hết giờ tự ẩn.
- [ ] **TASK-FE-09: Màn hình Bệnh viện quét mã QR nhận túi máu (`HospitalScanReceivePage.tsx`)**  
  *Tiêu chí:* Bật camera quét mã QR trên nhãn túi máu $\rightarrow$ Hiển thị chi tiết túi máu $\rightarrow$ Bấm nút to xác nhận nhập kho viện.
- [ ] **TASK-FE-10: Bàn Giám sát Cấp cứu Bệnh viện & Còi hú báo động đỏ**  
  *Tiêu chí:* Khi Bệnh viện phát lệnh cấp cứu, toàn màn hình Hội CTĐ nhấp nháy đỏ kèm còi hú. Có nút "Bật âm thanh báo động" đầu ca (trình duyệt chặn âm thanh tự phát) và nút "Đã nhận lệnh" để xác nhận.
- [ ] **TASK-FE-11: Cổng cá nhân Người hiến máu (`DonorDashboardPage.tsx`)**  
  *Tiêu chí:* Thẻ tóm tắt số lần hiến máu, tổng lượng máu hiến, thanh % phục hồi chu kỳ 84 ngày, bảng lịch sử các lần hiến.
- [ ] **TASK-FE-12: Modal Quên mật khẩu OTP Gmail 2 bước (Glassmorphism)**  
  *Tiêu chí:* Nhập email $\rightarrow$ Nhập OTP 6 số (đồng hồ đếm ngược 5:00, cooldown gửi lại 60s) $\rightarrow$ Nhập mật khẩu mới.
- [ ] **TASK-FE-13: Màn hình duyệt túi máu cách ly (`QuarantineBagsPage.tsx`)**  
  *Tiêu chí:* DataTable các túi `QUARANTINE`; nhập kết quả sàng lọc chính thức (đạt / không đạt) để chuyển túi sang `IN_STOCK` hoặc `DISCARDED`; mặc định ẩn túi cách ly khỏi tồn kho khả dụng.

---

## 4. PHÂN HỆ 4: HẠ TẦNG CHỊU TẢI, CACHING & AN NINH (INFRASTRUCTURE CHECKLIST)

- [ ] **TASK-INFRA-01: Cấu hình Nginx Reverse Proxy & Load Balancer**  
  *Tiêu chí:* SSL Termination, nén động Gzip/Brotli, phục vụ file tĩnh frontend, cấu hình WebSocket Upgrade headers cho Socket.io; một instance backend nên chưa cần cân bằng tải.
- [x] **TASK-INFRA-02: Tích hợp API Rate Limiting (`express-rate-limit`)**  
  *Tiêu chí:* 300 req/phút/IP cho trang check-in; tra cứu CCCD tối đa 5 lần sai ngày sinh mỗi giờ cho mỗi CCCD (đếm trong bộ nhớ ứng dụng) + 60 req/phút/IP; bypass cho Bệnh viện cấp cứu theo vai trò trong JWT, không theo IP. Cấu hình `real_ip` nếu dùng Cloudflare.
- [ ] **TASK-INFRA-03: Cấu hình CDN Edge Caching (Cloudflare)**  
  *Tiêu chí:* Cache toàn bộ bundle React 19, CSS Tailwind và ảnh SVG/PNG mã QR sự kiện (`max-age=86400`).
- [x] **TASK-INFRA-04: Bộ nhớ tạm trong ứng dụng (`shared/memory-store.ts`)**  
  *Tiêu chí:* Map có thời hạn tự hết cho OTP (5 phút), khóa brute-force (3 phút trở lên theo chính sách) và bộ đếm sai ngày sinh theo CCCD (1 giờ). Có comment `shortcut`: mất khi khởi động lại, chỉ 1 instance. Không dùng Redis; không cache tồn kho/sự kiện.
- [ ] **TASK-INFRA-05: Sao lưu & khôi phục CSDL**  
  *Tiêu chí:* Sao lưu tự động hằng ngày (và trước mỗi sự kiện lớn), lưu bản sao ngoài máy chủ; có biên bản thử khôi phục thành công. Không dùng Redlock: chống xuất trùng túi máu do `UPDLOCK, ROWLOCK, READPAST` trong SP đảm nhận.
- [x] **TASK-INFRA-06: Tích hợp Google Gmail SMTP thực tế (`nodemailer`)**  
  *Tiêu chí:* Gửi email HTML chuẩn thương hiệu SmartBlood; cơ chế fallback in OTP ra Terminal khi chưa cấu hình mật khẩu ứng dụng.
- [x] **TASK-INFRA-07: Đóng gói toàn bộ hệ thống bằng Docker Compose**  
  *Tiêu chí:* Khởi chạy toàn bộ hệ thống (MSSQL 2019 + Backend Express + Frontend Nginx) bằng 1 lệnh `docker compose up -d`.
- [x] **TASK-INFRA-08: Cấu hình Database Connection Pool**  
  *Tiêu chí:* Hai pool tách biệt: `main` (max 40) và `priority` (max 10, dành cho xuất kho, nhận máu, cấp cứu) để cao điểm check-in không làm nghẽn cấp cứu.

---

## 5. PHÂN HỆ 5: KIỂM THỬ TỰ ĐỘNG & NGHIỆM THU (TESTING CHECKLIST)

- [x] **TASK-TEST-01: Bộ Unit Test Logic Y tế Cốt lõi**  
  *Tiêu chí:* Test ma trận tương thích 8 nhóm máu; Test quy tắc khoảng cách an toàn 84 ngày (Thông tư 26/BYT); Test thuật toán FEFO.
- [x] **TASK-TEST-02: Bộ Unit Test An ninh & Bảo mật**  
  *Tiêu chí:* Test mã hóa/giải mã AES-256-GCM (IV khác nhau cho từng trường, sai authTag thì từ chối); Test sai 5 lần khóa tạm 3 phút rồi khóa tăng dần, **không tự khóa vĩnh viễn**; Test yêu cầu mở két bị từ chối khi người duyệt trùng người yêu cầu, OTP sai quá 3 lần, hoặc quá 15 phút.
- [x] **TASK-TEST-03: Kiểm thử luồng Quét QR & CCCD Auto-fill (E2E)**  
  *Tiêu chí:* Mô phỏng người hiến quét QR, nhập CCCD hợp lệ, kiểm tra dữ liệu cũ tự điền và nhận STT thành công.
- [x] **TASK-TEST-04: Kiểm thử luồng Bàn tiếp nhận y tế 4 bước (E2E)**  
  *Tiêu chí:* Mô phỏng y tá duyệt Tiếp nhận $\rightarrow$ Bác sĩ khám lâm sàng $\rightarrow$ Kỹ thuật viên xét nghiệm $\rightarrow$ Lấy máu nhập kho.
- [x] **TASK-TEST-05: Kiểm thử luồng Xuất máu & Bệnh viện quét QR nhận máu (E2E)**  
  *Tiêu chí:* Mô phỏng xuất kho FEFO gán xe 115 $\rightarrow$ Nhân viên bệnh viện quét QR nhận túi máu $\rightarrow$ Kích hoạt đóng vòng lặp gửi SMS cảm ơn.
- [x] **TASK-TEST-06: Kiểm thử luồng Báo động đỏ cấp cứu 115 qua Socket.io (E2E)**  
  *Tiêu chí:* Bệnh viện phát lệnh cấp cứu `NGUY_CAP` $\rightarrow$ Tín hiệu truyền dưới 1 giây, còi hú báo động kích hoạt trên màn hình Hội Chữ Thập Đỏ; nếu không ai xác nhận sau 2 phút thì có thông báo dự phòng.
- [x] **TASK-TEST-07: Kiểm thử bảo mật truy cập công khai**  
  *Tiêu chí:* Lookup sai ngày sinh không lộ SĐT/địa chỉ và bị giới hạn theo CCCD; `submit` không ghi đè họ tên/ngày sinh/nhóm máu hồ sơ cũ; gọi thẳng `submit` với người chưa đủ 84 ngày bị từ chối; gửi trùng `clientRequestId` không tạo thêm STT; nhân viên bệnh viện A không nhận được túi gán cho bệnh viện B dù sửa request; socket không có token không nhận được dữ liệu cá nhân.
