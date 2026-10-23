# Bản kế tiếp — bản nháp, chưa phát hành

Cập nhật source ngày 23/10/2026.

## Thông báo ngân hàng và giao dịch

- Nút chuông dùng phiên chụp màn hình được Android cấp quyền. Lần đầu chuẩn bị quyền; bấm lại khi banner đang nổi để chụp ảnh mới.
- Cho chọn vùng đúng một banner, đọc chữ trên máy, xem/sửa nội dung rồi điền Thu/Chi và số tiền vào form. Không đọc lại hàng chờ trong khay; bỏ đồng bộ thông báo cũ tự động khỏi MainScreen.
- Không lấy số dư, chặn OTP khi phân tích; nhiều số tiền hoặc chưa rõ Thu/Chi thì yêu cầu chọn lại vùng/nhập tay.
- Ví và danh mục do người dùng chọn; chỉ lưu sau kiểm tra. Giữ source_ref để chống gửi lại, không gửi đồng thời client_request_id gây lỗi backend. Hàng chờ ngoại tuyến giữ nguyên khóa.
- Phiên có nút Dừng và dừng khi rời app/đóng form. Ảnh chỉ nằm trong cache, được dọn khi kết thúc và không tự đính kèm hóa đơn.
- Chữ khó hiểu có thể nhờ AI sau bước đồng ý riêng: chỉ gửi chữ đã che tài khoản/mã GD và bỏ số dư, không gửi ảnh màn hình. Chưa bật/deploy backend AI nên hiện có thể dùng OCR cục bộ và nhập tay.

## Nhập giọng nói và trải nghiệm

- Mic trong form nhận tiếng Việt, cho sửa câu đã nghe và xem trước rồi điền giao dịch; không tự lưu hay chuyển sang chatbot. Đã có trong source từ 21/10.
- Hủy nghe/đóng form bỏ qua kết quả đến muộn; câu nhiều số tiền hoặc mơ hồ cần sửa lại. Độ chính xác nhận dạng còn phụ thuộc thiết bị.
- Bỏ lớp chờ cố định 220 ms khi đổi tab.

## Dữ liệu và backend

- Source thêm cờ FEATURE_BANK_NOTIFICATION_AI mặc định tắt, GET /features có đăng nhập và POST /bank-notifications/extract có đồng ý gửi.
- Kiểm chứng số tiền/tiền tệ/bằng chứng Thu/Chi, giới hạn gọi AI theo tài khoản. Không có thao tác ghi tiền trong API trích xuất.
- Giữ bộ START/STOP/STATUS-BACKEND. Chưa sửa .env, chạy backend dist mới hoặc restart/deploy server.

## Kiểm tra và giới hạn

- Mobile: 57/57 kiểm thử mục tiêu qua 6 bộ — form giao dịch, quyền/phiên chụp, xem trước vùng, parser, hàng chờ và đồng bộ cũ; TypeScript và ESLint đạt.
- Backend: 55/55 kiểm thử mới qua 3 bộ; TypeScript và ESLint đạt. AI dùng mock, chưa đo độ chính xác model thật.
- Android compileDebugKotlin đạt; chưa tạo/ký/phát hành APK mới, chưa cập nhật website.
- Cần thử quyền Android, banner ACB/MB/VCB thật, OEM chặn chụp, ảnh không có banner, đổi hướng và thu hồi quyền. Chưa nghiệm thu hoạt động trên điện thoại thật.
- Chống trùng theo hash vùng ảnh nhận diện cùng crop; các ảnh khác nhau của cùng giao dịch chưa được cam kết chống trùng ngữ nghĩa.
- Hóa đơn định kỳ riêng, đo hiệu năng Wi-Fi/4G và tuyển nhóm thử vẫn là việc tiếp theo.

---

# Sổ Thu Chi Nova 1.2.1

**Ngày phát hành:** 19/10/2026

**Phiên bản:** 1.2.1 (`versionCode 6`)

**Tải APK:** https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/download/v1.2.1/QuanLyChiTieu-1.2.1.apk

**SHA-256:** `C43B25FE437B18F3B685000AA0F25B91C8D3FF99555D3C159A83C35E4B1F8B63`

**Dung lượng:** 49.550.426 byte (khoảng 47,3 MB)

## Hóa đơn và giao dịch

- Màn sửa giao dịch giữ lại ảnh hóa đơn hiện có khi người dùng chỉ sửa nội dung.
- Cho sửa, thêm hoặc xóa từng món; hiển thị tổng các món, tổng thanh toán và phần chênh lệch.
- Tăng thời gian chờ OCR, giảm kích thước ảnh trước khi tải để ổn định hơn trên mạng di động.
- Giao diện chi tiết hóa đơn được làm gọn theo theme cam–kem; ô Tên món và Số tiền nằm cùng hàng trong một khung liền.
- Kiểm tra lại ảnh hóa đơn Tháng 2 Cafe & Trà: đọc đúng Bạc xỉu số lượng 2, thành tiền 94.000đ và tổng thanh toán 79.000đ.

## Excel và dữ liệu

- Màn xem trước nhập Excel dùng toàn chiều ngang, hiển thị từng dòng mới, trùng hoặc lỗi cùng lý do.
- Dòng trùng và lỗi không được chọn để nhập; ngày hiển thị theo định dạng Việt Nam.
- Xác nhận nhập lại file đã xuất nhận đúng giao dịch trùng và không ghi thêm lần nữa.
- Bỏ phần hướng dẫn dài ở cuối màn Dữ liệu và xuất nhập.

## Quy tắc thông minh và giao diện

- Quy tắc không phân biệt chữ hoa/thường: `Grab`, `grab` và `GRAB` cho cùng kết quả.
- Căn đều các nút danh mục, rút gọn phần hướng dẫn và giảm biểu tượng trang trí.
- Sửa trạng thái tải đăng nhập, giữ thông báo lỗi từ máy chủ và kiểm tra mật khẩu đăng ký ngay trên thiết bị.
- Sửa nội dung giải thích quỹ khẩn cấp khi tài khoản chưa có lịch sử chi thiết yếu.

## Kiểm tra

- TypeScript và ESLint đạt.
- Kiểm thử phần nhập giao dịch, OCR và chi tiết hóa đơn đạt.
- APK Android thử nghiệm đã build và cài thành công trên máy ảo trước khi phát hành.

## Lưu ý cập nhật

- Có thể cài đè lên bản production 1.2.0 và giữ nguyên dữ liệu.
- Đây là bản cập nhật không bắt buộc.
