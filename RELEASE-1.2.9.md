# Sổ Thu Chi Nova 1.2.9

**Android versionCode 14 · cập nhật tùy chọn**

## Có gì mới

- Widget đầy đủ trên màn hình chính chọn được danh mục Thu/Chi đã lưu, chọn ví và xem lại giao dịch trước khi xác nhận. Có thể để giao dịch chưa phân loại khi cần.
- Hóa đơn định kỳ có bộ lọc kỳ 7, 30, 90 ngày hoặc 1 năm; kỳ quá hạn vẫn hiện. Bộ lọc Đã trả dùng ngày thanh toán, có lựa chọn xem tất cả kỳ cũ.
- Khi mất kết nối, form lịch hóa đơn dùng danh mục đã lưu trên máy; có thể tạo lịch với danh mục Chi thay vì buộc để chưa phân loại.
- Cải thiện hàng chờ Thu/Chi ngoại tuyến: một lần kết nối lại có thể tiếp tục các bản nháp còn lại nếu đợt đồng bộ trước chỉ ghi được một phần.
- Đồng nhất cách lưu dữ liệu lịch và kế hoạch khi app đổi sang địa chỉ API dự phòng; tinh gọn bố cục các mục trong Tài khoản.

## Kiểm tra

- Mã local trên Android QA: widget và form trong app tạo hai bản nháp khi backend QA ngắt. Sau nối lại, mỗi giao dịch được ghi đúng một lần và hàng chờ trở về 0. Form hóa đơn dùng danh mục cache khi backend ngắt. [Biên bản và ảnh](qa/evidence/2026-11-11-offline-matrix/README.md).
- 101 bộ kiểm thử, 659/659 ca đạt; TypeScript đạt. ESLint không có lỗi mã nguồn; hai cảnh báo chỉ ở báo cáo do Gradle sinh ra.

## Cần thử trên điện thoại thật

- Sau cài đặt, mở app khi mất mạng, thử widget và giao dịch Thu/Chi, rồi nối lại và kiểm tra mỗi khoản chỉ xuất hiện một lần. Bản debug QA cần Metro nên không chứng minh được khởi động nguội hoàn toàn ngoại tuyến của APK đã ký.
- OCR/AI, chatbot, đăng nhập Google lần đầu và dịch vụ máy chủ cần kết nối; phần thông báo ACB/VCB bằng AI cần thử bằng thông báo thật và xem lại bản nháp trước khi lưu.

Trang quảng bá tải APK không thay đổi trong đợt này.
