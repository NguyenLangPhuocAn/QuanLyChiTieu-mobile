# Bản kế tiếp — bản nháp, chưa phát hành

Cập nhật source ngày 23/10/2026 theo yêu cầu giảm thao tác.

## Thông báo ngân hàng và giao dịch

- Lắc điện thoại khi đang dùng màn chính của app, hoặc bấm chuông trong form, để lấy thông báo giao dịch mới nhất chưa xử lý còn trên thanh thông báo Android. Cần quyền truy cập thông báo một lần.
- Đọc trực tiếp chữ thông báo trên máy; không chụp màn hình, khoanh vùng, upload ảnh hoặc gọi AI khi lắc. Đã gỡ luồng MediaProjection, foreground service chụp và ML Kit vừa thêm cho ngân hàng; OCR hóa đơn không đổi.
- Ưu tiên mới nhất trước theo thời điểm thông báo Android. Sau khi lưu/giữ bản nháp ngoại tuyến an toàn, đánh dấu mục đó đã xử lý; lần đọc tiếp lấy mục kế tiếp. Đóng form chưa lưu không tự bỏ mục.
- Điền Thu/Chi, số tiền giao dịch và nội dung vào form. Không lấy số dư hoặc OTP; mục mới nhất chưa rõ vẫn mở để kiểm tra, không lén thay bằng mục cũ dễ đọc hơn.
- Giữ nguyên phần đã sửa khi lắc lại cùng một mục. Nếu form đang có nội dung khác, hỏi trước khi thay. Chống đọc đồng thời, hộp xin quyền lặp và bỏ kết quả muộn sau đóng form/đổi tài khoản/rời app.
- Chỉ đọc khi có thao tác lắc/chuông; vào app hoặc trở lại app không tự đọc. Dừng cảm biến khi rời app/mở màn khác/đang lưu hay OCR; bỏ thông báo nhóm tổng hợp để tránh lấy nhiều giao dịch thành một.
- Ví do người dùng chọn, chỉ ghi tiền khi bấm Lưu. Giữ source_ref, không gửi client_request_id xung đột; đánh dấu đã xử lý sau lưu hoặc enqueue an toàn, không đánh dấu lúc mới đọc.
- Quy tắc danh mục không tự đổi ngược chiều Thu/Chi đã đọc từ thông báo.

## Giọng nói và trải nghiệm

- Mic trong form đã có nghe tiếng Việt, sửa câu, xem trước rồi điền giao dịch; không tự lưu hay chuyển sang chatbot. Source từ 21/10.
- Hủy/đóng form bỏ qua kết quả muộn; câu nhiều số tiền hoặc mơ hồ cần sửa. Chất lượng nhận dạng còn phụ thuộc máy.
- Bỏ chờ cố định 220 ms khi chuyển tab. Luồng ngân hàng đọc chữ trực tiếp nên không cần tải ảnh lên backend; chưa có số đo thời gian máy thật.

## Backend và kiểm tra

- Giữ source cờ FEATURE_BANK_NOTIFICATION_AI mặc định tắt và API trích xuất chữ có đồng ý gửi, che dữ liệu, kiểm chứng và hạn mức. Luồng lắc mới không gọi API này; chưa có giao diện AI trong luồng rút gọn.
- Backend đang chạy, .env, DNS, website và APK hiện tại được giữ nguyên. Hóa đơn định kỳ vẫn là việc tiếp theo.
- Mobile đạt 70/70 kiểm thử mục tiêu qua 7 bộ; TypeScript noEmit, ESLint và compileDebugKotlin đạt. Backend giữ mốc 55/55 kiểm thử mới trước đó, không đổi mã xử lý trong đợt rút gọn.
- Chưa build/ký/phát hành APK mới, chưa thử cảm biến và thông báo ngân hàng trên điện thoại thật. Đọc thông báo Android không xác định riêng banner nào đang nổi.
- Khóa nguồn chống lặp cùng sự kiện thông báo; chưa cam kết chống trùng ngữ nghĩa nếu ngân hàng phát hành lại cùng giao dịch dưới sự kiện khác.

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
