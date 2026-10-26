# Hóa đơn định kỳ — kiểm tra source 26/10/2026

Lối vào: Tài khoản → Hóa đơn định kỳ. Phạm vi hiện tại là lịch và theo dõi thanh toán local; chưa có nhắc hạn Android cho từng hóa đơn, API lịch trên backend hoặc APK mới.

## Kết quả tự động

- `jest --runInBand recurringBills.test.ts RecurringBillsScreen.test.tsx financialPlanning.test.ts App.test.tsx`: **46/46 qua 4 bộ**. Trong đó 31 kiểm thử domain/storage, 7 kiểm thử màn hình và 8 hồi quy App/financialPlanning.
- `tsc --noEmit`: đạt. ESLint các file đổi với `--max-warnings 0`: đạt.
- Ngày 31 qua tháng 2 rồi trở lại 31/3; 29/2 trở lại vào năm nhuận; tuần qua ranh giới tháng/năm; ngày/tiền không hợp lệ.
- Lưu đồng thời không mất lịch, khóa chống trùng tên/chu kỳ/ngày/tiền tệ; một transaction không dùng cho hai kỳ ngay cả khi ghi đồng thời. Gửi lại cùng liên kết không thêm bản thứ hai.
- Bỏ qua một kỳ không đổi các kỳ sau; pause/resume giữ ngày gốc, không bỏ âm thầm kỳ cũ. Giữ lịch sử sau xóa lịch, cho gỡ liên kết qua Mở lại kỳ.
- Theo tài khoản và địa chỉ backend; dữ liệu hỏng không bị reset/ghi đè. Lưu lỗi không làm mất nội dung và không làm hỏng hàng đợi sau đó.
- Màn hình double tap không tạo trùng; xem trước trước khi liên kết, nêu rõ tiền thực tế khác dự kiến; không gọi create/update transaction. Đóng picker bỏ kết quả muộn và không áp dụng xác nhận cũ; hỗ trợ số thập phân USD nhập bằng dấu phẩy.
- Lần chạy UI đầu timeout 5 giây; đặt giới hạn riêng bộ UI 20 giây. Lần chạy cuối cả 4 bộ đạt trong khoảng 20 giây. Provider/API giao dịch là mock trong các kiểm thử màn hình; không đo tốc độ mạng thật.

## Cách thử khi có bản local trên Android

- [ ] Tạo lịch tiền nhà ngày 31; đóng/mở app, xem các kỳ tháng ngắn và năm nhuận.
- [ ] Thử tên dài, cỡ chữ hệ thống lớn, màn nhỏ, bàn phím số và chọn ngày; tên/tiền không bị cắt.
- [ ] Tạo lịch điện/nước có khoảng tiền; chọn khoản đã ghi có tiền thực tế khác dự kiến; xác nhận đúng ngày, loại Chi và tiền tệ.
- [ ] Hủy xác nhận phải giữ kỳ chưa trả. Xác nhận mới đánh dấu đã trả; số lượng giao dịch/số dư giữ nguyên.
- [ ] Thử cùng giao dịch cho kỳ khác, thử chọn khi mất mạng, tải hơn 40 giao dịch và tải hơn 20 kỳ.
- [ ] Bỏ qua, mở lại, tạm dừng/tiếp tục; kiểm tra kỳ cũ xuất hiện lại khi tiếp tục. Xóa lịch vẫn xem được kỳ đã xử lý và gỡ liên kết mà không xóa tiền.
- [ ] Chuyển tài khoản/đăng xuất khi đang tải; không rò dữ liệu hoặc áp dụng kết quả vào tài khoản khác.

## Giới hạn và việc tiếp theo

- Liên kết là bản chụp thông tin giao dịch đã chọn; chưa tự kiểm lại khi giao dịch gốc bị sửa hoặc xóa, chưa hỗ trợ trả nhiều lần cho một kỳ hoặc dùng một lần trả cho nhiều kỳ.
- Bộ chọn chỉ truy vấn khoản Chi thông thường, cùng tiền tệ, 31 ngày trước/sau kỳ; không tự đổi tiền tệ hoặc ghép vay/nợ/tiết kiệm. Trả quá sớm/muộn ngoài cửa sổ này chưa được hỗ trợ.
- Chưa có đồng bộ nhiều thiết bị hoặc đưa lịch vào backup/Excel. Các nghĩa vụ trong màn mới chưa được cộng vào công thức chi an toàn hoặc lịch tiền cũ; không nghiệm thu toàn P3.
- Không đổi backend/.env/DNS, không restart/deploy server, không build/ký/phát hành APK hoặc sửa trang tải trong đợt này.
