# Tạo Vay/Nợ khi mất mạng — kiểm tra mã ngày 25/11/2026

## Phạm vi

- Hai form tạo Vay/Nợ xem trước tên người, số tiền, ví và ngày; khi phiên offline hoặc yêu cầu mất phản hồi, giữ khoản trên máy cùng mã yêu cầu cố định.
- Danh sách hiển thị khoản mới chờ riêng, chưa cộng vào số dư; màn đối chiếu tự động và nút đồng bộ thủ công đều cho xem số dư ví máy chủ trước/sau dự kiến.
- Chỉ khi người dùng chọn bản trên máy mới gửi. Ví bị đổi/xóa sau xem trước làm khoản tiếp tục chờ; gửi lại sau mất phản hồi giữ cùng mã chống trùng. Đổi tài khoản trong lúc tải ví dừng trước yêu cầu tạo khoản.

## Bằng chứng chạy

- `npx tsc --noEmit`: đạt.
- ESLint trên các file sửa: đạt.
- Sáu bộ Jest liên quan: 76/76 ca đạt, gồm thử mất phản hồi, số dư ví đổi sau xem trước, ví biến mất, đổi tài khoản và cả hai đường đối chiếu.
- Toàn mobile: 118/118 bộ, 773/773 ca Jest đạt.
- `adb devices`: không có thiết bị kết nối. Chưa chạy luồng Android bằng bản mã này, chưa có ảnh màn hình gốc; không coi kiểm thử mock là xác nhận trên thiết bị.

## Cần thử khi có thiết bị

1. Đăng nhập khi có mạng, tải Ví, mở hai form tạo; tắt Wi-Fi và dữ liệu di động, tạo khoản sau màn xem trước, tắt mở app, xác nhận khoản chờ còn nguyên và ví chưa đổi.
2. Nối mạng khi app đang mở: xem màn đối chiếu, chọn Để sau rồi mở lại; chọn bản máy để ghi một lần; kiểm tra khoản và số dư trên máy chủ.
3. Lặp với phản hồi bị mất sau khi server đã ghi, cùng mã yêu cầu chỉ được một khoản; thử ví bị sửa/xóa và đổi tài khoản trước lúc gửi.

Không build, ký hoặc phát hành APK và không thay server production trong lượt này.
