# Bản kế tiếp — bản nháp, chưa phát hành

## Đọc thông báo ngân hàng và lưu giao dịch

- Sửa lỗi app gửi cùng lúc mã thông báo ngân hàng và mã yêu cầu chung; backend từ chối tổ hợp này nên giao dịch không lưu được.
- Bản nháp ngân hàng khi mất mạng giữ nguyên mã chống trùng của thông báo, không tự thêm mã thứ hai khi đồng bộ lại.
- Danh sách thông báo giữ các mục cần xem lại, giải thích vì sao chưa đọc chắc chắn thay vì làm chúng biến mất.
- Nếu chưa xác định được khoản thu hay chi, app yêu cầu chọn rõ Thu/Chi trước khi lưu.
- Danh sách vẫn theo thứ tự cũ nhất trước; đóng danh sách không xóa thông báo đang chờ.

## Kiểm tra và giới hạn

- Đã chạy hồi quy cho lưu giao dịch từ thông báo, hàng chờ ngoại tuyến và phân loại cần xem lại.
- Đây mới là thay đổi mã nguồn. Chưa build APK, chưa phát hành và chưa cập nhật trang tải.
- AI trích xuất thông báo, mic nhập giao dịch, hóa đơn định kỳ và cờ bật/tắt backend vẫn nằm trong kế hoạch; chưa được triển khai.

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
