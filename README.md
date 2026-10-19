# 🩸 Smart-Blood — Nền Tảng Hiến Máu Thông Minh

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

> Nền tảng kết nối người hiến máu, bệnh viện và ngân hàng máu theo thời gian thực nhằm tối ưu hóa quy trình điều phối, giảm thiểu tình trạng thiếu hụt máu khẩn cấp và nâng cao trải nghiệm của tình nguyện viên.

---

## 📌 Tổng Quan (Overview)

**Smart-Blood** được thiết kế để giải quyết bài toán mất cân đối cung – cầu trong tiếp nhận và lưu trữ máu. Bằng việc số hóa quy trình quản lý, ứng dụng giúp:
- Tự động cảnh báo và điều phối khi lượng nhóm máu dự trữ chạm ngưỡng nguy hiểm.
- Rút ngắn thời gian tiếp nhận thông tin người bệnh cần cấp cứu.
- Quản lý lịch sử hiến máu minh bạch, an toàn và bảo mật cho người dùng.

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 1. Dành cho Người hiến máu (Donors)
* **Đặt lịch hiến máu linh hoạt:** Đăng ký khung giờ và địa điểm tiếp nhận trực tuyến.
* **Hồ sơ sức khỏe số:** Theo dõi lịch sử hiến máu, lượng thể tích máu đã hiến và chứng nhận hiến máu điện tử.
* **Nhắc nhở chu kỳ:** Tự động thông báo khi đủ điều kiện hiến máu lần tiếp theo (sau 84 ngày).
* **SOS Alert:** Nhận thông báo đẩy (push notifications) khi có ca cấp cứu cùng nhóm máu ở khu vực lân cận.

### 2. Dành cho Cơ sở y tế / Bệnh viện (Hospitals & Blood Banks)
* **Quản lý kho máu thông minh:** Theo dõi số lượng đơn vị máu theo nhóm (A, B, AB, O, Rh+, Rh-) theo thời gian thực.
* **Cảnh báo hạn dùng:** Quản lý vòng đời chế phẩm máu (hồng cầu, tiểu cầu, huyết tương).
* **Phát tín hiệu khẩn cấp (SOS):** Tạo yêu cầu huy động máu khẩn theo khu vực địa lý.
* **Quản lý điểm hiến máu lưu động:** Lên kế hoạch và điều phối chiến dịch hiến máu tình nguyện.

### 3. Dành cho Quản trị viên (Admin)
* Thống kê, báo cáo trực quan lưu lượng máu tiếp nhận và xuất kho.
* Phê duyệt, xác thực thông tin cơ sở y tế và tình nguyện viên.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

* **Frontend:** React / React Native (hoặc Flutter / Next.js)
* **Backend:** Node.js (NestJS/Express) hoặc Spring Boot / ASP.NET Core
* **Database:** PostgreSQL / MongoDB, Redis (Caching & Job Queue)
* **Cloud & DevOps:** Docker, Firebase Cloud Messaging (FCM), AWS / GCP
* **Bản đồ & Định vị:** Mapbox API / Google Maps API

---

## 📂 Cấu Trúc Thư Mục (Project Structure)

```text
smart-blood/
├── backend/                # Source code backend / REST API
│   ├── src/
│   │   ├── modules/        # Blood inventory, Donor, SOS, Hospital
│   │   ├── config/         # Cấu hình database, environment
│   │   └── main.ts
│   └── Dockerfile
├── frontend/               # Web client hoặc Mobile app
│   ├── src/
│   │   ├── components/     # UI Components dùng chung
│   │   ├── pages/          # Trang giao diện
│   │   └── services/       # API integration
│   └── package.json
├── docs/                   # Tài liệu thiết kế hệ thống, sơ đồ DB
├── docker-compose.yml       # Thiết lập môi trường Docker
├── .env.example
└── README.md
