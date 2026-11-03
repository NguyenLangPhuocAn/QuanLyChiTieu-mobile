# Hóa đơn định kỳ: tìm kiếm, chi tiết và trạng thái — Android QA 03/11/2026

- Thiết bị: Android 13 giả lập, app `com.mobile.dev` nhận mã local qua Metro; tài khoản và ví QA riêng, API QA qua ADB reverse 3303.
- `01-saved-bill.png`: lịch FPT kỳ quý đã trả 31/01/2027, kỳ kế tiếp 30/04/2027 hiện **Chưa trả**, có nút **Tạo giao dịch** ngay trong **Lịch đã tạo**.
- `02-bill-details.png`, `03-bill-history.png`: bấm **Chi tiết** mới hiện kỳ đã trả, mã giao dịch #47, số tiền/ngày trả và các thao tác quản lý lịch. Ghi chú giao dịch không phải điều kiện ghép với lịch.
- `04-create-preview-entry.png`: từ lịch đã tạo mở đúng form **Tạo giao dịch và trả** cho kỳ 30/04/2027. Đóng form, không xác nhận hoặc ghi thêm tiền trong lượt QA này.
- `05-paid-auto-check.png`: tab **Đã xử lý** hiện **Đã trả** cho kỳ 31/01/2027 dù giao dịch #47 ngày 03/11/2026, trước hạn hơn 31 ngày; không còn cảnh báo sai về giới hạn ±31 ngày.
- `06-search.png`: nhập FPT vào ô tìm hóa đơn, lịch FPT vẫn hiện. Mỗi PNG có XML UI cùng tên; `SHA256SUMS.txt` lưu hash.

## Kiểm tra mã

- Jest toàn bộ 651/651 đạt ở lần chạy trước khi thêm ca kỳ quá hạn; ca mới và toàn bộ 18/18 ca màn lịch đạt ở lần chạy sau. Kiểm thử gồm tự đối chiếu khi mở Đã xử lý, trả trước hạn, ghi chú khác tên hóa đơn, tìm lịch, mở form từ kỳ ngoài 90 ngày và ưu tiên kỳ quá hạn.
- TypeScript, ESLint các file sửa và `git diff --check` đạt. CI phát hành run `41576516799` chạy lại TypeScript/toàn bộ Jest, build, kiểm tra chữ ký và tạo Release thành công.

## Giới hạn

- Ảnh chỉ kiểm tra trên Android giả lập với dữ liệu QA; chưa thử luồng này trên điện thoại thật. Mã đã phát hành trong APK 1.2.5 sau đó; không cập nhật server production trong đợt này.
- Trạng thái Đã trả xuất phát từ liên kết đã lưu; khi API không đối chiếu được, app giữ nguyên trạng thái và báo lỗi để thử lại, không tự coi là chưa trả.
