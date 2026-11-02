# Hóa đơn định kỳ: nhắc theo ngày và sửa trong hộp — Android QA, 03/11/2026

- Thiết bị Android 13 giả lập, ứng dụng `com.mobile.dev` chạy mã local qua Metro; lịch FPT và ví là dữ liệu QA. Không dùng APK production hoặc tài khoản thật.
- `01-reminder.png`/XML: lời nhắc đã bật, chỉ hiện **Ngày nhắc tới: 27/4/2027**; không còn chọn giờ, `20:00`, ghi chú pin hay lời dẫn lưu riêng trên máy. Nội bộ Android vẫn đặt lịch thông báo theo ngày; ảnh không chứng minh thông báo thực tế đã phát vào ngày đó.
- `02-edit-modal.png`/XML: bấm Sửa lịch mở hộp ở giữa màn hình, không cuộn trang nền lên đầu. Ngày đến hạn đầu tiên là **31/01/2027**, không còn hiển thị mốc gốc năm 2026 hay ô sửa mã tiền tệ. Tiền tệ cho lịch tạo tay mới lấy từ cài đặt tài khoản; lịch cũ giữ tiền tệ đã lưu để không đổi nghĩa số tiền.
- `03-edit-scroll.png`/XML: cuộn nội dung trong hộp vẫn thấy tiêu đề/Đóng và nút Lưu cố định; tiền, ghi chú vẫn sửa được. `04-saved.png`/XML: bấm Lưu không đổi dữ liệu, hộp đóng và lịch FPT vẫn bắt đầu từ 31/01/2027.
- Phần Dự kiến 30 ngày tới bỏ ghi chú dài và mã tiền tệ lặp lại; ô chọn giao dịch đã trả cũng bỏ mã tiền tệ trong câu dẫn. Không tạo hoặc sửa giao dịch tiền trong lượt QA này.

## Kiểm tra mã

- 35/35 ca tập trung qua 5 bộ, gồm nhắc chỉ hiện ngày, lịch sửa trong Modal, giữ ngày bắt đầu 2027 khi lưu và đổi ngày bắt đầu có cập nhật đúng chu kỳ.
- `npx tsc --noEmit --incremental false` và ESLint các file thay đổi: đạt. `SHA256SUMS.txt` chứa hash của PNG/XML gốc.

## Giới hạn

- Chưa thử nhắc hóa đơn ngoài app đúng ngày trên điện thoại thật/OEM. Chưa cập nhật APK, web tải hoặc backend production.
