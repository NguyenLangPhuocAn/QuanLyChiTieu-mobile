# QA Android: màn Tài khoản

- Ngày thử: 11/11/2026.
- Máy: Android emulator `emulator-5554`, app QA `com.mobile.dev` chạy source local qua Metro, tài khoản QA và backend cổng 3303. Không dùng APK production.
- Cấu hình API QA chỉ dùng tạm khi thử, đã hoàn nguyên; không thay server ổn định.

## Trước và sau

1. Mở tab **Tài khoản**. `01-top-before.png` cho thấy nút đăng xuất trùng ở góc phải. `02-top-after.png` xác nhận nút này đã biến mất; nút **Đăng xuất** chính vẫn ở cuối trang.
2. Cuộn đến cuối. `03-bottom-before.png` cho thấy nền hồng đỏ của **Xóa tài khoản**. `04-bottom-after.png` xác nhận nền trắng, viền theo theme; chữ và biểu tượng vẫn đỏ để phân biệt thao tác nguy hiểm.
3. Nhấn **Xóa tài khoản**: hộp xác nhận xuất hiện. Nhấn **Hủy**: trở lại màn Tài khoản, tài khoản QA vẫn đăng nhập. Không thực hiện xóa.
4. Kiểm tra dòng chữ dài trong danh sách cài đặt không đè lên mũi tên phải sau khi giới hạn vùng nội dung.

## Kiểm tra mã

- `npx eslint src/screens/home/AccountScreen.tsx`: đạt.
- `npx tsc --noEmit`: đạt.

Ảnh là ảnh chụp trực tiếp từ giả lập, chứa dữ liệu tài khoản QA. Chưa phát hành APK mới; cần kiểm tra trên điện thoại thật trong đợt phát hành kế tiếp.
