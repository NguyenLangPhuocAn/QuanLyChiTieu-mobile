# Xem trước và thử lại tạo Vay/Nợ — 24/11/2026

## Bước kiểm tra bằng mã

1. Trong form Vay/Nợ riêng và form Thêm giao dịch, nhập tên người, số tiền, ví; bấm lưu. Kiểm tra API chưa được gọi trước khi người dùng xác nhận bản xem trước.
2. Mô phỏng API nhận lệnh nhưng phản hồi bị mất. Giữ form, bấm lưu và xác nhận lại. Kiểm tra mã yêu cầu vẫn như lần đầu.
3. Sau phản hồi không rõ, đổi nội dung khoản rồi bấm lưu. Kiểm tra app chặn lệnh mới và hướng dẫn xem danh sách trước.
4. Kiểm tra các ca sửa Vay/Nợ và luồng giao dịch khác không bị ảnh hưởng.

## Kết quả và giới hạn

- Ba bộ Jest mobile liên quan đạt 43/43 ca; TypeScript, ESLint, Prettier và `git diff --check` đạt.
- `adb devices -l` không có thiết bị, nên chưa chạy app và chưa có ảnh chụp màn hình Android của mã mới.
- Đây là chống trùng khi gửi lại trong cùng form, chưa phải hàng chờ tạo Vay/Nợ offline qua lần tắt/mở app. Backend production và APK chưa cập nhật.
