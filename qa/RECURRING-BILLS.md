# Hóa đơn định kỳ — kiểm tra source 26/10/2026

Lối vào: Tài khoản → Hóa đơn định kỳ. Phạm vi hiện tại là lịch và theo dõi thanh toán local; chưa có nhắc hạn Android cho từng hóa đơn, API lịch trên backend hoặc APK production mới. Ngày 26/10 đã cài bản debug riêng `com.mobile.dev` để thử source qua Metro local.

## Kết quả tự động

- `jest --runInBand recurringBills.test.ts RecurringBillsScreen.test.tsx financialPlanning.test.ts App.test.tsx`: **50/50 qua 4 bộ**. Trong đó 31 kiểm thử domain/storage, 11 kiểm thử màn hình và 8 hồi quy App/financialPlanning. Lần cuối 21,771 giây.
- `node --test qa/metro.local.test.cjs`: **2/2**, xác nhận cấu hình QA local không thay cấu hình production.
- `tsc --noEmit`: đạt. ESLint các file đổi với `--max-warnings 0`: đạt.
- Ngày 31 qua tháng 2 rồi trở lại 31/3; 29/2 trở lại vào năm nhuận; tuần qua ranh giới tháng/năm; ngày/tiền không hợp lệ.
- Lưu đồng thời không mất lịch, khóa chống trùng tên/chu kỳ/ngày/tiền tệ; một transaction không dùng cho hai kỳ ngay cả khi ghi đồng thời. Gửi lại cùng liên kết không thêm bản thứ hai.
- Bỏ qua một kỳ không đổi các kỳ sau; pause/resume giữ ngày gốc, không bỏ âm thầm kỳ cũ. Giữ lịch sử sau xóa lịch, cho gỡ liên kết qua Mở lại kỳ.
- Theo tài khoản và địa chỉ backend; dữ liệu hỏng không bị reset/ghi đè. Lưu lỗi không làm mất nội dung và không làm hỏng hàng đợi sau đó.
- Màn hình double tap không tạo trùng; xem trước trước khi liên kết, nêu rõ tiền thực tế khác dự kiến; không gọi create/update transaction. Đóng picker bỏ kết quả muộn và không áp dụng xác nhận cũ; hỗ trợ số thập phân USD nhập bằng dấu phẩy.
- Thêm hồi quy giữ bản nháp/picker khi refresh token cùng tài khoản, xóa form khi đổi tài khoản thực sự, và lỗi mạng có thử lại nhưng không báo rỗng sai. Hai hồi quy refresh thất bại trước sửa, đạt sau sửa.
- Provider/API trong Jest là mock. Luồng Android dưới đây chạy backend local/MySQL thật riêng; không gộp hai loại bằng chứng hoặc dùng để khẳng định tốc độ trên điện thoại thật.

## Đã thử trực tiếp trên Android emulator

[Biên bản và 97 ảnh gốc từng bước](evidence/2026-10-26-recurring/README.md). Android 13/API 33, Pixel 3a 1080×2220, app debug tách riêng và source Metro; đăng nhập qua UI bằng tài khoản QA. API là source Nest hiện tại, MySQL schema mới riêng, không mock HTTP trong luồng này.

- Tạo lịch tiền nhà 3.000.000đ ngày 31/10, quan sát 30/11 rồi trở lại 31/12. Tạo lịch điện biến thiên 250.000–400.000đ.
- Chọn giao dịch đã ghi; xem trước khác tiền dự kiến (3.100.000đ), hủy giữ chưa trả, xác nhận mới đánh dấu đã trả. Giao dịch 310.000đ nằm trong khoảng dự kiến.
- Chặn một giao dịch liên kết hai kỳ; tạm dừng/tiếp tục, bỏ qua/mở lại một kỳ, xóa lịch giữ lịch sử đã trả.
- Force-stop/mở lại giữ phiên và lịch/history. Cỡ chữ hệ thống 1,3 kiểm tra màn lịch và picker; đã trả font về mặc định 1,0.
- Bắt được picker tự đóng lúc token hết hạn: bỏ token khỏi React key, giữ khóa theo tài khoản/backend. Sau sửa picker vẫn mở, SQL ghi nhận tổng 4 lần rotation trong buổi thử.
- Sửa nút đóng editor thành vùng chạm tối thiểu 44dp nằm bên phải. Khi server QA ngừng, chỉ hiện lỗi tải; bật lại đúng QA server rồi bấm Thử tải giao dịch trả về đủ hai khoản.
- SQL trước/sau: đúng hai ID, số tiền/nội dung cũ và số dư **6.590.000đ**. Không phát sinh giao dịch tiền từ các thao tác liên kết.
- `:app:installDebug -PQA_ISOLATED_APP=true` đạt; bản production cũ `com.mobile` 1.2.3/code8 còn nguyên. Đây không phải kiểm thử trên điện thoại vật lý, không phát hành bản mới.

## Cách thử khi có bản local trên Android

- [x] Emulator: tạo ngày 31, tháng 11/12 và đóng/mở app. Năm nhuận đã có unit test, chưa thao tác đổi lịch tới năm nhuận trên thiết bị.
- [ ] Thử tên dài, cỡ chữ hệ thống lớn, màn nhỏ, bàn phím số và chọn ngày; tên/tiền không bị cắt.
- [ ] Tạo lịch điện/nước có khoảng tiền; chọn khoản đã ghi có tiền thực tế khác dự kiến; xác nhận đúng ngày, loại Chi và tiền tệ.
- [x] Emulator: hủy/xác nhận và đối chiếu database QA thật; số lượng giao dịch/số dư giữ nguyên.
- [ ] Thử cùng giao dịch cho kỳ khác, thử chọn khi mất mạng, tải hơn 40 giao dịch và tải hơn 20 kỳ.
- [x] Emulator: bỏ qua/mở lại kỳ chưa trả, tạm dừng/tiếp tục, xóa lịch còn lịch sử. Gỡ liên kết kỳ đã trả sau archive hiện mới được kiểm thử tự động.
- [ ] Chuyển tài khoản/đăng xuất khi đang tải; không rò dữ liệu hoặc áp dụng kết quả vào tài khoản khác.

## Giới hạn và việc tiếp theo

- Liên kết là bản chụp thông tin giao dịch đã chọn; chưa tự kiểm lại khi giao dịch gốc bị sửa hoặc xóa, chưa hỗ trợ trả nhiều lần cho một kỳ hoặc dùng một lần trả cho nhiều kỳ.
- Bộ chọn chỉ truy vấn khoản Chi thông thường, cùng tiền tệ, 31 ngày trước/sau kỳ; không tự đổi tiền tệ hoặc ghép vay/nợ/tiết kiệm. Trả quá sớm/muộn ngoài cửa sổ này chưa được hỗ trợ.
- Chưa có đồng bộ nhiều thiết bị hoặc đưa lịch vào backup/Excel. Các nghĩa vụ trong màn mới chưa được cộng vào công thức chi an toàn hoặc lịch tiền cũ; không nghiệm thu toàn P3.
- Không đổi backend/.env/DNS hoặc server ổn định, không build/ký/phát hành APK production hoặc sửa trang tải. Chỉ build/cài debug local và bật/tắt tiến trình backend QA riêng để thử mất kết nối.
