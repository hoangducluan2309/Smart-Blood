# BỘ QUY CHUẨN KỸ THUẬT & AI CODING SKILLS (SKILL.MD)
## DỰ ÁN: SMARTBLOOD - HỆ THỐNG ĐIỀU PHỐI HIẾN MÁU NHÂN ĐẠO & CHUỖI CUNG ỨNG Y TẾ
### ĐƠN VỊ CHỦ QUẢN: HỘI CHỮ THẬP ĐỎ TP. BIÊN HÒA

---

## 0. MỤC ĐÍCH & NGUYÊN TẮC ÁP DỤNG

Tài liệu này là chỉ dẫn kỹ thuật tối cao cho Lập trình viên và AI Vibe-Coder khi phân tích, viết mã nguồn, thiết kế cơ sở dữ liệu, sửa lỗi hoặc kiểm thử cho dự án **SmartBlood**.

### Thứ tự ưu tiên khi có mâu thuẫn:
1. Quy định pháp lý Y tế Việt Nam (**Thông tư 26/2013/TT-BYT** và văn bản sửa đổi còn hiệu lực).
2. Quy tắc an toàn dữ liệu cá nhân (**Nghị định 13/2023/NĐ-CP**) & mô hình **Zero-Trust** bảo vệ người hiến máu hiếm.
3. Các quy tắc bắt buộc (`MUST` và `MUST NOT`) trong tài liệu này.
4. Cấu trúc 3 lớp theo module (routes / service / repository), khả năng chịu tải và quy ước kỹ thuật đã phê duyệt.

---

## 1. NGUYÊN TẮC LÀM VIỆC CỦA AI VIBE-CODER

* `MUST` đọc kỹ đặc tả chức năng trong `Project-Content.md` và kiến trúc trong `Architechture.md` trước khi viết code. **`Architechture.md` là nguồn sự thật duy nhất về schema, tên bảng, tên cột và máy trạng thái.**
* `MUST` kiểm tra kỹ schema cơ sở dữ liệu và các Stored Procedure hiện có trước khi thêm API mới.
* `MUST` triển khai theo đúng 3 giai đoạn tuần tự:
  1. **Lệnh 1:** Database Schema DDL & Stored Procedure (MSSQL 2019).
  2. **Lệnh 2:** Backend API, kiểm tra dữ liệu đầu vào (zod), Service Logic (Node.js + Express).
  3. **Lệnh 3:** Frontend UI Component, Responsive & DataTable Standard (React 19).
* **Ngôn ngữ:** toàn bộ dự án (backend và frontend) viết bằng **100% TypeScript** (strict mode, ES Modules), không dùng file `.js`/`.jsx` cho mã nguồn ứng dụng. Backend là file `.ts`, Frontend là file `.tsx`/`.ts`.
* `MUST NOT` tự ý cài đặt thêm thư viện ngoài **danh mục Tech Stack đã khóa** dưới đây. Cần thư viện mới thì phải xin phê duyệt trước.
  * Backend: `express`, `mssql`, `socket.io`, `jsonwebtoken`, `bcrypt`, `nodemailer`, `qrcode`, `zod`, `express-rate-limit`, `helmet`, `cors`, `winston`, `dotenv`, `pdfkit` (sinh PDF); toolchain TypeScript: `typescript`, `tsx`, `@types/*`.
  * Frontend: `react`, `react-dom`, `vite`, `tailwindcss`, `lucide-react`, `socket.io-client`, `html5-qrcode` (quét QR); toolchain TypeScript: `typescript`, `@types/react`, `@types/react-dom`.
* `MUST NOT` bịa đặt API, sai lệch mã lỗi HTTP Status Code, hoặc đánh dấu hoàn thành khi chưa đối chiếu các tiêu chí Acceptance Criteria (AC).
* `MUST` đặt **mọi quy tắc y tế và an toàn trong Stored Procedure hoặc tầng Domain phía server** (luật 84 ngày, ngưỡng sinh hiệu, kiểm tra bệnh viện đích). Kiểm tra ở giao diện chỉ để hỗ trợ người dùng, không được coi là cơ chế bảo vệ.

---

## 2. QUY CHUẨN XỬ LÝ TẢI, CÂN BẰNG TẢI & REVERSE PROXY

Quy mô thiết kế: tối đa ~2.000 lượt check-in mỗi sự kiện, đỉnh ≤ 50 request/giây, **một instance** Node.js (xem `Architechture.md`). Mục tiêu: API thường p95 < 300ms, báo động đỏ < 1 giây.

* `MUST` **Cấu hình Reverse Proxy Nginx:**
  * Là Reverse Proxy phía trước ứng dụng Express; phục vụ luôn file tĩnh của frontend. Trong Express đặt `app.set('trust proxy', 1)`.
  * Bật nén `gzip` và `brotli` cho tệp tĩnh và JSON.
  * Chuyển tiếp Header: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.
  * Nếu dùng Cloudflare: bắt buộc `set_real_ip_from <dải IP Cloudflare>` và `real_ip_header CF-Connecting-IP;`, nếu không bộ giới hạn tốc độ sẽ thấy mọi người dùng cùng một IP.
  * Cấu hình WebSocket Upgrade headers cho Socket.io:
    ```nginx
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    ```
* `MUST` **Health check:** ứng dụng có endpoint `/api/health`; Docker Compose cấu hình `restart: always` và `healthcheck` để tự khởi động lại khi lỗi. Một instance nên chưa cần cân bằng tải.
* `MUST` **Rate Limiting (`express-rate-limit`, lưu trong bộ nhớ):**
  * **Không khóa theo IP đơn thuần**: nhiều người hiến cùng dùng một wifi hoặc CGNAT 4G sẽ chung một IP và bị chặn nhầm. Khóa theo tổ hợp phù hợp từng API:
    * Quét QR / mở trang check-in: **300 requests/phút/IP** (nới rộng cho điểm hiến đông người).
    * Tra cứu CCCD (`POST /public/checkin/lookup-cccd`): **tối đa 5 lần sai ngày sinh mỗi giờ cho mỗi CCCD** (đếm theo `cccd` trong bộ nhớ ứng dụng), cộng với **60 requests/phút/IP** để chống cào quét.
    * API Báo động đỏ cấp cứu: giới hạn riêng, **bypass bằng vai trò `HOSPITAL_STAFF` trong JWT đã xác thực**, không bypass theo địa chỉ IP (IP dễ bị giả mạo header).
* `MUST` **Connection Pooling tách đôi** (hai đối tượng `mssql.ConnectionPool`): pool `main` (`max: 40`) cho check-in và tác vụ thường; pool `priority` (`max: 10`) dành riêng cho xuất kho, nhận máu, cấp cứu. Cấu hình `idleTimeoutMillis: 30000`. Nhờ vậy cao điểm check-in không làm nghẽn luồng cấp cứu.

---

## 3. QUY CHUẨN KIẾN TRÚC ỨNG DỤNG (MODULAR MONOLITH)

* `MUST` **Một ứng dụng Express duy nhất**, chạy một instance. Không dựng tiến trình API Gateway riêng.
  * **Xác thực tập trung** bằng middleware `verifyJwt` + `requireRole(...)` đăng ký sẵn cho mọi route cần bảo vệ; CORS (`cors`), `helmet`, ghi log (`winston`) và error-handler cuối cùng trả `AppError` với đúng mã HTTP cấu hình chung cho toàn ứng dụng.
  * Tách rõ 6 module, mỗi module một thư mục gồm `routes.ts` / `service.ts` / `repository.ts` / `schemas.ts`: `event-qr`, `public-checkin`, `medical-workflow`, `inventory-vault`, `hospital`, `donor-portal`.
  * Kiểm tra dữ liệu đầu vào bằng `zod` ở mỗi route (suy diễn kiểu TS qua `z.infer<typeof ...>`); không tin dữ liệu từ client.
* `MUST` **Decoupling giữa các module:**
  * Module không truy vấn trực tiếp bảng của module khác; gọi hàm công khai trong `service.ts` của module đó, hoặc dùng `EventEmitter` của Node.js trong cùng tiến trình.
  * Độc lập hiệu năng đạt được nhờ **hai connection pool** (mục 2), không phải nhờ tách dịch vụ.

### 3.1 Clean Code & Code Style (TypeScript Strict & ES Modules)
* `MUST` **Cấu hình TypeScript nghiêm ngặt (`strict: true`):** bật `strict`, `noImplicitAny`, `strictNullChecks` trong `tsconfig.json`; **cấm dùng `any`** (dùng `unknown` + type narrowing hoặc kiểu suy diễn từ `zod` / interface rõ ràng).
* `MUST` **Định dạng mã thống nhất:** thụt lề **2 spaces**, độ dài dòng tối đa **100 ký tự**, dùng nháy đơn (`'...'`), luôn có dấu chấm phẩy (`;`), dùng dấu phẩy cuối dòng (trailing comma) ở cấu trúc nhiều dòng.
* `MUST` **Quy ước đặt tên trong mã TS/TSX:**
  * Biến và hàm: `camelCase` (`getDonorByCccd`, `isEligibleToDonate`). Dùng tên có nghĩa, tránh viết tắt tối nghĩa (`d`, `u`) và tránh magic numbers (khai báo hằng số `UPPER_SNAKE_CASE`, ví dụ `MIN_DONATION_INTERVAL_DAYS = 84`).
  * Class, Interface, Type & React Component: `PascalCase` (`AppError`, `BloodBagTable`, `DonorLookupResult`).
  * Hằng số & biến môi trường: `UPPER_SNAKE_CASE` (`OTP_TTL_SECONDS = 300`).
  * Tên file Backend: `kebab-case.ts` (`vault-crypto.ts`, `memory-store.ts`). Tên file React Component: `PascalCase.tsx` (`DonorCheckInForm.tsx`); hook/service Frontend: `kebab-case.ts` (`use-socket.ts`, `api-client.ts`).
* `MUST` **Nguyên tắc viết hàm sạch:**
  * Mỗi hàm chỉ làm **một việc** và ngắn gọn (< 30 dòng; dài hơn phải tách helper).
  * Tối đa **2 tham số**; từ 3 tham số trở lên dùng object destructuring (`createDispatch({ hospitalId, bloodType, units })`).
  * Không dùng flag parameter (`if (isEmergency)`) — tách thành hàm riêng rõ ràng.
  * Không mutate tham số đầu vào hay biến toàn cục; ưu tiên `map` / `filter` / `reduce` và trả về dữ liệu mới.
  * Dùng `async/await` nhất quán, **không** lồng chuỗi `.then().catch()`.
  * Thứ tự `import`: (1) Node built-ins (`node:crypto`) → (2) Thư viện ngoài (`express`, `zod`) → (3) Module nội bộ / `shared/`.
* `MUST NOT` để lại code bị comment (commented-out code), dead code hoặc `console.log`. Comment chỉ dùng để giải thích **TẠI SAO (WHY)** — đặc biệt với luật y tế (84 ngày, ngưỡng sinh hiệu) hoặc ghi chú `// shortcut:`.

### 3.2 Quy chuẩn Xử lý lỗi (`AppError`) & API Backend
* `MUST` dùng class `AppError(message, statusCode, code)` trong `shared/app-error.ts` cho mọi lỗi nghiệp vụ đã biết (`isOperational = true`). Không nuốt lỗi trong `catch` rỗng.
* `MUST` bọc mọi route bất đồng bộ bằng `asyncHandler` để đẩy lỗi về middleware `errorHandler` tập trung ở cuối `app.ts`.
* `MUST` kiểm tra mọi `req.body` / `req.params` bằng `schema.safeParse(...)` của `zod`; nếu lỗi ném `AppError('Dữ liệu không hợp lệ', 422, 'VALIDATION_ERROR')`.
* `MUST` trả về Response Envelope thống nhất với `Architechture.md` mục 2.4 (`{ success: true, data, pagination? }` hoặc `{ success: false, error: { code, message, details? } }`).
* `MUST NOT` trả stack trace hay thông báo lỗi SQL gốc ra client khi xảy ra lỗi hệ thống (`isOperational = false`); chỉ log chi tiết ở server bằng `winston` (tuyệt đối không log CCCD, mật khẩu, JWT, OTP).

---

## 4. QUY CHUẨN CACHING & BỘ NHỚ TẠM

```
[Người dùng di động] ──(Tier 1: Storage trình duyệt)──> [Trình duyệt điện thoại]
        │
        ▼
[Mạng truyền dẫn]    ──(Tier 2: CDN Edge, tùy chọn)──> [Cloudflare CDN Cache]
        │
        ▼
[Máy chủ Backend]    ──(Tier 3: Bộ nhớ app)  ──> [Map có TTL: OTP, bộ đếm]
        │
        ▼
[Cơ sở dữ liệu]      ──────────────────────────> [Microsoft SQL Server 2019]
```

### 1. Tier 1: Client Caching
* `MUST` Lưu bản nháp form đăng ký hiến máu bằng `sessionStorage` (hoặc `localStorage` kèm TTL 24 giờ) để không mất dữ liệu khi sóng 4G chập chờn. **Bản nháp không được chứa số CCCD**, nhóm máu hiếm hay mật khẩu; chỉ lưu các trường không định danh (ví dụ lượng máu dự kiến, địa chỉ nhập dở). Xóa bản nháp ngay khi gửi thành công.
* `MUST` Lưu Access Token trong Memory hoặc Secure/HttpOnly Cookie.
* `MUST NOT` lưu số CCCD, nhóm máu hiếm hoặc mật khẩu ở `localStorage`/`sessionStorage`. (Mã hóa phía client với khóa nằm trong cùng trình duyệt không có tác dụng bảo vệ.) Điện thoại hoặc máy tính bảng dùng chung tại điểm hiến là rủi ro có thật.
* `MUST` Gửi đăng ký (`submit`) kèm `clientRequestId` (UUID sinh một lần cho mỗi form) để việc gửi lại khi mạng chập chờn không tạo trùng lượt check-in.

### 2. Tier 2: Edge Network Caching (CDN - Cloudflare, tùy chọn)
* `MUST` Cache static assets (JS bundles, CSS, logo, icons).
* `MUST` Cache ảnh SVG/PNG của **mã QR sự kiện** với `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`.
* `MUST NOT` cache response API có dữ liệu cá nhân.

### 3. Tier 3: Bộ nhớ trong ứng dụng (Map có TTL, không dùng Redis)
* `MUST` **Lưu OTP và bộ đếm Brute-force** trong một module dùng chung (`shared/memory-store.ts`) với thời hạn tự hết: OTP 6 số TTL = 300 giây; bộ đếm khóa tạm TTL theo chính sách mục 8; bộ đếm sai ngày sinh theo CCCD TTL 1 giờ.
* `MUST` ghi chú rõ giới hạn trong mã: `// shortcut: bộ nhớ trong tiến trình, mất khi khởi động lại và chỉ chạy được 1 instance; khi cần nhiều instance thì chuyển sang Redis`.
* `MUST NOT` cache tồn kho và danh sách sự kiện ở bước đầu: truy vấn SQL (view/index) đủ nhanh ở quy mô này. Chỉ thêm cache nếu đo được chậm.
* `MUST NOT` dùng khóa phân tán (Redlock). Chống xuất trùng túi máu do `UPDLOCK, ROWLOCK, READPAST` trong SQL Server đảm nhận (chỉ có một CSDL).

---

## 5. QUY CHUẨN CƠ SỞ DỮ LIỆU & STORED PROCEDURE (DATABASE RULES)

Hệ thống dùng **Microsoft SQL Server 2019**, gọi trực tiếp Stored Procedure bằng thư viện `mssql` trong Express (không dùng ORM):

* `MUST` **Sử dụng Stored Procedure cho 100% thao tác ghi dữ liệu** (`INSERT`, `UPDATE`, `DELETE`) và các tác vụ nghiệp vụ quan trọng (nhập kho, chuyển bước khám, mở két máu hiếm, quét nhận túi máu).
* `MUST` **Bọc Transaction và `TRY...CATCH`**:
  * Mọi thủ tục tác động từ 2 bảng trở lên nằm trong `BEGIN TRANSACTION ... COMMIT TRANSACTION`.
  * Bắt đầu SP bằng `SET XACT_ABORT ON`. Trong `CATCH`: `IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;` rồi `THROW;`.
* `MUST` **Cơ chế khóa chống tranh chấp:**
  * Chọn túi máu xuất kho FEFO: `WITH (UPDLOCK, ROWLOCK, READPAST)` để hai ca cấp cứu đồng thời nhận hai bộ túi khác nhau, không phải chờ nhau và không xuất trùng.
  * Check-in: cấp STT bằng một lệnh cập nhật bộ đếm một dòng (`UPDATE ... OUTPUT`) hoặc khóa dòng sự kiện trong thời gian ngắn nhất có thể.
* `MUST` **Luật nghiệp vụ nằm trong SP** (xem mục 1): `sp_SubmitDonorCheckIn` tự kiểm tra lại 84 ngày, sự kiện đang mở đúng khung giờ, và tính duy nhất `(eventId, donorId)`; `sp_HospitalReceiveBloodBag` tự lấy bệnh viện từ `Users.hospitalId`.
* `MUST` **Thời gian:** lưu `DATETIME2` UTC (`SYSUTCDATETIME()`), quy đổi sang UTC+7 khi so sánh theo ngày. Không dùng `GETDATE()` (phụ thuộc múi giờ máy chủ, container Docker mặc định UTC).
* `MUST` **Chuỗi Unicode:** cột văn bản tiếng Việt dùng `NVARCHAR`; literal tiếng Việt trong SP có tiền tố `N'...'`.
* `MUST` **Không xóa vật lý (No Hard-Delete)** với hồ sơ người hiến, lịch sử hiến, túi máu và lệnh cấp cứu; dùng cờ trạng thái.
* `MUST` **`AuditLogs` bất biến:** tài khoản ứng dụng chỉ có quyền `INSERT` trên bảng này, và có chuỗi `hash` nối bản ghi trước/sau để phát hiện sửa/xóa.
* `MUST NOT` ghép chuỗi thô vào câu lệnh SQL. 100% truy vấn dùng tham số.
* `MUST NOT` đưa dữ liệu cá nhân (CCCD, SĐT) vào URL hoặc query string, vì chúng sẽ bị ghi vào log của Nginx/Cloudflare. API có dữ liệu cá nhân dùng `POST` với body.
* `MUST NOT` viết truy vấn `SELECT *` hoặc gọi truy vấn DB trong vòng lặp (N+1 query). Chỉ `SELECT` đúng các cột cần dùng và gộp bằng `JOIN` hoặc Stored Procedure trả về nhiều tập kết quả.

---

## 6. QUY CHUẨN BẢNG DỮ LIỆU QUẢN TRỊ (DATATABLE STANDARD)

Áp dụng cho **TẤT CẢ** các bảng danh sách phía Frontend (sự kiện, Bàn tiếp nhận y tế, Kho máu FEFO, lịch sử cấp cứu 115, quản lý tài khoản):

* `MUST` **Phân trang 4 mức:** `10`, `20`, `50` dòng/trang và `Tất cả (All)`.
* `MUST` **Sắp xếp cột:** click tiêu đề các cột quan trọng (Ngày tổ chức, Hạn dùng túi máu, Thời gian cấp cứu, Mức độ khẩn) để đảo `ASC` ↔ `DESC`.
* `MUST` **Bộ lọc đa tiêu chí:** Trạng thái; 8 Nhóm máu (`A+`, `A-`, `B+`, `B-`, `O+`, `O-`, `AB+`, `AB-`); Bệnh viện tiếp nhận.
* `MUST` **Tìm kiếm có Debounce tối thiểu 300ms** theo Họ tên, Số CCCD, Mã vạch túi máu.

---

## 7. QUY CHUẨN THIẾT KẾ GIAO DIỆN & BRAND GUIDELINES (UI/UX)

* **Bộ mã màu nhận diện y tế:**
  * 🔴 **Đỏ nhân đạo (`#BA1C1D`):** Header chính, nút Cấp cứu khẩn cấp, biểu tượng Giọt máu, trạng thái Thiếu máu nghiêm trọng.
  * 🟠 **Cam nhiệt huyết (`#F37021`):** Nút hành động chính (CTA), thanh tiến độ sự kiện.
  * 🔵 **Xanh hy vọng & tin cậy (`#00558F`):** Navbar, liên kết Bệnh viện, thẻ trạng thái An toàn / Đủ điều kiện.
  * 🟡 **Vàng cảnh báo (`#EAB308`):** Huy hiệu Cận hạn dùng (FEFO), người hiến đang trong chu kỳ phục hồi (< 84 ngày).
* **Quy tắc tương phản (WCAG AA, tối thiểu 4.5:1 cho chữ thường):**
  * Chữ trắng trên Đỏ `#BA1C1D` và Xanh `#00558F`: đạt.
  * Chữ trắng trên Cam `#F37021` (~2.9:1) và Vàng `#EAB308` (~1.9:1): **không đạt**. Dùng chữ tối (`#0F172A`) trên nền cam/vàng.
  * Trạng thái đỏ/vàng/xanh (tồn kho, hạn dùng) luôn kèm biểu tượng hoặc nhãn chữ, không chỉ dựa vào màu.
* **Quy tắc cấm kỵ:**
  * ❌ **KHÔNG dùng màu đen thuần `#000000`:** thay bằng Slate-900 (`#0F172A`), Slate-800 (`#1E293B`) hoặc Neutral-800 (`#262626`).
  * ❌ **CẤM các đường cong lượn sóng kiểu AI generic:** bố cục thẻ (Card), bảng lưới dứt khoát, bo góc vừa phải (`rounded-lg` hoặc `rounded-xl`).
  * ❌ **KHÔNG dùng logo Lạc Hồng:** chỉ dùng logo SmartBlood hoặc biểu trưng Chữ Thập Đỏ trên nền trắng.

### 7.1 Trạng thái UI, Form UX, Accessibility (WCAG 2.1 AA) & Microcopy Y tế
* `MUST` **Đủ 3 trạng thái cho mọi màn hình tải dữ liệu:**
  1. **Loading:** dùng Skeleton (`animate-pulse`) đúng bố cục card/bảng, tránh spinner trống toàn trang.
  2. **Empty State:** theo công thức *Trạng thái + Giải thích ngắn + Nút hành động* (ví dụ: *"Chưa có lượt check-in nào — Chia sẻ mã QR sự kiện để người hiến bắt đầu đăng ký"*).
  3. **Error State:** thông báo lỗi dễ hiểu kèm nút **"Thử lại"**.
* `MUST` **Quy chuẩn Form UX:**
  * Nhãn (`<label>`) luôn đặt **trên** ô nhập (không thay nhãn bằng `placeholder`); `placeholder` chỉ ghi giá trị mẫu (ví dụ: `0901234567`).
  * Kiểm tra hợp lệ khi `onBlur` hoặc `onSubmit`; thông báo lỗi chỉ rõ cách sửa (ví dụ: *"CCCD phải gồm đúng 12 chữ số"*).
  * Khóa nút gửi và hiện trạng thái đang xử lý khi submit (kết hợp `clientRequestId` để chống tạo trùng khi bấm đúp trên mạng yếu).
* `MUST` **Accessibility (WCAG 2.1 AA):**
  * Mọi phần tử tương tác có focus ring rõ ràng (`focus-visible:outline-2 focus-visible:outline-[#00558F]`), cỡ chữ nội dung tối thiểu `16px` (`text-base`).
  * Popup Báo động đỏ và Modal mở két phải giữ focus bên trong (focus trap) và khôi phục focus khi đóng; nút chỉ có icon phải có `aria-label`; thông báo lỗi dùng `role="alert"`.
* `MUST` **Microcopy tiếng Việt rõ ràng, đồng cảm:**
  * Nút hành động theo mẫu `[Động từ] + [Đối tượng]` (ví dụ: *"Xác nhận hiến máu"*, *"Phát báo động đỏ"*, *"Mở két máu hiếm"* — không dùng *"Gửi"*, *"OK"*).
  * Toast thông báo: Thành công tự đóng sau `3s`; Cảnh báo sau `5s`; **Lỗi và Báo động đỏ giữ nguyên** cho tới khi người dùng đóng hoặc bấm xác nhận.

---

## 8. QUY CHUẨN BẢO MẬT & ZERO-TRUST RARE BLOOD VAULT

1. **Bảo vệ người hiến Nhóm Máu Hiếm (Rh-, Bombay...):**
   * `soDienThoai` và `diaChi` của người hiến máu hiếm **chỉ tồn tại dạng mã hóa** trong `RareBloodVault` bằng **AES-256-GCM**; bảng `Donors` giữ `NULL` cho hai trường này.
   * **Mỗi trường mã hóa có IV (12 byte, ngẫu nhiên) và authTag riêng.** Tuyệt đối không dùng lại IV với cùng một khóa. Khóa nạp từ secret store, kèm `keyVersion` để đổi khóa.
   * Giao diện thường che mặt nạ: `0908***123`.
   * **Mở két 2 lớp (Dual-Custody):** người yêu cầu (`ADMIN`) gửi yêu cầu kèm mã bệnh án; người phê duyệt là một **tài khoản khác** có `laNguoiPheDuyet = 1`, tự nhập OTP trong phiên đăng nhập của mình (OTP TTL 5 phút, tối đa 3 lần thử). OTP không được chuyển cho người yêu cầu.
   * Sau khi duyệt, quyền xem có hiệu lực **15 phút** tại phía máy chủ (`expiresAt`): mỗi lần xem máy chủ giải mã theo yêu cầu, hết hạn trả `403`. Mọi bước (yêu cầu, duyệt, từ chối, xem) ghi vào `AuditLogs`.
2. **Định danh bằng CCCD không đủ để chứng minh danh tính.** CCCD không phải bí mật. Do đó:
   * Tra cứu auto-fill phải kèm **ngày sinh** làm yếu tố xác minh thứ hai. Nếu CCCD không có hồ sơ hoặc ngày sinh không khớp, trả về cùng một phản hồi "người hiến mới" để không lộ việc CCCD đã có hồ sơ; không trả bất kỳ dữ liệu cá nhân nào trước khi xác minh.
   * Đăng ký tài khoản phải xác minh **email bằng OTP** và khớp ngày sinh với hồ sơ trước khi liên kết lịch sử hiến máu.
   * API công khai `submit` **không được ghi đè** họ tên, ngày sinh, nhóm máu của hồ sơ đã có; chỉ cập nhật SĐT/địa chỉ khi đã xác minh ngày sinh. Việc sửa các trường định danh do nhân viên thực hiện tại bàn tiếp nhận.
3. **Bảo vệ Brute-force Đăng nhập:**
   * Sai 5 lần liên tiếp: khóa tạm **3 phút** (đồng hồ đếm ngược), đếm trong bộ nhớ ứng dụng (khởi động lại thì bộ đếm được reset, chấp nhận ở quy mô này).
   * Tiếp tục sai: thời gian khóa tăng dần (15 phút, rồi 1 giờ) và gửi cảnh báo email cho chủ tài khoản; yêu cầu captcha hoặc đặt lại mật khẩu bằng OTP.
   * **Không tự động khóa vĩnh viễn** (kẻ xấu có thể cố ý khóa tài khoản người khác, kể cả tài khoản bệnh viện đang cấp cứu). Chuyển `trangThai = 'LOCKED'` chỉ do Admin thực hiện thủ công khi phát hiện tấn công.
4. **Quên mật khẩu an toàn:**
   * Gửi OTP 6 số qua email (`nodemailer`); hiệu lực **300 giây**; cooldown gửi lại **60 giây**; tối đa 5 lần thử sai.
   * Gmail SMTP chỉ phù hợp với khối lượng nhỏ (OTP đăng nhập, phê duyệt két). Gửi hàng loạt (thông báo cảm ơn) và SMS cần nhà cung cấp riêng (chưa chốt, xem `Overview.md` mục 6).
5. **Dữ liệu cá nhân (NĐ 13/2023):** thu thập đồng ý xử lý dữ liệu ngay trên form check-in (`daDongYXuLyDuLieu`), có chính sách lưu giữ dữ liệu, và việc truyền dữ liệu qua dịch vụ nước ngoài (ví dụ proxy Cloudflare) phải được đánh giá trước khi bật.

---

## 9. QUY CHUẨN REAL-TIME & ĐIỀU PHỐI CẤP CỨU (SOCKET.IO)

* **Mọi kết nối socket phải xác thực ở bước handshake** (JWT nhân viên, hoặc token theo `checkInId` cho người hiến). Dữ liệu cá nhân chỉ gửi vào kênh nhân viên. TV công cộng chỉ nhận STT và bước, không có họ tên hay lý do y tế.
* Các sự kiện bắt buộc phát (chi tiết namespace và xác thực xem `Architechture.md` mục 8):
  1. `donor:checkin_submitted`: người hiến đăng ký → Bàn tiếp nhận thêm vào hàng đợi.
  2. `medical:step_updated`: nhân viên chuyển bước → hàng đợi và điện thoại người hiến cập nhật (người hiến chỉ thấy tên bước).
  3. `emergency:red_alert`: Bệnh viện phát lệnh `NGUY_CAP` → màn hình trực Hội CTĐ hú còi và hiện popup.
  4. `hospital:bag_received`: Bệnh viện quét nhận túi → cập nhật tồn kho và kích hoạt thông báo cảm ơn.
* **Báo động đỏ phải có xác nhận và dự phòng:** màn hình trực có nút "Bật âm thanh báo động" đầu ca (trình duyệt chặn âm thanh tự phát); nhân viên bấm xác nhận đã nhận; nếu quá 2 phút chưa xác nhận thì gửi thêm SMS/email cho người trực.

---

## 10. QUY CHUẨN KIỂM THỬ (TESTING STANDARDS)

* **Tháp kiểm thử 3 tầng (`tests/`):**
  1. **Unit (`tests/unit/`):** kiểm thử hàm nghiệp vụ trong `service.ts`, mã hóa `vault-crypto.ts` (AES-256-GCM + IV duy nhất), TTL trong `memory-store.ts`. Sử dụng `node --test` tích hợp sẵn của Node.js (chạy qua `tsx --test` hoặc trên bản build `tsc`, không cần cài thêm framework test ngoài danh mục khóa).
  2. **Integration (`tests/integration/`):** kiểm thử API Express + `zod` + Stored Procedure trên DB kiểm thử (kiểm tra đủ `200/201`, `401`, `403`, `409`, `422`).
  3. **E2E (`tests/e2e/`):** kiểm thử luồng chính từ đầu đến cuối (Quét QR check-in → Khám/Xét nghiệm → Lấy máu → Xuất kho FEFO → Bệnh viện quét nhận; và luồng Báo động đỏ 115).
* `MUST` mỗi tính năng mới phải có đủ 4 nhóm test case: **Happy Path**, **Edge Cases** (giáp ranh 84 ngày, thiếu tồn kho, mạng gửi lại cùng `clientRequestId`), **Error Cases** (`401/403/409/422`), và **Security Cases** (IDOR truy cập dữ liệu bệnh viện khác, SQL injection, mở két bằng cùng một tài khoản).
* `MUST` mọi lỗi đã sửa (bug fix) phải kèm **regression test** để không tái diễn.
* **Quy ước đặt tên:** file `[ten-module].test.ts`; `describe` trùng tên module/hàm; `it` theo mẫu `'should [hành vi mong đợi] when [điều kiện]'`.

---

## 11. QUY TRÌNH GIT, SỬA LỖI & CODE REVIEW

### 11.1 Git Workflow & Conventional Commits
* **Nhánh:** `main` (production, không commit trực tiếp) ← `develop` (tích hợp) ← `feature/<ten>`, `fix/<ten>`, `hotfix/<ten>`.
* **Định dạng Commit:** `<type>(<scope>): <mô tả ngắn>`
  * `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.
  * Ví dụ: `feat(vault): enforce dual-custody OTP expiry check`, `fix(dispatch): add READPAST hint in sp_DispatchBloodBagsFEFO`.
* `MUST NOT` commit tệp `.env`, khóa bí mật, `node_modules/`, `logs/`.

### 11.2 Quy trình Sửa lỗi 6 bước (Fix Issue Workflow)
1. **Hiểu & tái hiện lỗi:** đọc thông báo lỗi, xác định module/SP liên quan, tái hiện ở môi trường dev.
2. **Phân tích nguyên nhân gốc (RCA):** kiểm tra `git log --oneline -20`, đọc kỹ `service.ts` và Stored Procedure liên quan.
3. **Lên kế hoạch tối thiểu:** xác định thay đổi gọn nhất, đánh giá ảnh hưởng tới máy trạng thái hoặc module khác.
4. **Triển khai sửa:** tuân thủ Clean Code (mục 3.1), `AppError` (mục 3.2) và quy chuẩn SP (mục 5).
5. **Kiểm chứng:** viết regression test, chạy test liên quan và kiểm tra lại các Acceptance Criteria.
6. **Commit chuẩn:** theo Conventional Commits kèm mã issue/task.

### 11.3 Checklist Code Review
Mọi thay đổi trước khi merge phải được rà soát và phân loại góp ý theo 4 mức (`🔴 Critical` bắt buộc sửa, `🟡 Warning` nên sửa, `🟢 Suggestion` đề xuất, `✅ Good` điểm tốt):
* **Chất lượng mã:** đúng style 2 spaces / camelCase / hàm < 30 dòng, không lặp logic, không dead code.
* **CSDL & Tải:** ghi qua SP có `SET XACT_ABORT ON` + transaction, xuất kho có `UPDLOCK, ROWLOCK, READPAST`, đúng pool (`main` vs `priority`), không N+1.
* **Bảo mật & Lỗi:** validate `zod`, `verifyJwt` + `requireRole`, không lộ PII/secret trong log hoặc URL, xử lý lỗi bằng `AppError`.

---

## 12. DANH SÁCH KIỂM TRA BẢO MẬT (SECURITY AUDIT CHECKLIST)

Thực hiện trước mỗi đợt nghiệm thu hoặc triển khai production:
* **🔴 Mức Nghiêm trọng (Kiểm tra đầu tiên):**
  * [ ] Không có secret, mật khẩu, `VAULT_KEY_V*`, `JWT_SECRET` bị hardcode trong `backend/` hoặc `frontend/`.
  * [ ] Không có tệp `.env` từng bị commit trong lịch sử git (`git log --all --full-history -- .env`).
  * [ ] 100% thao tác SQL dùng tham số / Stored Procedure, không ghép chuỗi; không có `eval()` hoặc `new Function()` với input người dùng.
  * [ ] `RareBloodVault`: `soDienThoai`/`diaChi` trong bảng `Donors` luôn `NULL` với người nhóm máu hiếm; mỗi trường có IV 12-byte ngẫu nhiên và `authTag` riêng; `requesterId <> approverId`.
* **🟡 Mức Cao:**
  * [ ] Mọi route bảo vệ đều gắn `verifyJwt` và `requireRole(...)`; bệnh viện lấy từ `Users.hospitalId`, không tin giá trị client gửi.
  * [ ] Rate limiting cấu hình đúng (check-in 300 req/phút/IP, tra cứu CCCD 5 lần sai/giờ/CCCD + 60 req/phút/IP, báo động đỏ chỉ bypass bằng JWT `HOSPITAL_STAFF`).
  * [ ] Không có `cccd`, `soDienThoai`, `ngaySinh` trong URL/query string hoặc trong log `winston`.
* **🟢 Mức Trung bình:**
  * [ ] Đã bật `helmet()`, cấu hình `cors` theo whitelist `ALLOWED_ORIGINS`, đặt `app.set('trust proxy', 1)` khi đứng sau Nginx/Cloudflare.
  * [ ] Kiểm tra lỗ hổng thư viện định kỳ bằng `npm audit --audit-level=moderate`.
  * [ ] `errorHandler` không trả stack trace ở môi trường `production`.

---

## 13. TIÊU CHÍ NGHIỆM THU HOÀN THÀNH (DEFINITION OF DONE - DOD)

Một chức năng chỉ được coi là hoàn thành khi:
1. Có Stored Procedure chuẩn thực thi không lỗi trong SQL Server 2019 (tuân thủ `SET XACT_ABORT ON`, transaction, khóa chống tranh chấp).
2. API Express tuân thủ Clean Code (mục 3.1), kiểm tra đầu vào bằng `zod` đầy đủ, xử lý lỗi `AppError` trả đúng Response Envelope và mã HTTP (`200, 201, 400, 401, 403, 404, 409, 422, 429`).
3. Tuân thủ caching đa tầng và giới hạn tải theo mục 2 và 4.
4. Giao diện React 19 hiển thị mượt mà trên cả Mobile (người hiến quét QR) và Desktop (Bàn y tế), có đủ 3 trạng thái Loading/Empty/Error, đạt tương phản WCAG AA và microcopy chuẩn.
5. Đạt 100% các tiêu chí Acceptance Criteria (Happy Case & Error Case) trong `Project-Content.md` và có test kiểm chứng (bao gồm regression test nếu sửa lỗi).
6. Qua danh sách kiểm tra bảo mật mục 12: không có dữ liệu cá nhân trong URL hoặc log `winston`, mọi quy tắc y tế kiểm tra ở server, mọi socket xác thực handshake, bệnh viện lấy từ tài khoản đăng nhập.
