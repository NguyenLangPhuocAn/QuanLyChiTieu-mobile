# Lắc/chuông và AI đọc thông báo — source 23/10/2026

## Đã có

Chọn notification mới nhất chưa xử lý; người dùng cấp quyền Android rồi chọn quyền gửi chữ đến server/Gemini (Nhập tay / Chỉ lần này / Luôn cho phép). Cho đặt lại quyền trong form. AI trích xuất các trường; không gọi parser regex để chọn Thu/Chi/số tiền hoặc fallback khi model lỗi. Vẫn có lọc OTP/che dữ liệu và đối chiếu tiền/bằng chứng sau AI.

Có loading và Hủy, abort HTTP/bỏ kết quả muộn. Cache RAM source/nội dung/phiên 2 phút, feature flags ngắn hạn. Thu thập native kết thúc trước lúc chờ consent hoặc model. Giữ trường tiền/Thu-Chi rỗng nếu cờ tắt/server cũ/không đồng ý/lỗi AI. MarkProcessed chỉ sau Save/enqueue an toàn; giữ sửa cùng nguồn và hỏi trước thay form khác.

## Kiểm thử

Mobile 100/100 qua 9 bộ: bankAiConsent, useLatestBankNotification, bankNotificationExtraction, MainScreenDrafts, latestBankNotification, App, offlineTransactionQueue, bankNotificationSync, api. Backend 73/73 qua 5 bộ, có hồi quy OCR. TypeScript/ESLint/compile Kotlin đạt. Tất cả model/fetch được mock; chưa có APK hoặc deploy mới.

## Cần thử trước nghiệm thu — chưa đánh dấu đạt

- [ ] Deploy thử riêng, bật cờ; server cũ/flag tắt không gửi nội dung, mở REVIEW thay vì regex fill.
- [ ] Android Notification Access, lắc/chuông, thiếu sensor, background/đổi tài khoản/đóng form; không tự gửi lúc vào app.
- [ ] Mỗi lựa chọn consent, nhớ theo tài khoản, đặt lại và đổi phiên; xem đúng chữ đã lọc, không gửi ảnh/khóa API.
- [ ] Gemini thật với ACB/MB/VCB ẩn danh, CR/DR, VND/USD, tiền chính/phí/số dư/OTP/marketing và thông báo nhiều giao dịch; đo đúng/sai/REVIEW.
- [ ] Loading/Hủy khi chờ quyền/flags/model, mất mạng, 401/429/timeout; không lưu hoặc ghi đè form khi hủy, có thể nhập tay.
- [ ] Đọc lại cùng nguồn dùng cache; nguồn/nội dung/phiên khác gọi mới. Save/offline/retry giữ chống trùng; vuốt bỏ, nhóm và cập nhật notification hoạt động đúng.
- [ ] Đo độ trễ p50/p95 và quota trên Wi-Fi/4G; AI cần mạng, không giả định nhanh hơn regex cục bộ.

Giới hạn: validate literal tiền vẫn cần định dạng số hợp lệ; JSON Schema không bảo đảm đúng ngữ nghĩa. Hủy client không cam kết dừng upstream đã nhận. Khóa notification không chống mọi bản phát lại; snapshot không xác định riêng banner nổi. Không restart server đang ổn định, build APK hay cập nhật web trong đợt source này.
