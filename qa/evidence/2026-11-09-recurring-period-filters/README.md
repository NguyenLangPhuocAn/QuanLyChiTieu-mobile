# QA bộ lọc kỳ hóa đơn — 09/11/2026

## Môi trường

- Android emulator Pixel 3a API 33, app debug QA cô lập `com.mobile.dev` từ Metro 8081, backend QA cổng 3303. Không dùng tài khoản hoặc server production.
- Cấu hình API tạm cho QA đã được khôi phục sau khi thử. Ảnh PNG là ảnh chụp trực tiếp từ emulator.

## Bước thử và kết quả

1. Đăng nhập tài khoản QA, mở Tài khoản > Hóa đơn định kỳ. Tạo lịch tháng `QA_filter_Nov9`, 1.000 đ, kỳ đầu 09/11/2026. Không tạo giao dịch thanh toán.
2. Tab Chưa trả, chọn 7 ngày: chỉ thấy kỳ 09/11/2026 (`02-pending-7-days.png`). Chọn 90 ngày: các kỳ tiếp theo xuất hiện; cuộn xuống thấy 09/12/2026 và 09/01/2027 (`03-pending-90-days.png`, `04-second-period-90-days.png`).
3. Tab Đã trả hiển thị nhãn Ngày đã trả và các mốc 7/30/90 ngày, 1 năm; tài khoản QA không có kỳ đã trả nên trạng thái trống là đúng (`05-paid-filter.png`). Ca kiểm thử tự động xác nhận lọc theo ngày giao dịch đã trả và giữ tùy chọn Tất cả.
4. Tab Lịch đã tạo vẫn liệt kê đầy đủ lịch, nhưng khung Dự kiến đổi theo mốc: 7 ngày có 1 kỳ/1.000 đ (`06-summary-7-days.png`); 90 ngày có 3 kỳ/3.000 đ (`07-summary-90-days.png`).
5. Mở Lịch đã tạo > Chi tiết rồi xóa lịch thử qua hộp xác nhận. Lịch thử không còn trong danh sách; không phát sinh giao dịch tiền.

## Kiểm tra mã

- Kiểm thử tập trung gồm bộ lọc màn hình, tổng dự kiến, nhắc hóa đơn, đồng bộ lịch và hàng chờ giao dịch ngoại tuyến: 67/67 ca qua 5 bộ. TypeScript `--noEmit` và ESLint các file sửa đạt.
- Chưa thử mạng di động/OEM hoặc thông báo nhắc đúng ngày trên điện thoại thật. APK production không được build/ký/phát hành trong lượt này.
