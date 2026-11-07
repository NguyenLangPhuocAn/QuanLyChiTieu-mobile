# QA widget và lịch hóa đơn — 07/11/2026

## Môi trường

- Android emulator Pixel 3a API 33, ứng dụng QA cô lập `com.mobile.dev`, bản debug build từ mã local và Metro 8081.
- Backend QA cổng 3303, dữ liệu thử riêng; không dùng tài khoản hay giao dịch thật. Cấu hình API tạm đã khôi phục về giá trị repo sau khi thử.
- Ảnh PNG là ảnh chụp trực tiếp từ emulator. Không có APK production hoặc thay đổi server production trong lượt này.

## Widget

1. Widget đầy đủ trên màn hình chính hiển thị danh mục Chi đã chọn (`01-widget-expense-selected.png`). Mở bộ chọn Thu: có 5 danh mục Thu và tùy chọn Chưa phân loại (`02-widget-income-categories.png`).
2. Chọn Lương rồi mở Thêm giao dịch từ widget (`03-widget-entry.png`). Nhập Thu 1.234 đ, chọn ví QA (`04-widget-filled.png`). Xem trước hiện Thu, số tiền, ví và danh mục trước khi xác nhận (`05-widget-preview.png`).
3. Xác nhận một lần. Widget cập nhật sau lưu (`06-widget-saved.png`); API QA kiểm tra đúng một giao dịch Thu 1.234 đ với danh mục Lương và ví đã chọn.
4. Mở giao dịch ở Lịch sử, thêm ghi chú `QA_widget_edit`, lưu; Lịch sử hiển thị ghi chú mới (`07-widget-edit.png` chụp biểu mẫu sửa). Mở lại, bấm Xóa; hộp xác nhận hiện ra (`08-widget-delete-confirm.png`). Xác nhận xóa, giao dịch biến mất khỏi Lịch sử và tổng thu tháng trở về 0 đ. Widget không có nút sửa/xóa trực tiếp; thao tác này qua Lịch sử.

## Lịch hóa đơn

1. Từ Tài khoản > Hóa đơn định kỳ > Thêm lịch hóa đơn, form tải danh mục Chi, cho chọn Chưa phân loại hoặc danh mục cụ thể (`09-bill-create-categories.png`). Chọn Khác, nhập lịch tháng `QA_bill_widget_test` 50.000 đ, đến hạn 07/11/2026.
2. Lưu lịch: một kỳ Chưa trả và 50.000 đ xuất hiện trong Dự kiến 30 ngày tới (`10-bill-created.png`). Bấm Chi tiết mở trang riêng, có danh mục Khác và kỳ chưa trả (`11-bill-detail.png`).
3. Xóa lịch qua xác nhận; màn Chưa trả không còn lịch thử. Không tạo giao dịch thanh toán khi chỉ tạo hoặc xóa lịch.

## Kiểm tra mã

- `npx jest __tests__/RecurringBillsScreen.test.tsx __tests__/WidgetCategoryPicker.test.tsx __tests__/WidgetQuickEntry.test.tsx --runInBand --silent`: 58/58 đạt, 3 bộ.
- `npx tsc --noEmit` và ESLint cho các file TS/TSX sửa: đạt.
- Android debug QA build và cài trên emulator đã đạt trước khi chạy các bước trên. Chưa kiểm tra bằng điện thoại thật/OEM hoặc phát hành APK.
