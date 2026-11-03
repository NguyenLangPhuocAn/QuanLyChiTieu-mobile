# Đã trả, chi tiết giao dịch và dự kiến 30 ngày — 03/11/2026

Android emulator `emulator-5554`, app QA `com.mobile.dev` từ source local/Metro 8081. Dữ liệu và ảnh thuộc tài khoản thử QA; không dùng APK production 1.2.6 làm bằng chứng cho mã mới.

1. Mở Lịch đã tạo: ngày hiện tại 03/11/2026, khung Dự kiến 30 ngày tới là 03/11–02/12/2026 và không có kỳ chưa trả đến hạn trong khoảng. FPT hàng quý có kỳ chưa trả 31/01/2027 ở bên dưới, ngoài khoảng 30 ngày. `01-upcoming-window.png/.xml`.
2. Trong Chưa trả, chọn giao dịch chi QA có sẵn #47 ngày 03/11/2026 cho kỳ FPT và xác nhận liên kết. Không tạo giao dịch tiền mới. Tab Đã trả hiển thị lịch FPT, dòng `Đã trả · 300.000 ₫ · 03/11/2026` không lộ ID. `02-paid-row.png/.xml`.
3. Chạm dòng Đã trả: app tải giao dịch hiện tại từ API và mở Chi tiết giao dịch của khoản chi 300.000 ₫, ngày 03/11/2026, ví hóa đơn quý QA. `03-transaction-detail.png/.xml`.

Giới hạn: đây là giả lập và tài khoản QA. Chưa xác nhận thao tác trên điện thoại thật, mạng di động hoặc khi giao dịch gốc đã bị xóa. Luồng lỗi giao dịch bị xóa được kiểm thử tự động; không điều hướng bằng bản ghi lịch cũ.
