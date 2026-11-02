# Tên người trong Vay/Nợ — Android QA, 02/11/2026

- Dùng `com.mobile.dev` trên Android emulator, mã local từ Metro. Tài khoản QA đã đăng nhập. Mở **Thêm giao dịch → Vay/Nợ**; ở loại **Vay**, ảnh `04-borrowed.png` và UI XML tương ứng hiển thị **Tên người cho vay**.
- Chuyển sang **Cho vay**; ảnh `05-lent.png` và UI XML tương ứng hiển thị **Tên người vay**.
- Không nhập số tiền, không bấm Kiểm tra/Xác nhận và không ghi giao dịch. Đây là kiểm tra giao diện của form trong app; form Vay/Nợ riêng và widget được kiểm bằng test React Native, chưa chụp trên thiết bị thật.
- Jest `WidgetQuickEntry`, `LoanDebtFormScreen`, `MainScreenDrafts`: 64/64 ca đạt. TypeScript `--noEmit` và ESLint bốn file đổi: đạt. Không build/phát hành APK hoặc cập nhật backend/web.
