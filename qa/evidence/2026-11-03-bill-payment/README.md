# Tạo giao dịch và trả hóa đơn — Android QA, 03/11/2026

- Thiết bị: Android 13 giả lập, ứng dụng phát triển `com.mobile.dev` chạy mã local qua Metro. Tài khoản và ví QA riêng, API QA qua ADB reverse cổng 3303; không dùng APK production hay tài khoản người dùng.
- Lịch thử: Thanh toan FPT Internet, kỳ 31/01/2027, khoảng 300.000–330.000đ. Tài khoản QA là BASIC; API trả danh sách danh mục chi rỗng. Luồng mới cho phép chi chưa phân loại, không tự tạo danh mục Premium.
- `01-bill.png`: nút **Tạo giao dịch và trả** xuất hiện bên cạnh **Chọn giao dịch đã trả**; trang Hóa đơn định kỳ không còn nút sao lưu/khôi phục.
- `02-entry.png`: chọn ví, thấy thông báo chưa có danh mục; chưa có thao tác ghi tiền. `03-filled.png`: nhập 300.000đ, vẫn ở form.
- `04-preview.png`: hộp xem trước nêu ví, số tiền, ngày, kỳ, chưa phân loại và tác động lên số dư. Chưa xác nhận vẫn chưa tạo giao dịch.
- `05-confirmed.png`: sau khi bấm **Tạo và trả**, app báo tạo giao dịch chi #47 và liên kết kỳ. `06-no-pending.png`: kỳ không còn ở tab Chưa trả. `07-paid.png`: tab Đã xử lý hiện giao dịch #47, 300.000đ, ngày 03/11/2026.
- `08-balance.png`: Tổng quan tải lại từ API QA hiển thị số dư 2.879.000đ và tổng chi tháng 300.000đ. Trước đó ảnh form QA `../2026-11-02-ai-default/01-form.png` hiển thị ví 3.179.000đ. Ảnh là kiểm tra UI/API, không phải đối chiếu SQL độc lập.
- Mỗi ảnh PNG có XML gốc cùng tên; `SHA256SUMS.txt` là hash của ảnh/XML. Ảnh lưu ở dữ liệu QA không có email hoặc tài khoản ngân hàng thật.

## Kiểm tra mã

- Jest toàn bộ: 645/645 qua 102 bộ. Test mới bao gồm kỳ đã xử lý/lịch thay đổi, không có danh mục, xem trước rồi mới xác nhận, xem trước cũ bị vô hiệu khi sửa tiền, retry sau lỗi lưu liên kết không tạo thêm giao dịch.
- Sau khi thêm ca kiểm tra mất hiệu lực khi app ra nền, 23/23 ca tập trung qua ba bộ; `npx tsc --noEmit --incremental false` và ESLint các file thay đổi đạt.

## Giới hạn

- Chưa thử trên điện thoại vật lý hoặc APK phát hành. Đây là một giao dịch QA thật trong dữ liệu thử, không phải giao dịch của người dùng.
- Nếu mạng đứt sau khi máy chủ đã tạo chi nhưng trước khi lưu liên kết trên máy, app dùng lại mã chống trùng và cho liên kết lại; nhánh này đã được thử bằng Jest, chưa gây lỗi mạng thật trên Android.
