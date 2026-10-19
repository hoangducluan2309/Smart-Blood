HỆ THỐNG SMART-BLOOD — TÀI LIỆU ĐẶC TẢ KIẾN TRÚC & USER STORIES CHUẨN

Phiên bản: 2.0 (Clean Architecture & Stored Procedure Standard)
Quy chuẩn tuân thủ: yeucau.md, Architechture.md, .skill/skill.md
Mục tiêu: Nền tảng số hóa toàn trình chuỗi tiếp nhận, lưu trữ kho FEFO, điều phối cấp cứu thời gian thực và dự báo chuỗi thời gian nhu cầu máu.

MỤC LỤC
Khung Kỹ Thuật & Các Quy Tắc Bắt Buộc (MUST / MUST NOT)
Sơ Đồ Kiến Trúc Hệ Thống (Clean Architecture)
Đặc Tả Chi Tiết 11 User Stories & Acceptance Criteria (AC)
3.1 Phân hệ Người hiến máu (Donor) — US-D01 đến US-D04
3.2 Phân hệ Bác sĩ / Bệnh viện (Hospital) — US-H01 đến US-H04
3.3 Phân hệ Quản trị viên (Admin) — US-A01 đến US-A03
Bảng Ánh Xạ User Story ➔ API Endpoint ➔ Stored Procedure
Kế Hoạch Triển Khai 6 Giai Đoạn Trước Khi Code
1. KHUNG KỸ THUẬT & CÁC QUY TẮC BẮT BUỘC (MUST / MUST NOT)
1.1 Tech Stack Chuẩn Hóa
Thành phần	Công nghệ chỉ định	Ghi chú & Ràng buộc
Backend Framework	NestJS 10+	Kiến trúc Clean Architecture, Module hóa độc lập
Database	Microsoft SQL Server 2014	Kết nối qua TypeORM; tương thích T-SQL MSSQL 2014
Data Access Layer	100% Stored Procedures	Tuyệt đối không dùng Dynamic SQL; Bắt buộc có TRY...CATCH
Frontend Framework	React 19 + TypeScript (Vite 8)	Strict Type Safety, React Router v7
Styling & UI Kit	Tailwind CSS v4 + Lucide React	Giao diện chuẩn y tế, Responsive toàn diện
Bản đồ & GIS	Leaflet & React-Leaflet	Tọa độ GPS Geolocation, tính cự ly Haversine
Real-time Gateway	Socket.io	WebSocket 2 chiều phát tín hiệu SOS khẩn cấp
Bảo mật & Phiên	JWT + RBAC + bcryptjs	3 vai trò: ADMIN, HOSPITAL_STAFF, DONOR
1.2 Các Quy Tắc Bắt Buộc Tuyệt Đối

IMPORTANT

QUY TẮC DỮ LIỆU & STORED PROCEDURE (THEO ARCHITECHTURE.MD & SKILL.MD):

MUST 100% Thao tác dữ liệu qua Stored Procedure: Mọi hành vi Đọc / Ghi / Sửa / Xóa dữ liệu bắt buộc phải thông qua Stored Procedure trong MSSQL. Không viết raw query trong code backend.
MUST Sử dụng TRY...CATCH trong mọi Stored Procedure: Bắt buộc có khối BEGIN TRY ... END TRY BEGIN CATCH ... END CATCH để bắt lỗi và rollback an toàn.
MUST Transaction trong tác vụ đa thao tác: Các nghiệp vụ cập nhật nhiều bảng (nhập túi máu, đặt lịch, xuất kho FEFO) bắt buộc phải sử dụng Transaction (BEGIN TRAN / COMMIT TRAN / ROLLBACK TRAN).

WARNING

QUY TẮC BẢNG QUẢN TRỊ DANH SÁCH (TABLE LIST - SKILL.MD DÒNG 109): Trên tất cả các màn hình danh sách (Table) trong hệ thống, BẮT BUỘC phải có đầy đủ 4 tính năng:

Phân trang (Paging): Hỗ trợ đầy đủ các tùy chọn kích thước trang: Tất cả, 50, 20, 10.
Sắp xếp (Sorting): Cho phép sắp xếp tăng/giảm theo các cột dữ liệu chính.
Bộ lọc (Filter): Lọc theo trạng thái, nhóm máu, thời gian, vai trò.
Tìm kiếm (Search): Ô tìm kiếm từ khóa thời gian thực (Debounced Search).

CAUTION

QUY TẮC BẢO MẬT & LOGIC NGHIỆP VỤ:

MUST NOT đưa business rules chỉ vào UI. Toàn bộ logic (quy tắc 84 ngày, thuật toán FEFO, hạn dùng túi máu, ma trận nhóm máu) phải được kiểm soát ở Backend và Stored Procedure.
MUST kiểm tra quyền (RBAC) trên Server Guard cho mọi Request; không tin role hay dữ liệu gửi từ client.
MUST NOT tự ý đổi ngôn ngữ, framework, hệ quản trị database ngoài danh sách đã duyệt.
2. SƠ ĐỒ KIẾN TRÚC HỆ THỐNG (CLEAN ARCHITECTURE)
3. ĐẶC TẢ CHI TIẾT 11 USER STORIES & ACCEPTANCE CRITERIA (AC)
3.1 Phân hệ Người hiến máu (Donor)
US-D01: Đăng ký tài khoản và cập nhật hồ sơ y tế ban đầu
User Story:

As a Người tình nguyện hiến máu,
I want to đăng ký tài khoản qua React 19 Form, chọn nhóm máu (hoặc "Chưa biết" nếu hiến lần đầu) và khai báo tiền sử bệnh,
So that hệ thống lưu trữ hồ sơ định danh chính xác, hỗ trợ sàng lọc y tế và kết nối cấp cứu khi cần.

AC 01 (Happy Case - Đăng ký hợp lệ & Cấp tọa độ GPS):
Given: Người dùng đang ở màn hình Đăng ký;
When: Nhập họ tên, email hợp lệ, mật khẩu 
≥
8
≥8 ký tự, chọn nhóm máu (ví dụ: O, Rh- hoặc UNKNOWN), tích cam kết tiền sử bệnh an toàn và cho phép trình duyệt truy cập Geolocation;
Then: React Hook Form + Zod validate hợp lệ, Axios gửi POST /api/auth/register, Backend gọi Stored Procedure sp_Auth_RegisterUser, mật khẩu được hash bằng bcryptjs, lưu vào MSSQL, hiển thị React Hot Toast thành công và chuyển sang màn hình chính.
AC 02 (Error Case - Tiền sử bệnh chống chỉ định):
Given: Người dùng đang ở form đăng ký;
When: Tích chọn có tiền sử các bệnh lây nhiễm nguy hiểm (HIV, Viêm gan B/C mãn tính);
Then: Zod schema chặn submit ngay tại client, hiển thị thông báo qua React Hot Toast: "Hồ sơ y tế của bạn thuộc diện tạm hoãn hiến máu theo quy định Bộ Y Tế" và không gửi request lên backend.
US-D02: Tra cứu chiến dịch và đặt lịch hẹn hiến máu trước
User Story:

As a Donor đã có tài khoản,
I want to xem danh sách các đợt hiến máu/bệnh viện tiếp nhận trên bản đồ React-Leaflet và đặt trước khung giờ hẹn,
So that tôi chủ động thời gian hiến máu và bệnh viện dự trù được số lượng người đến tiếp nhận.

AC 01 (Happy Case - Đặt lịch hẹn thành công):
Given: Donor đã đăng nhập và đạt khoảng cách giãn cách an toàn (
≥
84
≥84 ngày);
When: Chọn điểm hiến máu trên bản đồ React-Leaflet, chọn khung giờ còn trống (ví dụ: 08:00 - 09:30) và bấm "Xác nhận đặt lịch";
Then: Axios gửi POST /api/appointments, Backend thực thi Stored Procedure sp_Appointment_Create trong Transaction, lưu bản ghi vào bảng Appointments với trạng thái CONFIRMED, hiển thị Toast thành công và chuyển sang màn hình "Phiếu hẹn điện tử".
AC 02 (Error Case - Khung giờ tiếp nhận đã hết chỗ):
Given: Khung giờ tiếp nhận đã đạt chỉ tiêu tối đa (hết slot khả dụng);
When: Donor bấm nút chọn khung giờ đó;
Then: Giao diện vô hiệu hóa nút (disabled), hiển thị cảnh báo: "Khung giờ này đã đủ số lượng người đăng ký, vui lòng chọn khung giờ khác" và không cho gửi request.
US-D03: Xuất trình mã QR cá nhân động (Dynamic QR) làm thủ tục check-in
User Story:

As a Donor đã đến điểm tiếp nhận hiến máu,
I want to xuất trình mã QR định danh động trên màn hình ứng dụng,
So that nhân viên y tế quét nhanh chóng mà không cần khai báo giấy tờ thủ công.

AC 01 (Happy Case - Sinh mã QR Token bảo mật có thời hạn):
Given: Donor đã đăng nhập (AuthContext lưu trữ JWT token hợp lệ);
When: Mở mục "Thẻ QR Check-in";
Then: Hệ thống tạo chuỗi JSON Web Signature ngắn hạn (TTL 10 phút chống chụp màn hình gian lận) chứa donor_id, timestamp và render ra mã QR SVG động cùng đồng hồ đếm ngược hiệu lực.
AC 02 (Exception Case - Thiết bị mất mạng Internet):
Given: Điện thoại Donor bị mất kết nối Internet tại khu vực tiếp đón;
When: Mở ứng dụng;
Then: Ứng dụng tự động lấy QR Token đã được cache trong LocalStorage hiển thị lên màn hình kèm React Hot Toast màu vàng: "Đang hiển thị thẻ QR ở chế độ ngoại tuyến".
US-D04: Nhận và phản hồi cảnh báo khẩn cấp thời gian thực (SOS Alert)
User Story:

As a Donor đang bật trạng thái "Sẵn sàng hiến máu",
I want to nhận thông báo khẩn cấp qua Socket.io khi có ca cấp cứu tương thích nhóm máu ở bán kính gần và bấm phản hồi,
So that bác sĩ trực biết được tôi đang di chuyển tới viện để kịp thời cấp cứu.

AC 01 (Happy Case - Đồng ý cứu người & Mở bản đồ chỉ đường):
Given: Donor có nhóm máu tương thích y khoa đang ở bán kính 
≤
15
km
≤15km quanh bệnh viện phát SOS;
When: Socket.io Client nhận sự kiện NEW_EMERGENCY_ALERT;
Then: Ứng dụng reo chuông báo động, hiển thị Emergency Modal với thông tin: Tên viện, nhóm máu cần, khoảng cách; khi Donor bấm "Tôi đang đến", Axios gửi POST /api/sos/respond (status = 'COMING'), kích hoạt tuyến đường chỉ dẫn bản đồ React-Leaflet tới bệnh viện.
AC 02 (Exception Case - Ca SOS đã kết thúc do nhận đủ người):
Given: Donor nhận thông báo nhưng ca SOS đã được bác sĩ đóng do đã đủ người đến;
When: Donor bấm "Tôi đang đến" nhưng Backend trả về mã SOS_CLOSED;
Then: Hệ thống lập tức đóng Modal, hiển thị React Hot Toast: "Ca cấp cứu đã nhận đủ người hỗ trợ, chân thành cảm ơn tinh thần của bạn!".
3.2 Phân hệ Bác sĩ / Bệnh viện (Hospital / Staff)
US-H01: Quét mã QR kiểm tra điều kiện giãn cách an toàn y tế
User Story:

As a Nhân viên y tế tại bàn tiếp nhận,
I want to dùng Web Camera quét mã QR check-in của Donor,
So that hệ thống tự động kiểm tra số lần hiến và đảm bảo khoảng cách an toàn (
≥
84
≥84 ngày với máu toàn phần, 
≥
14
≥14 ngày với tiểu cầu) dưới 3 giây.

AC 01 (Happy Case - Đủ điều kiện y tế tiếp nhận):
Given: Web Camera quét được chuỗi QR token hợp lệ;
When: Axios gửi POST /api/hospital/verify-qr, Backend giải mã token và thực thi Stored Procedure sp_Hospital_VerifyQRCheckIn, tính khoảng cách ngày hiến gần nhất 
≥
84
≥84 ngày (hoặc hiến lần đầu);
Then: Backend trả về HTTP 200 OK, giao diện chuyển khung viền Xanh chuẩn y tế, hiển thị họ tên, nhóm máu, số lần hiến và mở khóa nút "Chấp thuận tiếp nhận".
AC 02 (Error Case - Vi phạm quy định giãn cách):
Given: Donor mới hiến máu toàn phần cách đây 45 ngày;
When: Nhân viên y tế quét mã QR;
Then: Stored Procedure trả về mã lỗi, Backend phản hồi HTTP 400 Bad Request kèm { eligible: false, errorCode: "UNDER_84_DAYS", daysPassed: 45, remainingDays: 39 }, giao diện chuyển khung Đỏ và hiển thị React Hot Toast: "KHÔNG ĐỦ ĐIỀU KIỆN: Khoảng cách lần hiến gần nhất mới được 45/84 ngày".
US-H02: Nhập dữ liệu túi máu sau hiến, phân loại chế phẩm và cách ly chờ xét nghiệm
User Story:

As a Nhân viên tiếp nhận / xét nghiệm,
I want to quét mã Barcode túi máu, chọn thể tích (250ml, 350ml, 450ml) và loại chế phẩm máu,
So that túi máu được lưu vào hệ thống với hạn sử dụng FEFO chính xác theo từng loại chế phẩm và tự động cộng dồn lịch sử cho Donor.

AC 01 (Happy Case - Nhập túi máu thành công & Phân loại hạn dùng):
Given: Donor vừa hoàn thành lấy máu;
When: Nhân viên nhập mã Barcode túi máu, thể tích 350ml, chọn loại chế phẩm RED_CELLS (Khối hồng cầu) và bấm "Lưu túi máu";
Then: Backend gọi Stored Procedure sp_Inventory_InsertBloodBag thực thi trong Transaction: lưu vào bảng BloodBags với trạng thái QUARANTINE (chờ xét nghiệm an toàn), tính expiry_date (+42 ngày cho Hồng cầu, hoặc +5 ngày nếu là Tiểu cầu), đồng thời cộng 1 lần hiến vào hồ sơ Donor và hiển thị Toast thành công.
AC 02 (Error Case - Trùng lặp mã Barcode):
Given: Nhân viên quét nhầm mã Barcode đã tồn tại trong CSDL MSSQL;
When: Bấm "Lưu túi máu";
Then: Khối CATCH trong Stored Procedure bắt lỗi vi phạm Unique Constraint, trả về HTTP 409 Conflict, hiển thị React Hot Toast cảnh báo: "Mã vạch túi máu đã tồn tại trên hệ thống, vui lòng kiểm tra lại tem nhãn".
US-H03: Kích hoạt và quản lý vòng đời lệnh phát tín hiệu gọi máu khẩn cấp (SOS Alert)
User Story:

As a Bác sĩ trực cấp cứu,
I want to chọn nhóm máu thiếu hụt, số đơn vị cần và điều chỉnh bán kính tìm kiếm trên bản đồ Leaflet để phát lệnh SOS,
So that tín hiệu được đẩy tức thì qua Socket.io đến các Donor tương thích gần nhất và theo dõi số người đang đến.

AC 01 (Happy Case - Phát tín hiệu SOS và theo dõi thời gian thực):
Given: Bệnh viện thiếu nhóm máu O-, bác sĩ chọn O-, số lượng 2 đơn vị, kéo Slider bán kính 15km trên React-Leaflet;
When: Bấm nút "PHÁT LỆNH SOS";
Then: Backend thực thi sp_SOS_CreateAlertAndMatchDonors (lọc Donor theo công thức Haversine và ma trận tương thích), Socket.io phát sự kiện NEW_EMERGENCY_ALERT trong 
<
3
<3 giây; giao diện bác sĩ cập nhật realtime số người nhận tin và số người bấm "Tôi đang đến".
AC 02 (Exception Case - Đóng lệnh SOS khi đã huy động đủ máu):
Given: Bệnh viện đã tiếp nhận đủ 2 người đến viện làm thủ tục cấp cứu;
When: Bác sĩ bấm nút "KẾT THÚC LỆNH SOS";
Then: Backend thực thi sp_SOS_CloseAlert đổi trạng thái thành CLOSED, Socket.io phát sự kiện hủy tới các Donor còn lại và hiển thị Toast thông báo hoàn tất ca cấp cứu.
US-H04: Xuất kho túi máu cấp cứu theo chuẩn FEFO và khóa dòng chống âm kho
User Story:

As a Bác sĩ / Quản lý kho máu bệnh viện,
I want to tạo lệnh xuất kho máu bằng cách chỉ định nhóm máu và số đơn vị cần dùng cho ca mổ,
So that hệ thống tự động ưu tiên xuất các túi máu có hạn dùng gần nhất (FEFO) và áp dụng cơ chế khóa dòng giao dịch để ngăn chặn triệt để tình trạng âm kho.

AC 01 (Happy Case - Xuất kho FEFO thành công với Khóa dòng):
Given: Kho máu có sẵn các túi máu nhóm A+ đã qua kiểm định an toàn (status = 'AVAILABLE', is_tested_safe = 1);
When: Bác sĩ nhập yêu cầu xuất 2 túi A+ và bấm "Xác nhận xuất kho";
Then: Backend thực thi Stored Procedure sp_Inventory_DispatchFEFO trong Transaction với gợi ý khóa dòng WITH (UPDLOCK, ROWLOCK), tự động lấy các túi có ORDER BY expiry_date ASC (chuẩn FEFO), cập nhật trạng thái DISPATCHED, commit transaction và hiển thị danh sách Barcode túi máu được chỉ định xuất kho.
AC 02 (Error Case - Không đủ tồn kho khả dụng hoặc tranh chấp đồng thời):
Given: Kho chỉ còn 1 túi A+ khả dụng nhưng yêu cầu xuất 2 túi (hoặc túi máu đó vừa bị ca cấp cứu khác giữ khóa);
When: Nhấn "Xác nhận xuất kho";
Then: Transaction trong Stored Procedure tự động Rollback, Backend trả về HTTP 400 Bad Request kèm mã lỗi INSUFFICIENT_STOCK, hiển thị React Hot Toast cảnh báo Đỏ: "Không đủ lượng máu khả dụng theo chuẩn FEFO để xuất kho".
3.3 Phân hệ Quản trị viên (Admin)
US-A01: Quản lý người dùng, kiểm duyệt bệnh viện và phân quyền RBAC 3 cấp
User Story:

As a Quản trị viên hệ thống,
I want to quản lý danh sách tài khoản qua bảng dữ liệu chuẩn hóa, phê duyệt tư cách pháp nhân cơ sở y tế và phân quyền chặt chẽ 3 vai trò,
So that đảm bảo an toàn dữ liệu y tế và chỉ người có thẩm quyền mới được thao tác kho máu.

AC 01 (Happy Case - Quản lý bảng chuẩn hóa & Phê duyệt bệnh viện):
Given: Admin mở bảng điều khiển người dùng (có đầy đủ: Phân trang Tất cả/50/20/10, Sắp xếp, Bộ lọc vai trò, Ô tìm kiếm);
When: Lọc danh sách bệnh viện chờ duyệt, đổi vai trò tài khoản sang HOSPITAL_STAFF và nhấn "Phê duyệt";
Then: Backend gọi sp_Admin_UpdateUserRole, Sequelize/TypeORM cập nhật MSSQL, NestJS RolesGuard lập tức cấp quyền truy cập các route y tế cho tài khoản này.
AC 02 (Error Case - Chặn truy cập trái phép bằng Server Guard):
Given: Người dùng có vai trò DONOR cố tình gửi request can thiệp API cấu hình /api/admin/system-settings;
When: Request đi qua RolesGuard(['ADMIN']);
Then: Guard chặn lại ở tầng server, trả về HTTP 403 Forbidden kèm thông báo: "Truy cập bị từ chối: Bạn không có quyền thực hiện thao tác này".
US-A02: Cấu hình danh mục y tế, ma trận tương thích và ngưỡng an toàn tồn kho (Min-Max)
User Story:

As a Quản trị viên y tế,
I want to cấu hình ma trận tương thích nhóm máu, thời gian giãn cách theo từng loại chế phẩm và thiết lập ngưỡng tồn kho an toàn (Mức Đỏ - Vàng - Xanh),
So that hệ thống tự động gắn cờ cảnh báo nguy cơ thiếu hụt trên toàn hệ sinh thái bệnh viện.

AC 01 (Happy Case - Thiết lập ngưỡng cảnh báo kho thành công):
Given: Admin đang ở màn hình Cấu hình ngưỡng kho máu;
When: Chọn nhóm máu O-, đặt ngưỡng nguy cấp (Mức Đỏ) là 
<
10
<10 túi, ngưỡng cảnh báo (Mức Vàng) là từ 
10
−
30
10−30 túi, trên 30 túi là An toàn (Mức Xanh) và nhấn "Lưu cấu hình";
Then: Axios gửi PUT /api/admin/thresholds, Stored Procedure sp_Admin_UpdateThresholds cập nhật bảng InventorySettings, trả về HTTP 200 OK và Dashboard lập tức áp dụng thang màu mới theo thời gian thực.
AC 02 (Error Case - Dải giá trị ngưỡng logic không hợp lệ):
Given: Admin nhập cấu hình ngưỡng kho máu;
When: Nhập giá trị ngưỡng Mức Đỏ lớn hơn hoặc bằng ngưỡng Mức Vàng;
Then: Zod validation tại client chặn submit, hiển thị React Hot Toast lỗi: "Ngưỡng nguy cấp (Đỏ) phải nhỏ hơn ngưỡng cảnh báo (Vàng)" và không gửi request lên backend.
US-A03: Phân tích chuỗi thời gian và dự báo nguy cơ thiếu máu 7–30 ngày
User Story:

As a Quản trị viên y tế,
I want to xem biểu đồ trực quan dự báo xu hướng tiêu thụ và nguy cơ cạn kiệt từng nhóm máu trong 7–30 ngày tới dựa trên mô hình chuỗi thời gian,
So that tôi có thể chủ động lập kế hoạch phê duyệt các đợt hiến máu lưu động đón đầu nguy cơ.

AC 01 (Happy Case - Trực quan hóa dữ liệu dự báo chuỗi thời gian):
Given: CSDL MSSQL có dữ liệu lịch sử xuất/nhập máu 
≥
6
≥6 tháng;
When: Admin truy cập trang "Dự báo nguy cơ thiếu máu";
Then: Service gọi Stored Procedure sp_Analytics_GetConsumptionTimeSeries, thực thi thuật toán Moving Average kết hợp hệ số mùa vụ, trả về mảng dữ liệu dự báo 30 ngày, giao diện vẽ biểu đồ trực quan và tự động gắn cờ cảnh báo Đỏ ở những tuần có nguy cơ cạn kho.
AC 02 (Exception Case - Chưa đủ dữ liệu lịch sử để chạy mô hình):
Given: Dữ liệu lịch sử xuất nhập trong CSDL 
<
30
<30 ngày;
When: Admin mở trang dự báo;
Then: Hệ thống hiển thị thông báo: "Dữ liệu lịch sử chưa đủ để chạy mô hình chuỗi thời gian chính xác, đang hiển thị mức tiêu thụ trung bình ngày" và chuyển sang biểu đồ ước tính giản đơn.
4. BẢNG ÁNH XẠ USER STORY ➔ API ENDPOINT ➔ STORED PROCEDURE
Mã US	Phân hệ	API Endpoint	Phương thức	Stored Procedure T-SQL tương ứng
US-D01	Donor	/api/auth/register	POST	sp_Auth_RegisterUser
US-D02	Donor	/api/appointments	POST	sp_Appointment_Create
US-D03	Donor	/api/donor/qr-token	GET	sp_Donor_GetQRTokenData
US-D04	Donor	/api/sos/respond	POST	sp_SOS_RecordResponse
US-H01	Hospital	/api/hospital/verify-qr	POST	sp_Hospital_VerifyQRCheckIn
US-H02	Hospital	/api/inventory/bags	POST	sp_Inventory_InsertBloodBag
US-H03	Hospital	/api/sos/broadcast, /close	POST	sp_SOS_CreateAlertAndMatchDonors, sp_SOS_CloseAlert
US-H04	Hospital	/api/inventory/dispatch-fefo	POST	sp_Inventory_DispatchFEFO (Có Transaction & UPDLOCK)
US-A01	Admin	/api/admin/users/:id/role	PUT	sp_Admin_UpdateUserRole, sp_Admin_GetUsersWithPaging
US-A02	Admin	/api/admin/thresholds	PUT	sp_Admin_UpdateThresholds
US-A03	Admin	/api/analytics/forecast	GET	sp_Analytics_GetConsumptionTimeSeries
5. KẾ HOẠCH TRIỂN KHAI 6 GIAI ĐOẠN TRƯỚC KHI CODE
Giai đoạn 1: Khởi tạo Khung Dự án (Project Scaffolding)
 Thiết lập thư mục cấu trúc Monorepo: /backend (NestJS Clean Architecture), /frontend (React 19, Tailwind CSS v4, Vite 8).
 Cấu hình biến môi trường .env, kết nối TypeORM tới Microsoft SQL Server 2014.
 Thiết lập thư viện dùng chung: Zod, Axios, Lucide React, Socket.io, React-Leaflet.
Giai đoạn 2: Thiết kế Database & Viết 100% Stored Procedures
 Tạo các bảng dữ liệu chuẩn hóa, khóa chính, khóa ngoại và Non-Clustered Indexes tối ưu truy vấn trên blood_type, expiry_date, status.
 Viết toàn bộ 12 Stored Procedures (T-SQL) có đầy đủ khối BEGIN TRY ... END TRY BEGIN CATCH ... END CATCH.
 Tích hợp Transaction (BEGIN TRAN / COMMIT / ROLLBACK) và cơ chế khóa bi quan WITH (UPDLOCK, ROWLOCK) trong thủ tục sp_Inventory_DispatchFEFO để chống âm kho triệt để.
Giai đoạn 3: Phát triển Backend NestJS (Clean Architecture)
 Triển khai tầng Data Access: Repositories gọi Stored Procedures thông qua EntityManager.query("EXEC sp_...").
 Triển khai tầng Application/Service: Xử lý logic FEFO, kiểm tra 84 ngày, công thức Haversine, dự báo Moving Average.
 Triển khai tầng Presentation: Controllers, DTO Validation (Zod/class-validator), JwtAuthGuard và RolesGuard (RBAC).
Giai đoạn 4: Phát triển Frontend React 19 & Tailwind CSS v4
 Xây dựng Component DataTable dùng chung bắt buộc có đủ: Phân trang (Tất cả, 50, 20, 10), Sắp xếp, Bộ lọc, Tìm kiếm.
 Hoàn thiện 4 màn hình Donor (Đăng ký, Đặt lịch Leaflet, Thẻ Dynamic QR, Modal SOS).
 Hoàn thiện 4 màn hình Bác sĩ (Web Scanner camera, Nhập túi máu Barcode, Quản lý kho FEFO, Bản đồ phát lệnh SOS).
 Hoàn thiện màn hình Admin (Bảng quản trị người dùng, Cấu hình ngưỡng cảnh báo, Biểu đồ chuỗi thời gian).
Giai đoạn 5: Tích hợp Real-time & Web Hardware
 Kết nối Socket.io Gateway giữa NestJS và React 19 cho sự kiện NEW_EMERGENCY_ALERT và bộ đếm realtime người đang đến.
 Tích hợp Web Camera Scanner qua thư viện HTML5-QRCode hoặc ZXing để nhận diện mã check-in.
 Kiểm thử chế độ hiển thị QR ngoại tuyến (Offline LocalStorage Cache).
Giai đoạn 6: Kiểm thử (Testing) & Nghiệm thu
 Chạy kiểm thử Unit Test cho các Service nghiệp vụ.
 Kiểm thử tải & kiểm thử xung đột giao dịch (Race Condition Test) khi 2 yêu cầu cùng tranh chấp túi máu cuối cùng.
 Rà soát toàn bộ các bảng danh sách theo tiêu chuẩn checklist của skill.md (Paging All/50/20/10, Filter, Sort, Search).
 Xuất tài liệu OpenAPI/Swagger UI tại endpoint /api-docs.