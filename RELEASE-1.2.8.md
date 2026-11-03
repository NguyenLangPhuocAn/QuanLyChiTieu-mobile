# Sổ Thu Chi Nova 1.2.8 — ghi chú cập nhật

- Sửa cách đọc thông báo VCB có dạng “Số dư TK … +/− số tiền”: dấu `+` được điền là **Thu**, dấu `−` là **Chi**.
- Số dư tài khoản không được dùng làm số tiền giao dịch hoặc ghi chú. Ghi chú chỉ lấy nội dung sau **Ref** hoặc **Nội dung**; bỏ giờ và mã tham chiếu tự động ở cuối.
- App vẫn mở bản nháp để bạn kiểm tra số tiền, loại giao dịch, ví và danh mục trước khi lưu; không tự ghi tiền.

Kiểm thử: 649/649 kiểm thử mobile, TypeScript và ESLint đạt; 63/63 kiểm thử backend tập trung đạt. Backend thử nghiệm với Gemini thật nhận đúng mẫu VCB thu và chi, sau đó cập nhật backend chính và xác nhận `/health` nội bộ/qua tunnel. Cần thử lại thông báo VCB thật trên điện thoại sau khi cài APK mới.
