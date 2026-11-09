# Ghi chú thay đổi — bản kế tiếp (nháp)

Sau [bản 1.2.8](RELEASE-1.2.8.md):

- Hóa đơn định kỳ có bộ lọc kỳ Chưa trả theo 7, 30, 90 ngày hoặc 1 năm; kỳ quá hạn luôn hiện. Kỳ Đã trả lọc theo ngày thanh toán với cùng các mốc và tùy chọn Tất cả. Lịch đã tạo vẫn hiển thị toàn bộ, còn tổng Dự kiến đổi theo mốc đã chọn và từ khóa tìm kiếm.
- Rút gọn phần đầu màn Hóa đơn định kỳ và mô tả lời nhắc để giao diện gọn, đồng bộ với các thẻ và nút hiện có. Màn trống ghi rõ không có kỳ trong mốc đang chọn.
- Emulator QA xác nhận mốc 7 ngày chỉ có kỳ 09/11, còn 90 ngày có thêm kỳ 09/12 và 09/01. Tổng Dự kiến đổi từ 1.000 đ/1 kỳ sang 3.000 đ/3 kỳ; lịch thử đã được xóa sau khi chụp [ảnh QA](qa/evidence/2026-11-09-recurring-period-filters/README.md). 67/67 ca tập trung, TypeScript và ESLint đạt.
- Widget đầy đủ trên màn hình chính tải lại danh mục khi cần và cho phép bỏ danh mục đã chọn. Người dùng vẫn xem trước, chọn ví và xác nhận giao dịch Thu/Chi trước khi lưu.
- Lịch hóa đơn cho phép để Chưa phân loại, kể cả khi tải danh mục lỗi; có nút thử lại. Danh mục đã chọn được kiểm tra trước khi lưu lịch.
- Trên emulator QA đã thử tạo giao dịch từ widget, sửa/xóa qua Lịch sử; tạo lịch tháng có danh mục Chi, xem trang chi tiết và xóa lịch. Ảnh/bước thử ở [biên bản QA](qa/evidence/2026-11-07-widget-bill-categories/README.md).
- 58/58 ca kiểm thử tập trung, TypeScript và ESLint đạt. Chưa phát hành APK production hoặc thay trang web tải APK trong đợt này.
