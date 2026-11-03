# Hóa đơn định kỳ dùng form giao dịch chuẩn — 03/11/2026

Thiết bị: Android emulator `emulator-5554`, ứng dụng local `com.mobile.dev` từ Metro 8081, tài khoản QA BASIC. Không dùng APK production để kiểm tra mã mới.

1. Mở Tài khoản → Hóa đơn định kỳ → kỳ FPT chưa trả → Tạo giao dịch. Màn Main mở form **Thêm giao dịch** hiện có, loại Chi; có ô số tiền, thẻ danh mục, danh sách ví ngang và ngày giao dịch. Kỳ biến thiên để trống số tiền. Quay về không tạo giao dịch. Ảnh `01-standard-form.png`.
2. Mở tab Lịch đã tạo. Lịch FPT vẫn là một thẻ ngắn có Chi tiết/Tạo giao dịch; không có khối “Gợi ý từ khoản chi cũ”. Ảnh `02-bill-list.png`.
3. Bấm Chi tiết. Trang riêng hiện lịch, kỳ chưa trả, các kỳ đã xử lý và quản lý lịch. Nút Xóa có viền bo góc và chữ đỏ. Ảnh `03-detail-page.png`.

Tài khoản QA không có danh mục chi nên không xác nhận chọn danh mục trên thiết bị này; kiểm thử `RecurringBillsScreen.test.tsx` xác nhận danh mục chi được chọn/lưu và bỏ danh mục thu. `MainScreenDrafts.test.tsx` xác nhận lịch có danh mục sẽ điền sẵn vào form chuẩn, xem trước không ghi tiền và xác nhận mới tạo một giao dịch. `RecurringBillDetailScreen.test.tsx` xác nhận trang riêng và nút Xóa cần xác nhận. `payRecurringBill.test.ts` xác nhận kiểm tra kỳ trước khi ghi và mã chống trùng. Không bấm xác nhận tạo giao dịch trong lượt UI này; không thay số dư QA. Chưa thử trên điện thoại thật và chưa phát hành APK mới.
