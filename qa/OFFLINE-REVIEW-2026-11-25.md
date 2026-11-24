# Rà soát offline và kiểm thử — 25/11/2026

Đối chiếu theo [ma trận offline](OFFLINE-CAPABILITY-AUDIT-2026-11-16.md) và yêu cầu mở rộng đã chốt ngày 20/11. “Có mã” chỉ mô tả mã nguồn hiện tại; không thay cho xác nhận trên điện thoại thật hoặc bản APK đang phát hành.

## Phần đã có mã

| Nhóm | Thao tác khi mất API | Bằng chứng và giới hạn |
| --- | --- | --- |
| Thu/Chi, widget | Xem dữ liệu đã tải; thêm/sửa/xóa Thu/Chi có hàng chờ, xem trước và chống trùng; ảnh hóa đơn có kho lưu riêng | Đã có lượt Android emulator/API QA cho các ca cơ bản và mất phản hồi trong ma trận. Chưa lặp cold start APK độc lập khi tắt cả Wi-Fi/4G trên điện thoại thật. |
| Danh mục, Ví | Xem bản đã tải; thêm/sửa/xóa metadata qua hàng chờ, đối chiếu khi nối lại | Đã có lượt emulator/API QA ở ma trận. Ví tạm không được dùng để ghi tiền trước khi đồng bộ. Sửa số dư/chuyển tiền chưa offline. |
| Ngân sách | Xem bản đã tải; tạo/sửa/xóa qua hàng chờ | Mới qua kiểm thử mã; backend migration chưa áp dụng production. Tạo kỳ mới còn cần mạng. |
| Mục tiêu tiết kiệm | Xem bản đã tải; sửa tên, mục tiêu, ngày, ghi chú | Mới qua kiểm thử mã; góp/rút vẫn cần mạng. |
| Vay/Nợ | Xem bản đã tải; tạo khoản có xem trước, hàng chờ, mã chống trùng; sửa tên người, ngày hẹn, ghi chú | Mới qua kiểm thử mã. Khoản tạo chờ hiển thị tách khỏi danh sách đã ghi. Thanh toán/xóa vẫn cần mạng. |
| Lịch hóa đơn, lịch tiền, quy tắc thông minh | Dữ liệu cục bộ; lịch và quy tắc có tạo/sửa/xóa trên máy | Có lượt emulator cho lịch tiền/quy tắc ở ma trận; lịch hóa đơn và nhắc Android chưa thử trọn luồng offline. Lịch không tự coi là đã thanh toán. |
| Lịch sử, báo cáo, chi an toàn | Đọc/tính từ dữ liệu đã tải, có cảnh báo phạm vi và thời điểm | Kết quả có thể thiếu dữ liệu chưa tải; xuất báo cáo cần API. |

## Chưa đạt yêu cầu “toàn app offline”

1. Tạo/xóa mục tiêu tiết kiệm, góp/rút tiền; thanh toán/xóa Vay/Nợ; đổi tiền gốc/Ví của khoản đã mở.
2. Chuyển tiền giữa Ví, sửa số dư Ví, tạo kỳ Ngân sách kế tiếp và luồng đánh dấu trả hóa đơn gắn với giao dịch khi mất mạng.
3. OCR/AI, nhập Excel và backup chưa có bằng chứng trọn luồng khi mất mạng; không quảng cáo là hoạt động offline.
4. Đăng nhập tài khoản mới hoặc đổi tài khoản cần xác thực online. Chưa xác nhận khởi động lạnh standalone khi tắt cả Wi-Fi/4G trên điện thoại thật.
5. Mã backend/migration cho một số hàng chờ chưa triển khai production; bản APK đang phát hành chưa chứa các thay đổi mới.

## Lượt kiểm tra hiện tại

- Phát hiện khoản Vay/Nợ mới còn chờ nằm dưới bộ lọc trạng thái “Đã thanh toán”, dễ khiến người dùng hiểu nhầm đã ghi tiền. Đã chuyển sang khu “Chờ đồng bộ” riêng phía trên bộ lọc, ghi rõ chưa đổi số dư và có nhãn truy cập.
- Jest màn Vay/Nợ: 4/4 ca đạt, gồm trường hợp khoản chờ vẫn hiện riêng khi lọc khoản đã thanh toán. TypeScript và ESLint các file sửa đạt.
- Build **debug tách riêng** với `QA_ISOLATED_APP=true` thành công; không ký/phát hành bản production.
- Ba lượt thử trên hai cấu hình Android emulator không hoàn tất boot/ADB package service. Không cài app, thao tác UI, chụp ảnh hay tuyên bố Android đã đạt trong lượt này. Tiến trình emulator và Metro/API QA local đã được dừng; server production không đổi.

## Ca cần chạy tiếp trên thiết bị

- Mỗi nhóm ghi: mất mạng trước xác nhận, mất phản hồi sau khi server ghi, force-stop/mở lại, đổi tài khoản, hai bản cùng sửa, chọn máy/chủ/để sau, thử gửi lại và kiểm database không trùng.
- Thu/Chi có ảnh: chụp/chọn ảnh, lưu offline, mở lại, nối mạng và xác nhận ảnh đi cùng đúng giao dịch.
- Widget: tạo Thu và Chi với Danh mục mới, nhiều widget cùng lúc, giữ chọn sau ánh xạ ID tạm; thử radio tắt thực sự.
- Vay/Nợ: tạo từ hai form, kiểm khoản chờ tách khỏi bản đã ghi; ví đổi/xóa sau xem trước phải dừng; số dư chỉ đổi một lần sau xác nhận.
