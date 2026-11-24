# Sửa thông tin Vay/Nợ khi mất mạng — 24/11/2026

## Các bước đã kiểm tra bằng mã

1. Sửa tên người, ngày hẹn và ghi chú của khoản đã tải; sửa tiếp trên cùng điện thoại. Hàng chờ vẫn giữ bản gốc để đối chiếu.
2. Máy chủ ghi thêm thanh toán trước khi bản sửa được gửi. Hàng chờ nhận xung đột và không gửi bản sửa đè lên khoản mới.
3. Máy chủ nhận bản sửa nhưng app mất phản hồi. Khi thử lại, app đọc máy chủ và nhận ra nội dung đã được lưu, không gửi lệnh sửa lần hai.
4. Màn chi tiết dùng bản đã tải khi API lỗi, cho lưu thông tin trên máy và khóa nút thanh toán. Màn đối chiếu chờ người dùng chọn bản máy trước khi gửi.
5. Ngày hẹn bị bỏ trên máy làm trạng thái quá hạn hiển thị trở lại đang mở.

## Kết quả và giới hạn

- Jest backend Vay/Nợ: 24/24 ca đạt. TypeScript và ESLint file sửa đạt.
- Năm bộ Jest mobile liên quan: 32/32 ca đạt. TypeScript, ESLint file sửa, Prettier và `git diff --check` đạt.
- Đây là kiểm thử mock và kiểm tra mã. `adb devices -l` không thấy thiết bị; chưa có ảnh Android, chưa kiểm tra tắt Wi-Fi/4G, đóng/mở app hoặc mạng thực tế.
- Backend production chưa triển khai tham số đối chiếu, mobile chưa phát hành. Cần triển khai backend cùng bản app khi người dùng chốt cập nhật.
