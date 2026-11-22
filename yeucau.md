HỒ SƠ THIẾT KẾ HỆ THỐNG: SMARTBLOOD
Nền tảng Quản lý, Điều phối Hiến máu Nhân đạo và Dự báo Nhu cầu Máu Khẩn cấp
________________________________________
BƯỚC 1: ĐỊNH HÌNH Ý TƯỞNG & ĐÁNH GIÁ TÍNH KHẢ THI
1. Chuẩn hóa ý tưởng thành 4 thành tố cốt lõi
•	1. Mô tả ý tưởng:
Xây dựng nền tảng Web App thông minh số hóa toàn trình chuỗi nghiệp vụ hiến máu: từ tiếp nhận đăng ký trực tuyến, check-in bằng mã QR định danh cá nhân để kiểm tra lịch sử và giãn cách y tế tức thì, ghi nhận số ml máu vào kho lưu trữ theo hạn dùng FEFO (First-Expired, First-Out) theo mã vạch túi máu, đến cơ chế kết nối thời gian thực (Real-time SOS Alert) gọi máu khẩn cấp cho các ca cấp cứu giờ vàng (đặc biệt là nhóm máu hiếm Rh-, AB-), đồng thời ứng dụng mô hình phân tích chuỗi thời gian (Time-series Analysis) để dự báo nguy cơ thiếu hụt máu trong 7–30 ngày tới.
•	2. Mục tiêu chung:
Chấm dứt việc quản lý thủ công bằng giấy tờ gây quá tải bàn đón tiếp; xóa bỏ độ trễ trong khâu kêu gọi máu khẩn cấp qua mạng xã hội; tối ưu hóa tồn kho ngân hàng máu và đảm bảo an toàn truyền máu theo chuẩn y tế, đóng góp vào Mục tiêu Phát triển Bền vững SDG 3 (Sức khỏe và Cuộc sống Tốt).
•	3. Mục tiêu chi tiết: 
o	Cung cấp cổng số hóa cho Donor đăng ký đợt hiến, cấp phiếu hẹn và thẻ mã QR cá nhân.
o	Tích hợp công cụ quét QR trên giao diện Web của Bệnh viện: tra cứu số lần hiến và kiểm tra quy tắc an toàn giãn cách tối thiểu ≥84\ge 84≥84 ngày (12 tuần) dưới 3 giây/lượt.
o	Xây dựng module quản lý kho máu thông minh: xuất - nhập - tồn theo mã Barcode, quản trị xuất kho an toàn theo cơ chế FEFO (túi nào có hạn sử dụng gần nhất sẽ được ưu tiên xuất trước) và hiển thị Dashboard tồn kho 3 mức (Xanh - Vàng - Đỏ).
o	Xây dựng thuật toán Matching thông minh (ma trận tương thích nhóm máu y khoa, cự ly GPS gần nhất) kết hợp Socket.io để phát tín hiệu khẩn cấp trong vài giây.
o	Xây dựng mô hình chuỗi thời gian dự báo nguy cơ thiếu máu theo từng nhóm trong 7–30 ngày.
•	4. Kết quả mong đợi (Định lượng): 
o	Tốc độ check-in tại bàn tiếp đón: <3< 3<3 giây/người (giảm 80% thời gian chờ đợi).
o	Thời gian phát tín hiệu SOS đến thiết bị Donor mục tiêu: <5< 5<5 giây.
o	Độ chính xác lọc danh sách người hiến nhóm máu hiếm theo bán kính địa lý: ≥95%\ge 95\%≥95%.
o	Tỷ lệ sai sót hạn sử dụng và âm kho: 0%0\%0% nhờ cơ chế kiểm soát mã vạch, khóa dòng dữ liệu và xuất kho FEFO.
2. Đánh giá tính khả thi (Tam giác thẩm định)
•	Khả thi kỹ thuật (Technical Feasibility): 
o	Frontend Stack: 
	Core & Ngôn ngữ: React 19 kết hợp TypeScript (hiệu năng cao, strict typing, an toàn dữ liệu).
	Build Tool: Vite 8 (tốc độ khởi động máy chủ ảo và hot-reload cực nhanh).
	Giao diện (UI): Tailwind CSS v4 + bộ icon Lucide React (thiết kế tinh gọn, chuẩn giao diện y tế).
	Bản đồ số (GIS): Leaflet & React-Leaflet + GPS Geolocation (định vị bệnh viện, vẽ bán kính quét và đo khoảng cách km thực tế).
	Định tuyến (Routing): React Router v7 (điều hướng linh hoạt và bảo vệ tuyến đường theo quyền RBAC).
	Giao tiếp API & Real-time: Axios (kèm Interceptor tự động gắn JWT Bearer Token) + Socket.io Client (nhận cảnh báo cấp cứu tức thì).
	Quản lý trạng thái & Thông báo: React Context API (AuthContext, EmergencyContext) + React Hot Toast.
o	Backend Stack: 
	Nền tảng & Ngôn ngữ: Node.js (ESM) + TypeScript (Strict Type Safety), chạy môi trường phát triển qua tsx (Hot-Reload).
	Framework & Kiến trúc: Express.js 5 xây dựng Clean Architechture giúp tách biệt logic nghiệp vụ.
	Cơ sở dữ liệu & ORM: Microsoft SQL Server (MSSQL) quản trị qua Sequelize ORM (hỗ trợ đầy đủ ACID Transaction và cơ chế khóa dòng chống âm kho/xung đột khi xuất túi máu).
	Bảo mật: JWT (JSON Web Token) kết hợp phân quyền RBAC 3 cấp (Admin, Bác sĩ/Nhân viên, Người hiến), mã hóa mật khẩu một chiều bằng bcryptjs, bọc bảo vệ hệ thống bằng Helmet & cấu hình CORS nghiêm ngặt.
	Tài liệu hóa & Kiểm thử: Tích hợp tài liệu OpenAPI 3.0.3 / Swagger UI (tại endpoint /api-docs), sẵn sàng Postman Collection tự động (T01–T09) và bộ Unit Tests đạt tiêu chuẩn 100% PASS.
•	Khả thi thời gian (Schedule Feasibility): 
o	Lộ trình 10 tuần (28/09/2026 – 06/12/2026) chia thành các giai đoạn bám sát mô hình 3 lớp Backend và từng component Frontend. Sử dụng Vite 8 và tsx giúp tối đa hóa tốc độ phát triển và sửa lỗi.
•	Khả thi nguồn lực (Resource Feasibility): 
o	Đội ngũ 2 sinh viên (Long: Backend 3 lớp, MSSQL/Sequelize, Socket.io; Luân: Frontend React 19, Tailwind v4, React-Leaflet).
o	Microsoft SQL Server phiên bản Developer/Express miễn phí; các thư viện NPM hoàn toàn mã nguồn mở. Chi phí bản quyền: 0 VNĐ.
________________________________________
BƯỚC 2: XÁC ĐỊNH TÁC NHÂN (ACTOR) VÀ HÀNH VI (BEHAVIOR)
Hệ thống phân định rõ 3 Primary Actors và 2 Secondary System Actors:
STT	Tác nhân (Actor)	Phân loại	Hành vi chính (Key Behaviors)
1	Người hiến máu (Donor)	Primary Actor	- Đăng ký tài khoản, khai báo nhóm máu (ABO, Rh), tiền sử bệnh, chia sẻ vị trí GPS.
- Đăng ký tham gia đợt hiến máu, nhận phiếu hẹn điện tử.
- Xuất trình mã QR cá nhân trên React 19 Web App tại bàn tiếp đón.
- Bật/tắt trạng thái "Sẵn sàng hiến máu khẩn cấp".
- Nhận cảnh báo SOS thời gian thực qua Socket.io và bấm phản hồi ("Tôi đang đến").
- Xem lịch sử số lần/thể tích máu đã hiến, tải Giấy chứng nhận điện tử.
2	Bác sĩ / Nhân viên y tế (Hospital / Staff)	Primary Actor	- Tạo lập và quản lý các đợt hiến máu (thời gian, địa điểm, chỉ tiêu thể tích máu).
- Dùng Web Camera quét mã QR của Donor để tra cứu lịch sử và kiểm tra thời gian giãn cách 84 ngày.
- Nhập dữ liệu sau hiến (thể tích 250/350/450ml, mã vạch Barcode, loại chế phẩm).
- Tra cứu bộ lọc danh sách người hiến nhóm máu hiếm (Rh-, AB-) theo bán kính km trên bản đồ Leaflet.
- Kích hoạt lệnh phát cảnh báo khẩn cấp (SOS Alert) thời gian thực qua Socket.io.
- Quản lý xuất - nhập - tồn kho máu theo cơ chế FEFO (ưu tiên xuất túi máu có hạn dùng gần nhất).
3	Quản trị viên hệ thống (Admin)	Primary Actor	- Quản lý tài khoản người dùng, phân quyền RBAC 3 cấp (Admin, Bác sĩ/Nhân viên, Người hiến).
- Kiểm duyệt tính pháp lý của tài khoản bệnh viện trước khi cấp quyền truy cập.
- Cấu hình ma trận tương thích nhóm máu y khoa, danh mục chế phẩm, tham số an toàn (84 ngày).
- Giám sát toàn bộ các chiến dịch và luồng điều phối máu khẩn cấp.
- Xem Dashboard phân tích chuỗi thời gian dự báo nguy cơ thiếu máu 7–30 ngày.
- Giám sát Audit Logs bảo đảm an toàn dữ liệu y tế; tra cứu tài liệu Swagger UI /api-docs.
4	Bản đồ số & GPS (Leaflet & Geolocation Service)	Secondary System Actor	- Cung cấp lớp bản đồ số tương tác qua React-Leaflet.
- Nhận tọa độ GPS thực tế của Donor và Bệnh viện, tính toán cự ly bán kính phục vụ thuật toán lọc người hiến lân cận.
5	Hệ thống Kết nối Real-time (Socket.io Gateway)	Secondary System Actor	- Duy trì WebSocket hai chiều liên tục giữa Express.js 5 Backend và React 19 Frontend.
- Đẩy gói tin cảnh báo cấp cứu tức thì tới đúng thiết bị người hiến trong bán kính chỉ định.
________________________________________
BƯỚC 3: ĐẶC TẢ YÊU CẦU – USER STORIES & ACCEPTANCE CRITERIA (AC)
Tuân thủ nghiêm ngặt quy chuẩn: Mỗi Actor có ít nhất 3 User Stories, 100% kèm AC gồm cả Happy Case và Error/Exception Case.
1. PHÂN HỆ NGƯỜI HIẾN MÁU (DONOR)
US-D01: Đăng ký tài khoản và cập nhật hồ sơ y tế ban đầu
User Story:

As a Người tình nguyện hiến máu,
I want to đăng ký tài khoản qua React 19 Form, chọn nhóm máu (hoặc chọn "Chưa biết" nếu hiến lần đầu) và khai báo tiền sử bệnh,
So that hệ thống lưu trữ hồ sơ định danh chính xác, hỗ trợ sàng lọc y tế và kết nối cấp cứu khi cần.

AC 01 (Happy Case - Đăng ký hợp lệ & Cấp tọa độ GPS):

Given người dùng đang ở màn hình Đăng ký;
When nhập họ tên, email hợp lệ, mật khẩu 
≥
8
≥8 ký tự, chọn nhóm máu (ví dụ: O, Rh- hoặc UNKNOWN), tích cam kết tiền sử bệnh an toàn và cho phép trình duyệt truy cập Geolocation;
Then React Hook Form/Zod validate thành công, Axios gửi POST /api/auth/register tới Express 5, mật khẩu được hash bằng bcryptjs, tọa độ GPS và thông tin được lưu vào bảng Users trong MSSQL, hiển thị React Hot Toast thành công và điều hướng sang trang chủ.

AC 02 (Error Case - Thiếu thông tin bắt buộc hoặc tiền sử bệnh chống chỉ định):

Given người dùng đang ở form đăng ký;
When bỏ trống trường bắt buộc hoặc tích chọn có tiền sử các bệnh lây nhiễm nguy hiểm (HIV, Viêm gan B/C mãn tính);
Then Zod schema kích hoạt chặn submit ngay tại client, hiển thị thông báo lỗi chi tiết qua React Hot Toast: "Hồ sơ y tế của bạn thuộc diện tạm hoãn hiến máu theo quy định Bộ Y Tế" và không gửi request lên backend.

US-D02: Tra cứu chiến dịch và đặt lịch hẹn hiến máu trước
User Story:

As a Donor đã có tài khoản,
I want to xem danh sách các đợt hiến máu/bệnh viện tiếp nhận trên bản đồ React-Leaflet và đặt trước khung giờ hẹn,
So that tôi chủ động thời gian hiến máu và bệnh viện dự trù được số lượng người đến tiếp nhận.

AC 01 (Happy Case - Đặt lịch hẹn thành công):

Given Donor đã đăng nhập và đạt khoảng cách giãn cách an toàn (
≥
84
≥84 ngày);
When chọn điểm hiến máu trên bản đồ React-Leaflet, chọn khung giờ còn trống (ví dụ: 08:00 - 09:30 ngày 25/10/2026) và bấm "Xác nhận đặt lịch";
Then Axios gửi POST /api/appointments, Sequelize lưu bản ghi vào bảng Appointments trong MSSQL với trạng thái CONFIRMED, hiển thị Toast thành công và chuyển sang màn hình "Phiếu hẹn điện tử".

AC 02 (Error Case - Khung giờ tiếp nhận đã hết chỗ):

Given khung giờ tiếp nhận đã đủ số lượng đăng ký tối đa (đạt giới hạn slot);
When Donor bấm nút chọn khung giờ đó;
Then giao diện làm mờ nút (disabled), hiển thị nhãn cảnh báo: "Khung giờ này đã đủ số lượng người đăng ký, vui lòng chọn khung giờ khác" và không cho phép gửi request.

US-D03: Xuất trình mã QR cá nhân động (Dynamic QR) làm thủ tục check-in
User Story:

As a Donor đã đến điểm tiếp nhận hiến máu,
I want to xuất trình mã QR định danh động trên màn hình ứng dụng,
So that nhân viên y tế quét nhanh chóng mà không cần khai báo giấy tờ thủ công.

AC 01 (Happy Case - Tạo mã QR Token bảo mật có thời hạn):

Given Donor đã đăng nhập (AuthContext lưu trữ JWT token hợp lệ);
When mở mục "Thẻ QR Check-in";
Then hệ thống mã hóa dữ liệu thành một chuỗi JSON Web Signature/Token ngắn hạn (TTL 10 phút để chống chụp màn hình gian lận) chứa donor_id, timestamp và render ra mã QR SVG động cùng đồng hồ đếm ngược hiệu lực.

AC 02 (Exception Case - Ngoại tuyến / Thiết bị mất mạng Internet):

Given điện thoại Donor bị mất kết nối Internet tại khu vực tiếp đón;
When mở ứng dụng;
Then Service Worker / LocalStorage tự động lấy QR Token đã được cache trong phiên gần nhất hiển thị lên màn hình kèm React Hot Toast cảnh báo màu vàng: "Đang hiển thị thẻ QR ở chế độ ngoại tuyến".

US-D04: Nhận và phản hồi cảnh báo khẩn cấp thời gian thực (SOS Alert)
User Story:

As a Donor đang bật trạng thái "Sẵn sàng hiến máu",
I want to nhận thông báo khẩn cấp qua Socket.io khi có ca cấp cứu tương thích nhóm máu ở bán kính gần và bấm phản hồi,
So that bác sĩ trực biết được tôi đang di chuyển tới viện để kịp thời cấp cứu.

AC 01 (Happy Case - Nhận thông báo và đồng ý đến cứu người):

Given Donor có nhóm máu tương thích y khoa đang ở bán kính 
≤
15
km
≤15km quanh bệnh viện phát SOS;
When Socket.io Client nhận sự kiện NEW_EMERGENCY_ALERT;
Then ứng dụng phát âm thanh chuông cảnh báo khẩn cấp, hiển thị Emergency Modal với đầy đủ thông tin: Tên viện, nhóm máu cần, khoảng cách km; khi Donor bấm "Tôi đang đến", Axios gửi POST /api/sos/respond với status COMING, kích hoạt tuyến đường chỉ dẫn bản đồ React-Leaflet từ vị trí Donor đến bệnh viện.

AC 02 (Exception Case - Donor từ chối hoặc Ca SOS đã kết thúc do đủ người):

Given Donor nhận thông báo nhưng bận (hoặc khi bấm xác nhận thì ca SOS đã được bác sĩ đóng do đủ lượng máu);
When Donor bấm "Bận / Không thể tham gia" (hoặc server phản hồi mã SOS_CLOSED);
Then hệ thống lập tức đóng Modal khẩn cấp, gửi thông báo cập nhật về server và hiển thị Toast: "Ca cấp cứu đã nhận đủ người hỗ trợ hoặc bạn đã từ chối đợt gọi này".

2. PHÂN HỆ BÁC SĨ / NHÂN VIÊN Y TẾ (HOSPITAL / STAFF)
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
≥14 ngày với tiểu cầu) theo quy định y tế dưới 3 giây.

AC 01 (Happy Case - Đủ điều kiện y tế tiếp nhận):

Given Web Camera quét được chuỗi QR token hợp lệ;
When Axios gửi POST /api/hospital/verify-qr, Service giải mã token, truy vấn ngày hiến gần nhất trong MSSQL có 
Δ
days
≥
84
Δdays≥84 ngày (hoặc hiến lần đầu);
Then Backend trả về HTTP 200 OK, giao diện chuyển khung viền Xanh chuẩn y tế, hiển thị họ tên, nhóm máu, số lần hiến và mở khóa nút "Chấp thuận tiếp nhận".

AC 02 (Error Case - Vi phạm quy định giãn cách):

Given Donor mới hiến máu toàn phần cách đây 45 ngày;
When nhân viên y tế quét mã QR;
Then Backend trả về HTTP 400 Bad Request kèm { eligible: false, errorCode: "UNDER_84_DAYS", daysPassed: 45, remainingDays: 39 }, giao diện chuyển khung cảnh báo Đỏ, hiển thị React Hot Toast: "KHÔNG ĐỦ ĐIỀU KIỆN: Khoảng cách lần hiến gần nhất mới được 45/84 ngày" và khóa nút tiếp nhận.

US-H02: Nhập dữ liệu túi máu sau hiến, phân loại chế phẩm và cách ly chờ xét nghiệm
User Story:

As a Nhân viên tiếp nhận / xét nghiệm,
I want to quét mã Barcode túi máu, chọn thể tích (250ml, 350ml, 450ml) và loại chế phẩm máu,
So that túi máu được lưu vào hệ thống với hạn sử dụng FEFO chính xác theo từng loại chế phẩm và tự động cộng dồn lịch sử cho Donor.

AC 01 (Happy Case - Nhập túi máu thành công và tính hạn sử dụng theo chế phẩm):

Given Donor vừa hoàn thành lấy máu;
When nhân viên nhập mã Barcode túi máu, thể tích 350ml, chọn loại chế phẩm RED_CELLS (Khối hồng cầu) và bấm "Lưu túi máu";
Then Sequelize kích hoạt Managed Transaction lưu bản ghi vào bảng BloodBags trong MSSQL với trạng thái ban đầu QUARANTINE (chờ xét nghiệm sàng lọc), tự động tính expiry_date (+42 ngày đối với Hồng cầu, hoặc +5 ngày nếu là Tiểu cầu), đồng thời cộng 1 lần hiến vào hồ sơ Donor và hiển thị Toast thành công.

AC 02 (Error Case - Trùng lặp mã Barcode):

Given nhân viên quét nhầm mã Barcode đã tồn tại trong CSDL MSSQL;
When bấm "Lưu túi máu";
Then Sequelize bắt lỗi SequelizeUniqueConstraintError, Backend trả về HTTP 409 Conflict, hiển thị React Hot Toast cảnh báo: "Mã vạch túi máu đã tồn tại trên hệ thống, vui lòng kiểm tra lại tem nhãn".

US-H03: Kích hoạt và quản lý vòng đời lệnh phát tín hiệu gọi máu khẩn cấp (SOS Alert)
User Story:

As a Bác sĩ trực cấp cứu,
I want to chọn nhóm máu thiếu hụt, số đơn vị cần và điều chỉnh bán kính tìm kiếm trên bản đồ Leaflet để phát lệnh SOS,
So that tín hiệu được đẩy tức thì qua Socket.io đến các Donor tương thích gần nhất và theo dõi số người đang đến.

AC 01 (Happy Case - Phát tín hiệu SOS và theo dõi thời gian thực):

Given bệnh viện thiếu nhóm máu O-, bác sĩ chọn O-, số lượng 2 đơn vị, bán kính 15km trên thanh trượt React-Leaflet;
When bấm nút "PHÁT LỆNH SOS";
Then Backend tính khoảng cách theo công thức Haversine kết hợp ma trận tương thích nhóm máu y khoa, lưu bản ghi vào SOSAlerts, Socket.io phát sự kiện NEW_EMERGENCY_ALERT tới các Donor thỏa mãn trong 
<
3
<3 giây; giao diện bác sĩ cập nhật realtime số người đã nhận tin và số người phản hồi "Tôi đang đến".

AC 02 (Exception Case - Không tìm thấy Donor khả dụng hoặc Đóng lệnh SOS khi đã đủ):

Given không có Donor nào bật sẵn sàng trong bán kính 15km (hoặc đã nhận đủ 2 người đến viện hiến);
When phát lệnh thất bại do 0 kết quả (hoặc bác sĩ bấm nút "KẾT THÚC LỆNH SOS");
Then hệ thống gợi ý kéo mở rộng bán kính lên 30km (hoặc nếu bấm kết thúc, Backend cập nhật trạng thái SOS sang CLOSED, Socket.io phát sự kiện hủy tới các Donor còn lại và hiển thị Toast thông báo hoàn tất).

US-H04: Xuất kho túi máu cấp cứu theo chuẩn FEFO và khóa dòng chống âm kho
User Story:

As a Bác sĩ / Quản lý kho máu bệnh viện,
I want to tạo lệnh xuất kho máu bằng cách chỉ định nhóm máu và số đơn vị cần dùng cho ca mổ,
So that hệ thống tự động ưu tiên xuất các túi máu có hạn dùng gần nhất (FEFO) và áp dụng cơ chế khóa dòng giao dịch để ngăn chặn triệt để tình trạng âm kho.

AC 01 (Happy Case - Xuất kho FEFO thành công với Pessimistic Locking):

Given kho máu có sẵn các túi máu nhóm A+ đã qua kiểm định an toàn (status = 'AVAILABLE', is_tested_safe = 1);
When bác sĩ nhập yêu cầu xuất 2 túi A+ và bấm "Xác nhận xuất kho";
Then Sequelize khởi tạo Managed Transaction với cơ chế khóa dòng bi quan (transaction.LOCK.UPDATE), sắp xếp ưu tiên ORDER BY expiry_date ASC (chuẩn FEFO), cập nhật trạng thái các túi được chọn thành DISPATCHED, commit transaction và hiển thị danh sách Barcode túi máu chỉ định cho ca phẫu thuật.

AC 02 (Error Case - Không đủ tồn kho khả dụng hoặc tranh chấp đồng thời):

Given lượng túi máu A+ khả dụng trong kho chỉ còn 1 túi nhưng bác sĩ yêu cầu xuất 2 túi (hoặc túi máu đó vừa bị ca cấp cứu khác giữ khóa);
When nhấn "Xác nhận xuất kho";
Then Transaction tự động Rollback hoàn toàn, Backend trả về HTTP 400 Bad Request kèm mã lỗi INSUFFICIENT_STOCK, hiển thị React Hot Toast cảnh báo Đỏ: "Không đủ lượng máu khả dụng theo chuẩn FEFO để xuất kho".

3. PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN)
US-A01: Quản lý người dùng, kiểm duyệt bệnh viện và phân quyền RBAC 3 cấp
User Story:

As a Quản trị viên hệ thống,
I want to quản lý danh sách tài khoản, phê duyệt tư cách pháp nhân của các cơ sở y tế và phân quyền chặt chẽ 3 vai trò (Admin, Bác sĩ/Nhân viên, Người hiến),
So that đảm bảo an toàn dữ liệu y tế và chỉ người có thẩm quyền mới được thao tác kho máu.

AC 01 (Happy Case - Phê duyệt bệnh viện và cấp quyền Bác sĩ):

Given Admin mở bảng điều khiển quản trị người dùng;
When kiểm tra thông tin giấy phép của một cơ sở y tế mới, chuyển vai trò tài khoản sang HOSPITAL_STAFF và nhấn "Phê duyệt";
Then Sequelize cập nhật trường role và is_verified = 1 trong MSSQL, Express JWT Middleware lập tức cấp quyền truy cập các route y tế chuyên dụng cho tài khoản này.

AC 02 (Error Case - Truy cập trái phép bị chặn bởi RBAC):

Given người dùng đăng nhập bằng tài khoản Người hiến (DONOR) nhưng cố tình gửi request can thiệp API cấu hình /api/admin/system-settings;
When request đi qua verifyRoleMiddleware(['ADMIN']);
Then middleware lập tức chặn lại, trả về HTTP 403 Forbidden kèm thông báo: "Truy cập bị từ chối: Bạn không có quyền hạn thực hiện thao tác này".

US-A02: Cấu hình danh mục y tế, ma trận tương thích và ngưỡng an toàn tồn kho (Min-Max)
User Story:

As a Quản trị viên y tế,
I want to cấu hình ma trận tương thích nhóm máu, thời gian giãn cách theo từng loại chế phẩm và thiết lập ngưỡng tồn kho an toàn (Mức Đỏ - Vàng - Xanh),
So that hệ thống tự động gắn cờ cảnh báo nguy cơ thiếu hụt trên toàn hệ sinh thái bệnh viện.

AC 01 (Happy Case - Thiết lập ngưỡng cảnh báo kho thành công):

Given Admin đang ở màn hình Cấu hình ngưỡng kho máu;
When chọn nhóm máu O-, đặt ngưỡng nguy cấp (Mức Đỏ) là 
<
10
<10 túi, ngưỡng cảnh báo (Mức Vàng) là từ 
10
−
30
10−30 túi, trên 30 túi là An toàn (Mức Xanh) và nhấn "Lưu cấu hình";
Then Axios gửi PUT /api/admin/thresholds, Sequelize cập nhật bảng InventorySettings trong MSSQL, trả về HTTP 200 OK và Dashboard lập tức áp dụng thang màu mới theo thời gian thực.

AC 02 (Error Case - Dải giá trị ngưỡng logic không hợp lệ):

Given Admin nhập cấu hình ngưỡng kho máu;
When nhập giá trị ngưỡng Mức Đỏ lớn hơn hoặc bằng ngưỡng Mức Vàng;
Then Zod validation tại client chặn submit, hiển thị React Hot Toast lỗi: "Ngưỡng nguy cấp (Đỏ) phải nhỏ hơn ngưỡng cảnh báo (Vàng)" và không gửi request lên backend.

US-A03: Phân tích chuỗi thời gian và dự báo nguy cơ thiếu máu 7–30 ngày
User Story:

As a Quản trị viên y tế,
I want to xem biểu đồ trực quan dự báo xu hướng tiêu thụ và nguy cơ cạn kiệt từng nhóm máu trong 7–30 ngày tới dựa trên mô hình chuỗi thời gian,
So that tôi có thể chủ động lập kế hoạch phê duyệt các đợt hiến máu lưu động đón đầu nguy cơ.

AC 01 (Happy Case - Trực quan hóa dữ liệu dự báo chuỗi thời gian):

Given CSDL MSSQL có dữ liệu lịch sử xuất/nhập máu 
≥
6
≥6 tháng;
When Admin truy cập trang "Dự báo nguy cơ thiếu máu";
Then Service thực thi thuật toán chuỗi thời gian (Moving Average kết hợp hệ số mùa vụ/dịch tễ), trả về mảng dữ liệu dự báo 30 ngày tới, giao diện vẽ biểu đồ tương tác và tự động đánh cờ cảnh báo Đỏ ở những tuần có nguy cơ cạn kho.

AC 02 (Exception Case - Chưa đủ dữ liệu lịch sử để chạy mô hình):

Given cơ sở dữ liệu mới triển khai có lịch sử xuất nhập 
<
30
<30 ngày;
When Admin mở trang dự báo;
Then hệ thống hiển thị thông báo trạng thái: "Dữ liệu lịch sử chưa đủ 
≥
30
≥30 ngày để chạy mô hình chuỗi thời gian, hệ thống đang tạm hiển thị mức tiêu thụ trung bình ngày" và hiển thị biểu đồ ước tính giản đơn.
________________________________________
BƯỚC 4: THIẾT KẾ LUỒNG NGƯỜI DÙNG (USER FLOW)
Luồng 1: Quy trình Quét mã QR kiểm tra điều kiện an toàn tại bàn tiếp đón
 
________________________________________
Luồng 2: Quy trình Phát cảnh báo điều phối máu khẩn cấp (Real-time SOS Alert)
 
________________________________________
BƯỚC 5: THIẾT KẾ MODULE LOGIC & CHUẨN HÓA I-P-O
Hệ thống SMARTBLOOD được xây dựng trên nền tảng Express.js 5 chuẩn 3 lớp (Controller – Service – Model) kết hợp Sequelize ORM & MSSQL:
┌─────────────────────────────────────────────────────────────┐
│                 REACT 19 FRONTEND (Vite 8)                  │
│ Tailwind v4 │ Lucide │ React Router v7 │ React-Leaflet │ Axios │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (Socket.io)
┌──────────────────────────────▼──────────────────────────────┐
│             EXPRESS.JS 5 BACKEND (3-LAYER ARCHITECTURE)     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Controllers: Tiếp nhận Request, Validate, gọi Service   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Services: Xử lý Business Logic, FEFO, Matching, Giãn cách│ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Models: Sequelize Models (MSSQL), ACID Transactions     │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │ T-SQL / Connection Pool
┌──────────────────────────────▼──────────────────────────────┐
│             MICROSOFT SQL SERVER (MSSQL DATABASE)           │
│ Bảng Users, BloodBags, Campaigns, Donations, SOSAlerts...   │
└─────────────────────────────────────────────────────────────┘
Đặc tả kỹ thuật Input - Processing - Output (I-P-O)
1. Module Donor & QR Verification
•	Chức năng: Xác thực mã QR và kiểm tra quy tắc an toàn giãn cách 84 ngày 
o	Input: qr_token (chuỗi token giải mã từ camera), hospital_id.
o	Processing (Service Layer): 
1.	Verify chữ ký JWT của qr_token để trích xuất donor_id.
2.	Gọi DonationModel.findOne({ where: { donor_id, status: 'COMPLETED' }, order: [['donation_date', 'DESC']] }) trong MSSQL.
3.	Tính khoảng cách ngày: Δdays=CurrentDate−LastDonationDate\Delta \text{days} = \text{CurrentDate} - \text{LastDonationDate}Δdays=CurrentDate−LastDonationDate.
4.	Kiểm tra điều kiện: Nếu Δdays<84\Delta \text{days} < 84Δdays<84 ngày, đánh dấu vi phạm.
o	Output: 
	Thành công (Đủ 84 ngày): HTTP 200 OK
{ success: true, eligible: true, donor: { id, fullName, bloodType, totalDonations, lastDonationDate } }
	Thất bại (Chưa đủ ngày): HTTP 400 Bad Request
{ success: false, eligible: false, errorCode: "UNDER_84_DAYS", daysPassed: 40, remainingDays: 44 }
2. Module SOS & Real-time Matching
•	Chức năng: Khởi tạo lệnh gọi máu khẩn cấp và phát sóng qua Socket.io 
o	Input: { hospitalId, requiredBloodType: "AB-", unitsNeeded: 2, radiusKm: 15 }.
o	Processing (Service Layer): 
1.	Lấy tọa độ kinh/vĩ độ của bệnh viện: (hospital_lat, hospital_lng).
2.	Xác định danh sách nhóm máu tương thích theo ma trận y khoa (ví dụ: người nhận AB- có thể nhận O- và AB-).
3.	Truy vấn danh sách Donor trong MSSQL đang bật is_emergency_ready = 1 và có nhóm máu tương thích.
4.	Ứng dụng công thức tính khoảng cách hình cầu (Haversine) để lọc các Donor có khoảng cách ≤radiusKm\le \text{radiusKm}≤radiusKm.
5.	Lưu bản ghi lệnh cấp cứu vào bảng SOSAlerts trong MSSQL.
6.	Phát sự kiện socketServer.to(matchedDonorSocketIds).emit('NEW_EMERGENCY_ALERT', payload).
o	Output:
HTTP 201 Created
{ alertId: "sos_101", matchedCount: 14, broadcastTime: "2026-10-18T19:40:00Z" }
3. Module Quản lý kho máu an toàn (Blood FEFO Store)
•	Chức năng: Xuất kho theo nguyên tắc FEFO (Túi hạn sử dụng gần nhất xuất trước) & Khóa dòng chống âm kho 
o	Input: { bloodType: "O+", componentType: "RED_CELLS", unitsRequired: 2 }.
o	Processing (Service Layer): 
1.	Khởi tạo Sequelize Managed Transaction: const t = await sequelize.transaction();
2.	Truy vấn danh sách túi máu trong MSSQL với điều kiện: status = 'AVAILABLE' và is_tested_safe = 1.
3.	Sắp xếp ưu tiên hạn sử dụng: ORDER BY expiry_date ASC (chuẩn FEFO).
4.	Kích hoạt cơ chế khóa dòng bi quan (transaction.LOCK.UPDATE) để ngăn các ca mổ khác tranh chấp cùng túi máu, chống triệt để tình trạng âm kho.
5.	Cập nhật status = 'DISPATCHED'.
6.	Commit transaction.
o	Output:
HTTP 200 OK { success: true, dispatchedBags: ["BAG-MSSQL-001", "BAG-MSSQL-002"] }.
4. Module Dự báo nguy cơ thiếu máu (Time-series Analysis)
•	Chức năng: Phân tích xu hướng tiêu thụ và cảnh báo ngưỡng tồn kho 
o	Input: hospitalId, bloodType, forecastDays: 30.
o	Processing (Service Layer): 
1.	Tổng hợp chuỗi dữ liệu xuất kho lịch sử theo ngày từ MSSQL.
2.	Thực thi thuật toán phân tích chuỗi thời gian (Time-series moving average kết hợp hệ số mùa vụ/dịch tễ).
3.	Dự đoán lượng máu cần dùng cho từng tuần trong 30 ngày tới và so sánh với tồn kho khả dụng hiện tại.
o	Output:
HTTP 200 OK { bloodType: "O-", currentStock: 5, predictedConsumption: 18, riskLevel: "HIGH_DEFICIT", alertColor: "RED" }.
________________________________________
BƯỚC 6: PHƯƠNG PHÁP VIBE CODING CHUẨN MỰC VỚI AI
1. Kỹ thuật thiết lập System Prompt & Khóa Tech Stack
Khi mở công cụ AI (Cursor, Claude Code, ChatGPT), hãy nạp ngay System Prompt này làm kim chỉ nam để ngăn AI tự ý đổi thư viện hoặc lệch chuẩn kiến trúc:
markdown
Bạn là Senior Software Architect kiêm Full-stack Developer chuyên nghiệp.
Nhiệm vụ của bạn là lập trình từng module cho hệ thống "SMARTBLOOD" dựa trên tài liệu đặc tả SRS kèm theo.
BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT TECH STACK KỸ THUẬT:
1. FRONTEND:
   - Core & Ngôn ngữ: React 19 + TypeScript (Strict Mode)
   - Build Tool: Vite 8
   - Giao diện: Tailwind CSS v4 + Lucide React Icons
   - Bản đồ số (GIS): Leaflet & React-Leaflet + GPS Geolocation
   - Định tuyến: React Router v7 (Bảo vệ route theo quyền RBAC)
   - Giao tiếp: Axios (kèm Interceptor gắn JWT Token) + Socket.io Client
   - State & Toast: React Context API (AuthContext, EmergencyContext) + React Hot Toast
2. BACKEND:
   - Nền tảng & Ngôn ngữ: Node.js (ESM) + TypeScript, chạy qua tsx (Hot-Reload)
   - Framework & Kiến trúc: Express.js 5 chuẩn mô hình 3 lớp (Controller – Service – Model)
   - Cơ sở dữ liệu: Microsoft SQL Server (MSSQL) quản trị qua Sequelize ORM
   - Giao dịch an toàn: ACID Transaction kết hợp khóa dòng (Locking) chống âm kho
   - Bảo mật: JWT (Access Token 2h, Refresh Token 7d), RBAC 3 cấp (Admin, Bác sĩ/Nhân viên, Người hiến), bcryptjs, Helmet, CORS
   - Tài liệu & Kiểm thử: OpenAPI 3.0.3 / Swagger UI tại /api-docs, Postman Collection (T01–T09)
3. NGHIỆP VỤ CỐT LÕI:
   - Xuất kho theo hạn dùng FEFO (First-Expired, First-Out)
   - Ma trận tương thích nhóm máu y khoa
   - Kiểm tra quy tắc giãn cách y tế >= 84 ngày
   - Thuật toán dự báo chuỗi thời gian nguy cơ thiếu máu
QUY TẮC PHÁT TRIỂN:
1. Tuyệt đối không tự ý thêm bớt thư viện ngoài danh sách trên.
2. Mọi API phải có khối try/catch bắt lỗi tường minh, phản hồi đúng mã lỗi HTTP theo tiêu chí AC.
3. Viết code sạch, modular, type-safe 100%.
________________________________________
2. Chiến lược 3 Lệnh Prompt tuần tự (Step-by-step Generation)
Lệnh 1: Database Model & Migration (Sequelize ORM + MSSQL)
Prompt gửi AI:
"Dựa vào tài liệu thiết kế hệ thống SMARTBLOOD, hãy viết các Sequelize Models và Migration tương thích với Microsoft SQL Server (MSSQL) bằng TypeScript. Bao gồm các Model: User, HospitalProfile, Campaign, BloodDonation, BloodBag, SOSAlert, SOSResponse. Định nghĩa kiểu dữ liệu chuẩn MSSQL (NVARCHAR, INT, DATETIME2, DECIMAL cho Lat/Lng), thiết lập quan hệ 1-N, Enums cho nhóm máu và trạng thái túi máu, đồng thời đánh Index trên các cột blood_type, expiry_date, status để tối ưu hóa truy vấn FEFO và lọc SOS."
⚡ Lệnh 2: Backend Core (Express.js 5 mô hình 3 lớp Controller - Service - Model)
Prompt gửi AI:
*"Dựa vào các Sequelize Models vừa tạo, hãy viết Controller và Service theo chuẩn mô hình 3 lớp của Express.js 5 cho 2 chức năng sau:
1.	API /api/hospital/verify-qr: Tiếp nhận qr_token, giải mã JWT lấy donor_id, truy vấn lần hiến gần nhất trong MSSQL; nếu khoảng cách <84< 84<84 ngày thì trả về HTTP 400 kèm remainingDays theo đúng AC-02 của US-H01; nếu ≥84\ge 84≥84 ngày thì trả về thông tin hợp lệ.
2.	API /api/inventory/dispatch-fefo: Tiếp nhận yêu cầu xuất túi máu, kích hoạt Sequelize Managed Transaction với cơ chế khóa dòng (transaction.LOCK.UPDATE) để lấy các túi máu có hạn dùng gần nhất (FEFO) và chống âm kho theo đúng nghiệp vụ Module 3."*
📱 Lệnh 3: Frontend Component (React 19, Vite 8, Tailwind v4, React-Leaflet)
Prompt gửi AI:
*"Hãy viết component React 19 (EmergencyMapModal.tsx) bằng TypeScript cho phía Bác sĩ sử dụng Vite 8, Tailwind CSS v4, Lucide React và React-Leaflet. Component có chức năng:
1.	Hiển thị bản đồ Leaflet đánh dấu vị trí Bệnh viện và vẽ vòng tròn bán kính tìm kiếm (mặc định 15km).
2.	Có thanh trượt (Slider) để điều chỉnh bán kính từ 5km đến 50km.
3.	Nút bấm 'PHÁT LỆNH SOS' gọi Axios POST tới /api/sos/broadcast. Khi có phản hồi thành công, hiển thị React Hot Toast và kết nối Socket.io Client để cập nhật realtime số người nhận tin đúng theo mô tả của US-H03."*
________________________________________
BẢNG CHECKLIST NGHIỆM THU TIẾN ĐỘ DỰ ÁN
Hạng mục kiểm tra	Tiêu chuẩn chất lượng theo quy trình	Trạng thái công nghệ
1. Ý tưởng & Phạm vi	Đầy đủ 4 thành tố rõ ràng; thẩm định tính khả thi qua tam giác Kỹ thuật (React 19 + Express 5 + MSSQL), Thời gian (10 tuần), Nguồn lực (2 thành viên).	Đạt
2. Bảng Actor & Hành vi	Tối thiểu 3 Primary Actors (Donor, Bác sĩ/Nhân viên, Admin) và 2 Secondary Systems (Bản đồ Leaflet, Socket.io); mô tả hành vi rõ ràng.	Đạt
3. User Stories & AC	Đủ 3 User Stories cho mỗi Actor; 100% kèm Acceptance Criteria Given-When-Then bao quát cả Happy Path và Error Path.	Đạt
4. User Flow	2 sơ đồ Mermaid trực quan chuẩn ký hiệu: Luồng Check-in QR (vòng lặp từ chối 84 ngày) và Luồng SOS khẩn cấp qua Socket.io.	Đạt
5. Module & I-P-O	Bóc tách độc lập theo mô hình 3 lớp; đặc tả I-P-O chi tiết cho chức năng kiểm tra 84 ngày, xuất kho FEFO khóa dòng chống âm kho và phát sóng SOS.	Đạt
6. Vibe Coding	System Prompt chuẩn hóa, khóa cứng Tech Stack (React 19/Vite 8/Tailwind v4/Leaflet & Express 5/MSSQL/Sequelize/Socket.io), sẵn sàng kịch bản 3 Lệnh sinh code.	Đạt

