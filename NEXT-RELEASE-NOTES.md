# Ghi chú thay đổi — bản kế tiếp (nháp)

Sau [bản 1.2.8](RELEASE-1.2.8.md):

- Widget đầy đủ trên màn hình chính tải lại danh mục khi cần và cho phép bỏ danh mục đã chọn. Người dùng vẫn xem trước, chọn ví và xác nhận giao dịch Thu/Chi trước khi lưu.
- Lịch hóa đơn cho phép để Chưa phân loại, kể cả khi tải danh mục lỗi; có nút thử lại. Danh mục đã chọn được kiểm tra trước khi lưu lịch.
- Trên emulator QA đã thử tạo giao dịch từ widget, sửa/xóa qua Lịch sử; tạo lịch tháng có danh mục Chi, xem trang chi tiết và xóa lịch. Ảnh/bước thử ở [biên bản QA](qa/evidence/2026-11-07-widget-bill-categories/README.md).
- 58/58 ca kiểm thử tập trung, TypeScript và ESLint đạt. Chưa phát hành APK production hoặc thay trang web tải APK trong đợt này.
