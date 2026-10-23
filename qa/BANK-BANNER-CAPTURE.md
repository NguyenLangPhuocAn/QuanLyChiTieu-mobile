# Đọc banner bằng phiên chụp màn hình — 23/10/2026

## Luồng source đã triển khai

1. Mở form giao dịch, bấm chuông → giải thích chia sẻ màn hình → cấp quyền hệ thống. Chưa chụp ảnh ở bước này.
2. Giữ app ở foreground; khi banner đang hiện, bấm chuông lần nữa → chụp frame mới, không dùng khay hoặc ảnh cũ.
3. Kéo khoanh trọn một banner → Đọc vùng đã chọn. ML Kit bundled đọc chữ cục bộ; xem ảnh crop/chữ, có thể sửa.
4. Kiểm tra kết quả → Điền vào giao dịch → chọn ví/danh mục và lưu. Nếu chưa rõ thì chọn lại vùng hoặc mở form nhập tay.
5. AI chỉ là nút tùy chọn khi local cần review. Xem chữ đã che, đồng ý gửi mỗi lần. Cờ server mặc định tắt; chưa deploy server mới. Không gửi ảnh.

Native: một virtual display cho mỗi consent; ImageReader đóng frame khi không có yêu cầu. Timeout nếu không có frame mới; không fallback sang listener. Phiên dừng khi rời app hoặc đóng form và có nút Dừng trong UI/notification. File PNG trong cache/bank-screen, dọn khi dừng hoặc lần khởi tạo sau tiến trình bị kill. Không có AccessibilityService.

## Bằng chứng tự động

- 57/57 kiểm thử mục tiêu qua 6 bộ (MainScreenDrafts, BankBannerReview, useBankBannerCapture, bankScreenExtraction, offlineTransactionQueue, bankNotificationSync).
- Bao gồm từ chối quyền, chưa chụp khi vừa đồng ý, click đúp, kết quả muộn sau đóng/đổi form, AI cần consent, chọn ví tay, không gọi create trước xác nhận, khóa source_ref không xung đột client_request_id, số dư/OTP/nhiều số tiền/USD.
- TypeScript noEmit, ESLint trên source thay đổi, Android :app:compileDebugKotlin đạt. Không chạy assemble/bundle/sign/release APK. Lần chạy test lạnh gặp timeout beforeEach 5s; chạy lại riêng và đợt cuối với giới hạn 15s đều đạt, không còn assertion lỗi.
- Backend 55/55 kiểm thử mới, Gemini được mock. Không phát sinh gọi model thật hoặc ghi tiền trong kiểm thử API.

## Còn cần thử trên thiết bị — chưa đánh dấu đạt

- [ ] API 33 và API 34+ / máy Xiaomi thực: từ chối, hủy, cấp quyền toàn màn hình và thu hồi từ hệ thống.
- [ ] Banner ACB: (VND) +752,790; số dư 14,533,072 phải bị loại. Thử cả khoản chi và MB/VCB thực.
- [ ] Ảnh không có banner: người dùng đóng/chụp lại; app không lấy dữ liệu cũ. Ảnh bị FLAG_SECURE che phải không được suy diễn thành giao dịch.
- [ ] Nhiều banner/nhiều số tiền: chọn riêng từng banner, không chọn nhầm số dư hoặc OTP; chữ mờ/chữ bị cắt phải review.
- [ ] Xoay màn hình, mở đa cửa sổ/app-only capture: phiên dừng nếu kích thước capture thay đổi, cấp lại nếu cần. Không đọc app-only như nguồn banner.
- [ ] Rời app, nút Dừng trong notification, logout, đóng form giữa capture/OCR/AI: phiên dừng, ảnh cache được dọn, không ghi đè form khác.
- [ ] Kiểm tra foreground service không tiếp tục chạy khi đã rời app trên OEM thực.
- [ ] Chỉ sau Lưu mới tạo tiền; mạng lỗi giữ draft source_ref; thử lưu lại cùng crop không tạo bản ghi thứ hai.
- [ ] Thử endpoint AI/model thật trong môi trường riêng; server hiện tại không bị thay đổi để thử.

Giới hạn: crop là lựa chọn có xác nhận của người dùng, không phải bộ tự nhận diện bảo đảm banner ngân hàng. Hash crop chỉ nhận cùng ảnh pixel; ảnh khác nhau của cùng giao dịch cần kiểm tra trùng bổ sung. OCR tiếng Việt/ngân hàng thực chưa có số đo độ chính xác hoặc hiệu năng trên điện thoại.

Tham khảo: https://developer.android.com/media/grow/media-projection và https://developers.google.com/ml-kit/vision/text-recognition/v2/android
