# Vay/Nợ từ widget — 30/10/2026

## Phạm vi và môi trường

Source com.mobile.dev, Pixel3a Android13 API33 emulator-5554. Native debug đã có sẵn, không rebuild APK/native trong đợt này. Runtime được chuyển thực sự tới 10.0.2.2:8082, API3302; chỉ MySQL QA riêng và QA8/wallet8. Mini N+1×1 giữ duy nhất trên launcher. Không sửa server ổn định3000, .env, website hoặc release.

Lệnh dừng QA3301 bị automatic approval review từ chối (blocked by policy). Không dừng lại bằng cách khác: giữ nguyên QA3301/Metro8081, mở QA3302/Metro8082 riêng. Sau đổi backend phát hiện isRestoringSession không kết thúc; ca kiểm thử tái hiện thất bại trước sửa rồi đạt sau thêm kết thúc restore trong clearSession.

## Các bước thực tế

1. 00–09 là chẩn đoán chuyển Metro và loading lỗi, không tính là form đạt. ADB reverse không đủ vì host native còn8081; 04–05 đổi Bundle Location8082. 10–17 đăng nhập lại QA8 sau sửa Auth; 14 mật khẩu hoàn toàn dạng chấm, không có mật khẩu/token trong bằng chứng.
2. 18 chỉ có mini, 19 mở ba loại Chi/Thu/Vay-Nợ, 20 chọn Vay. 21–28 nhập100.000, Widget Vay QA, hẹn30/11, chủ động chọn Ví tiền mặt. 29 xem trước +100.000 VND đúng người/ví/ngày. sql-before:0loan, tx27 chi25k, ví975000; xem trước không ghi tiền.
3. 30–31 lưu xong về launcher. sql-borrowed:loan1/BORROWED liên kết tx28 +100000, due2026-11-30, ví1075000.
4. 32–40 mở lại mini, chọn Vay/Nợ → Cho vay, nhập50.000, Widget Cho vay QA, chọn Ví tiền mặt, để ngày hẹn trống. 41 xem trước −50.000 VND. 42 là frame đang lưu, không gọi là thành công; 43 đã về launcher. sql-lent:loan2/LENT liên kết tx29 −50000, ví1025000.
5. Script widget-loan-qa.cjs final --replay đăng nhập QA trong bộ nhớ, gửi đồng thời hai lần cùng mã cho từng khoản: trả cùng ID1/1 và2/2. Đổi số tiền cùng mã trả409, bỏ mã trả400. sql-final chứng minh số hàng/giao dịch/số dư không đổi. Categories LOAN_DEBT tách NORMAL. Script lần đầu sai đường login /auth/login nên chưa chạy replay; sửa helper thành /users/login, lần cuối đạt, không sửa dữ liệu để ép kết quả.
6. 44–45 mở lại form Vay/Nợ rỗng cho người dùng xem, không tạo thêm giao dịch. Tên, ví, ngày/tiền vẫn phải kiểm tra trước lưu.

## Kiểm tra tự động

- Mobile107/107 qua13suite; bao gồm kiểm tra cả Vay/Cho vay, xem trước, lỗi giữ form, retry cùng mã, offline không POST, ví/ngày/người/tiền sai và restore khác backend. TypeScript và ESLint đạt.
- Backend21/21 qua2suite; bao gồm replay, xung đột nội dung, race unique và bắt buộc key qua route mới. TypeScript/ESLint đạt. Không gọi đây là kiểm thử toàn bộ backend.
- Log cuối và ca Auth trước sửa được lưu kèm. SHA256SUMS kiểm nguyên ảnh/XML và log. Không có native test/build mới trong đợt này.

## Giới hạn

Vay/Nợ cần mạng, không đưa vào hàng chờ Thu/Chi. Lỗi lưu giữ form, không thay ví tự động. Chưa trả nợ/thu hồi nợ trong popup, chưa kiểm điện thoại thật/OEM hoặc AI OCR/giọng nói thật. Backend mới cần triển khai trước APK thật hỗ trợ route này; hiện chỉ source/QA, không phát hành/deploy. Full widget launcher vẫn có chọn Thu/Chi, cả hai loại widget đều mở popup có Vay/Nợ.
