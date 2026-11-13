# Android QA: tạo giao dịch khi mất kết nối — 13/11/2026

## Môi trường

- Android emulator `emulator-5554`, app tách riêng `com.mobile.dev` lấy mã local từ Metro; API QA cổng `3304` qua ADB reverse `3303`, database/tài khoản QA riêng. Không dùng APK phát hành hay backend production.
- Gỡ riêng ADB reverse API để giả lập mất đường tới máy chủ, giữ Metro hoạt động; sau đó nối lại. Đây là thử mất API, không phải tắt Wi-Fi/4G thật.
- Trước khi tạo: QA server chỉ có giao dịch #2 chi 320.000 đ; ví QA 9.680.000 đ. Danh mục `Chi offline QA` được thêm chỉ trong database QA.

## Thao tác và kết quả

1. Điền khoản **Chi 6.000 đ** vào ví QA, danh mục `Chi offline QA`, ghi chú `Offline test expen`; ngắt API rồi lưu. App báo đã giữ bản nháp ([ảnh](06-create-after-tap.png)). QA server vẫn chỉ có #2 và ví 9.680.000 đ.
2. Trang Dữ liệu và xuất nhập hiển thị bản nháp -6.000 đ, có nút sửa/xóa ([ảnh](09-draft-visible.png)). Nối lại API, mở lại app: hộp đối chiếu ghi khoản Chi trên máy và chưa có bản tương ứng trên máy chủ ([ảnh](10-reconnect-review.png)).
3. Chọn **Dùng thay đổi trên máy**. QA server có đúng một giao dịch mới #54 chi 6.000 đ, đúng ví/danh mục/ghi chú; ví còn 9.674.000 đ. Sau mở lại app, Tổng chi tháng 11 là 6.000 đ ([ảnh](25-login-restored.png)); hàng chờ trên trang Dữ liệu rỗng ([ảnh](34-data-empty-ready.png)).
4. Lúc mới đồng bộ xong, trang Dữ liệu còn hiện bản nháp cũ cho tới khi mở lại ([ảnh](12-synced-draft-empty.png)). Đã sửa hàng chờ phát thông báo sau mỗi lần lưu và màn hình đăng ký nhận thay đổi; kiểm thử listener xác nhận thông báo lúc thêm, chuyển trạng thái và xóa. Chưa chụp lại trực tiếp màn hình đứng yên ngay sau đồng bộ với mã đã sửa.
5. Câu báo khi giữ bản nháp từng ghi “tự đồng bộ khi có mạng” ([ảnh](06-create-after-tap.png)), trái với bước chọn dữ liệu. Đã đổi thành hướng dẫn xem lại/xác nhận khi có mạng. Ảnh trên là ảnh trước khi sửa câu chữ.

## Giới hạn

Đã thử đóng/mở lại app **sau** đồng bộ; chưa thử khởi động app khi vẫn offline, mất Wi-Fi/4G trên điện thoại thật, đổi tài khoản giữa lúc có bản nháp, và ảnh hóa đơn đính kèm. Ảnh PNG và XML gốc từ emulator chỉ chứa dữ liệu QA.
