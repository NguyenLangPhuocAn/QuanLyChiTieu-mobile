# Gọn form trả hóa đơn và chọn giao dịch đã trả — 03/11/2026

Android emulator `emulator-5554`, app QA local `com.mobile.dev` từ Metro 8081. Dữ liệu trong ảnh thuộc tài khoản thử QA; không dùng APK production cũ làm bằng chứng.

1. Mở Hóa đơn định kỳ → Tạo giao dịch từ kỳ FPT. Form Thêm giao dịch mở với Chi, số tiền, danh mục, ví; không còn dòng “Từ lịch ... Kiểm tra ...” dưới tiêu đề. Ảnh/XML `01-form-without-note`.
2. Đóng form, bấm Chọn giao dịch đã trả. App gọi API giao dịch của tài khoản đang đăng nhập; mặc định lọc khoản chi 30 ngày gần đây có số tiền trong khoảng của lịch. Tài khoản QA chỉ hiện hai khoản 300.000đ (#47 ngày 03/11 và #35 ngày 31/10); không còn dòng mô tả dài. Ảnh/XML `02-picker-recent`.
3. Bấm Xem giao dịch khác: các khoản chi khác từ lịch sử tài khoản mới xuất hiện; chưa chọn hoặc liên kết khoản nào. Ảnh/XML `03-picker-all-on-request`.

Kiểm thử tự động kiểm tra lọc theo ngày/số tiền, mở rộng theo yêu cầu, xem trước/xác nhận và không ghi tiền khi chỉ xem danh sách. Phiên này không tạo hoặc sửa giao dịch/số dư. Cần kiểm tra thêm trên điện thoại thật với tài khoản người dùng thực tế.
