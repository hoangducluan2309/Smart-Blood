# TỔNG QUAN HỆ THỐNG SMARTBLOOD (OVERVIEW.MD)
## DỰ ÁN: HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ KHÉP KÍN
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA (TỈNH ĐỒNG NAI)

---

## 1. GIỚI THIỆU DỰ ÁN

**SmartBlood** là nền tảng chuyển đổi số toàn diện trong công tác hiến máu nhân đạo và điều phối chuỗi cung ứng máu y tế khép kín, được thiết kế chuyên biệt cho **Hội Chữ Thập Đỏ TP. Biên Hòa**. Hệ thống đóng vai trò đầu mối trung tâm kết nối giữa:
* **Người dân hiến máu (Donors)** tại các buổi tiếp nhận máu lưu động (phường, xã, trường đại học, khu công nghiệp).
* **Đội ngũ y tế tiếp nhận** của Hội Chữ Thập Đỏ TP. Biên Hòa.
* **Các bệnh viện đa khoa tiếp nhận và cấp cứu** trên địa bàn tỉnh Đồng Nai (Bệnh viện Đa khoa Đồng Nai, Bệnh viện Đa khoa Thống Nhất...).

```
┌─────────────────┐        Quét QR tại chỗ       ┌────────────────────────┐
│   NGƯỜI HIẾN    │ ───────────────────────────> │  HỘI CHỮ THẬP ĐỎ       │
│  (Không cần     │ <─────────────────────────── │  TP. BIÊN HÒA          │
│   đăng nhập)    │     Auto-fill CCCD & STT     │  (Khám & Nhập kho FEFO)│
└─────────────────┘                              └───────────┬────────────┘
         ▲                                                   │
         │                Xe 115 vận chuyển                  │
         │            Quét QR nhận túi máu an toàn           ▼
         │                                       ┌────────────────────────┐
         └────────────────────────────────────── │       BỆNH VIỆN        │
              Đóng vòng lặp gửi SMS cảm ơn       │ (BV ĐK Đồng Nai,       │
                                                 │  BV ĐK Thống Nhất...)  │
                                                 └────────────────────────┘
```

---

## 2. BỐI CẢNH & MỤC TIÊU GIẢI PHÁP

### 2.1 Bất cập thực tế
* **Rào cản tải app/tạo tài khoản:** Người dân đến ngày hội hiến máu thường ngại tham gia nếu bắt buộc phải cài đặt ứng dụng hoặc trải qua các bước tạo tài khoản rườm rà.
* **Kê khai lặp lại thủ công:** Người đã từng hiến máu nhiều lần vẫn phải kê khai lại toàn bộ phiếu giấy viết tay, dẫn đến ùn tắc tại bàn tiếp nhận.
* **Mất dấu vết túi máu:** Thiếu cơ chế theo dõi xem túi máu sau khi lấy đã được chuyển đến bệnh viện nào, khiến người hiến không cảm nhận được giá trị đóng góp trực tiếp của mình.
* **Thiếu máu cấp cứu cục bộ:** Khi bệnh viện phát sinh ca mổ khẩn hoặc thiếu nhóm máu hiếm ($Rh-, Bombay...$), việc liên hệ xin máu từ Hội Chữ Thập Đỏ thường thực hiện qua điện thoại truyền thống, tốn nhiều thời gian quý báu.

### 2.2 Mục tiêu cốt lõi của SmartBlood
1. **Hiến máu 1 chạm (Zero-Login Check-in):** Quét mã QR sự kiện bằng điện thoại để mở form đăng ký ngay lập tức, không bắt buộc đăng nhập tài khoản.
2. **Tự động điền dữ liệu theo CCCD + ngày sinh (Auto-fill):** Nhập 12 số CCCD kèm ngày sinh (yếu tố xác minh thứ hai, vì CCCD không phải bí mật) để tra cứu hồ sơ cũ và tự động kiểm tra chu kỳ an toàn **84 ngày** theo **Thông tư 26/2013/TT-BYT**.
3. **Chuỗi cung ứng khép kín (Closed-Loop Tracking):** Mỗi túi máu xuất kho đều có mã QR tracking. Nhân viên y tế Bệnh viện quét mã QR trên túi máu để xác nhận đã nhận máu an toàn vào kho viện $\rightarrow$ Hệ thống tự động đóng vòng lặp gửi tin nhắn cảm ơn và thông báo cho người hiến.
4. **Cổng điều phối cấp cứu hỏa tốc (Báo động đỏ Socket.io):** Bệnh viện có thể theo dõi kho máu Hội Chữ Thập Đỏ và phát lệnh báo động đỏ điều phối xe 115 trong vòng dưới **1 giây**.
5. **Két bảo mật nhóm máu hiếm (Zero-Trust Rare Blood Vault):** Mã hóa thông tin người hiến máu hiếm bằng giải thuật **AES-256-GCM**, mở két qua cơ chế phê duyệt 2 lớp: người yêu cầu và người phê duyệt là hai tài khoản khác nhau, người phê duyệt tự nhập OTP trong phiên của mình.
6. **Kiểm soát chất lượng túi máu:** Túi máu mới lấy ở trạng thái **cách ly (`QUARANTINE`)**; chỉ khi có kết quả xét nghiệm sàng lọc chính thức đạt mới chuyển sang tồn kho khả dụng và được phép xuất đi bệnh viện.

---

## 3. MA TRẬN 5 TÁC NHÂN (ACTORS & ROLES)

| Tác nhân | Vai trò trong hệ thống | Quyền hạn dữ liệu cốt lõi |
| :--- | :--- | :--- |
| **`GUEST_DONOR`** | Người hiến máu vãng lai | Quét mã QR sự kiện, nhập CCCD + ngày sinh để auto-fill thông tin cũ hoặc nhập mới, đồng ý xử lý dữ liệu và khai báo sức khỏe, chọn thể tích dự kiến (250/350/450ml; bác sĩ xác nhận khi khám), nhận số thứ tự STT. Không cần đăng nhập. |
| **`REGISTERED_DONOR`** | Người hiến máu có tài khoản | Đăng ký/Đăng nhập bằng số CCCD, xem toàn bộ lịch sử các lần hiến máu thành công, tải Giấy chứng nhận điện tử (PDF kèm QR), theo dõi chu kỳ phục hồi 84 ngày. |
| **`RED_CROSS_STAFF`** | Nhân viên y tế Hội Chữ Thập Đỏ | Màn hình Bàn tiếp nhận theo dõi hàng đợi thời gian thực, duyệt khám sàng lọc lâm sàng sinh hiệu, nhập kết quả test nhanh mao mạch, lấy máu, in tem mã vạch và đưa túi vào kho cách ly; nhập kết quả xét nghiệm sàng lọc chính thức để duyệt túi vào tồn kho. |
| **`HOSPITAL_STAFF`** | Nhân viên y tế Bệnh viện | Quét mã QR trên túi máu xác nhận tiếp nhận vào kho viện, xem bảng tồn kho khả dụng của Hội Chữ Thập Đỏ (Read-only), phát lệnh cấp cứu máu nguy cấp (Báo động đỏ). |
| **`ADMIN`** | Quản trị viên Hội Chữ Thập Đỏ | Tạo sự kiện hiến máu, sinh mã QR của sự kiện, quản trị kho máu FEFO, điều phối xe 115, yêu cầu mở Két máu hiếm, quản lý tài khoản và xem nhật ký kiểm toán Audit Logs. Tài khoản `ADMIN` có cờ `laNguoiPheDuyet` (lãnh đạo) mới được phê duyệt yêu cầu mở két của người khác. |

---

## 4. TỔNG QUAN 6 MODULE CHỨC NĂNG CHÍNH

1. **Module 1 - Quản lý Sự kiện & Mã QR Động (`EventQRModule`):** Tạo đợt hiến máu, sinh mã QR động SVG/PNG chuẩn in Standee, giám sát tiến độ thực tế theo thời gian thực.
2. **Module 2 - Tiếp nhận Công khai không cần login (`PublicCheckInModule`):** Quét QR di động, tra cứu CCCD auto-fill thông tin, kiểm tra chu kỳ an toàn 84 ngày, cấp số thứ tự STT.
3. **Module 3 - Điều phối Tiến trình Y tế Bàn tiếp nhận (`MedicalWorkflowModule`):** Hàng đợi tiếp nhận 4 cột Kanban, Khám sàng lọc sinh hiệu, Xét nghiệm nhanh, Lấy máu & in tem mã vạch (túi vào kho cách ly).
4. **Module 4 - Quản lý Kho máu FEFO & Két Nhóm Máu Hiếm (`InventoryVaultModule`):** Duyệt túi máu cách ly sau xét nghiệm sàng lọc, quản lý hạn dùng túi máu theo FEFO (3 màu cảnh báo), Két bảo mật Zero-Trust Rare Blood Vault (AES-256-GCM), Nhật ký kiểm toán an ninh Audit Logs.
5. **Module 5 - Phân phối Bệnh viện & Cấp cứu khẩn 115 (`HospitalIntegrationModule`):** Bệnh viện xem tồn kho Hội CTĐ, phát lệnh cấp cứu hỏa tốc, Bệnh viện quét mã QR trên túi máu xác nhận nhập kho viện, tự động gửi SMS cảm ơn đến người hiến.
6. **Module 6 - Cổng Thông tin Người hiến & Lịch sử cá nhân (`DonorPortalModule`):** Đăng ký/Đăng nhập liên kết CCCD, tra cứu lịch sử hiến máu, tải Giấy chứng nhận điện tử (PDF kèm QR), quên mật khẩu qua Gmail OTP.

---

## 5. TỔNG QUAN HẠ TẦNG KỸ THUẬT & HIỆU NĂNG

* **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (Bảng chuẩn DataTable: Tất cả/50/20/10, Sắp xếp, Bộ lọc, Debounce search; Tông màu nhận diện Đỏ `#BA1C1D`, Cam `#F37021`, Xanh `#00558F`, Vàng `#EAB308`).
* **Backend:** Node.js + Express (TypeScript), dạng **Modular Monolith**: một ứng dụng, 6 module, mỗi module chia 3 lớp routes / service / repository, chạy một instance.
* **Database:** Microsoft SQL Server 2019 (15 bảng quan hệ, 100% thao tác ghi qua Stored Procedure có Transaction & `UPDLOCK, ROWLOCK, READPAST`).
* **Hạ tầng:** Nginx Reverse Proxy (SSL Termination, Gzip/Brotli, WebSocket), Cloudflare CDN (tùy chọn, cache tài nguyên tĩnh), Socket.io (WebSocket Real-time I/O), Docker Compose. Không dùng Redis: OTP và bộ đếm khóa lưu trong bộ nhớ ứng dụng (mất khi khởi động lại; cần Redis nếu sau này chạy nhiều instance).
* **Quy mô thiết kế (giả định):** ≤ ~2.000 lượt check-in/sự kiện, đỉnh ≤ 50 request/giây; API p95 < 300ms, báo động đỏ < 1 giây.

---

## 6. GIẢ ĐỊNH CẦN XÁC NHẬN TRƯỚC KHI TRIỂN KHAI

Các điểm dưới đây nằm ngoài tầm quyết định của đội phát triển, cần Hội CTĐ và đơn vị y tế liên quan xác nhận bằng văn bản:

1. **Quy trình xử lý máu thực tế:** Luồng trong tài liệu giả định Hội CTĐ giữ kho lạnh và xuất trực tiếp tới bệnh viện. Thực tế máu thường phải qua cơ sở truyền máu có thẩm quyền để xét nghiệm sàng lọc và điều chế. Hệ thống đã có trạng thái `QUARANTINE` và bước nhập kết quả sàng lọc chính thức; cần xác nhận ai thực hiện bước này và Hội CTĐ có được phép lưu kho/xuất máu hay không.
2. **Ngưỡng y tế:** Các giá trị (cân nặng, huyết áp tâm thu/tâm trương, nhịp tim, Hemoglobin, thể tích tối đa theo cân nặng và giới) trong tài liệu là **giá trị tạm**, đặt trong bảng cấu hình. Trưởng bộ phận y tế phải đối chiếu với Thông tư 26/2013/TT-BYT và văn bản sửa đổi còn hiệu lực trước khi dùng thật.
3. **Xe 115:** 115 là hệ thống bên ngoài. Hệ thống chỉ ghi nhận biển số, hotline tài xế do nhân viên nhập tay; **không có GPS/theo dõi lộ trình** trừ khi 115 cung cấp API.
4. **Thông báo cho người hiến:** Chưa chọn nhà cung cấp SMS/Zalo ZNS. Gmail SMTP chỉ dùng cho OTP khối lượng nhỏ.
5. **Pháp lý dữ liệu:** Theo NĐ 13/2023, nhóm máu và kết quả xét nghiệm là dữ liệu nhạy cảm. Cần chính sách thu thập đồng ý, thời hạn lưu giữ, và đánh giá việc truyền dữ liệu qua dịch vụ nước ngoài (Cloudflare) trước khi bật.
6. **Vận hành:** Cần kế hoạch sao lưu và khôi phục CSDL (có thử khôi phục), quy trình dự phòng (break-glass) khi Lãnh đạo không phản hồi yêu cầu mở két, và phiếu khai báo sức khỏe/hành vi nguy cơ do bộ phận y tế biên soạn.
