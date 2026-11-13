# QA Android: gọn trang Tài khoản và Dữ liệu — 14/11/2026

- Máy thử: Android emulator `emulator-5554`, app QA `com.mobile.dev`, bundle local từ `qa/metro.local.cjs` cổng 8081 và tài khoản QA. Không dùng APK production.
- Mở tab Tài khoản: [màn chính](19-account-top.png). Dòng Dữ liệu và xuất nhập được đổi mô tả thành “Giao dịch chờ, xuất và nhập Excel” ([ảnh](22-account-data-row.png)).
- Vào Dữ liệu và xuất nhập: [ảnh sau sửa](23-data-after.png) cho thấy bốn khối Widget màn hình chính, Bản dữ liệu trên máy, Đồng bộ lịch giữa thiết bị và Sao lưu/khôi phục lịch không còn. Nút quay lại chỉ còn mũi tên, góc đối diện không có ô màu trống. Bản nháp ngoại tuyến, Backup cá nhân và nhập/xuất Excel vẫn hiện. [Ảnh trước sửa](../2026-11-13-offline-create-qa/34-data-empty-ready.png) có khối cũ và ô nền trống ở header.
- Vào Backup cá nhân từ trang Dữ liệu: [ảnh](24-backup-after.png) xác nhận header không còn ô nền trống; các nút sao lưu và xem trước vẫn hiện.
- Rà mã các trang có cùng placeholder lấy nhầm kiểu nút quay lại: Dữ liệu, Backup cá nhân, Trung tâm tài chính và Chi tiết ngân sách đã dùng spacer trong suốt. Profile, Thông báo, Danh mục và Quy tắc thông minh vốn dùng spacer không màu.
- TypeScript và ESLint đạt. Chưa thử tương tác với file backup/Excel trong đợt chỉnh giao diện này; không phát hành APK hoặc thay backend production.
