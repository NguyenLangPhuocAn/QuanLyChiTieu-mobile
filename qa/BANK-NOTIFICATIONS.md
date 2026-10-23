# Lắc/chuông đọc thông báo mới nhất — 23/10/2026

## Luồng source hiện tại

- Khi Main đang được dùng ở foreground, lắc hai nhịp hoặc bấm chuông trong form. Nếu chưa cấp Notification Access, app giải thích rồi mở cài đặt khi người dùng chọn; quay lại không tự đọc, lắc/bấm lại.
- Lấy snapshot Android còn trên thanh thông báo, loại group summary, bỏ OTP/quảng cáo và các nguồn đã xử lý. Chọn postedAt mới nhất trước. Dữ liệu được phân tích bằng chữ trên máy, không chụp/crop/OCR/upload hoặc gọi AI.
- Có nhiều mục: mới nhất chưa xử lý trước; lưu hoặc enqueue offline an toàn mới markProcessed. Đọc lần sau mới tới mục kế. Đóng form chưa lưu giữ mục cho lần sau.
- Nếu cùng nguồn đang sửa, giữ nguyên. Nguồn khác khi form đã có dữ liệu cần xác nhận thay; không mở nhiều hộp xác nhận. Đóng form/background/đổi tài khoản bỏ kết quả muộn.
- Người dùng chọn ví/danh mục và bấm Lưu. Source_ref không đi kèm client_request_id. Quy tắc danh mục không đổi ngược Thu/Chi đã đọc.
- Cảm biến dừng khi background, mất focus, lưu, OCR, nghe mic, picker ngày/hashtag. Máy thiếu sensor vẫn dùng chuông. Chỉ đọc khi có thao tác; không tự đọc khi vào/khôi phục app.

## Bằng chứng

70/70 ca mục tiêu qua 7 suite (MainScreenDrafts, latestBankNotification, useLatestBankNotification, bankNotificationExtraction, offlineTransactionQueue, bankNotificationSync, App); TypeScript, ESLint và :app:compileDebugKotlin đạt. Không tạo APK mới. Backend giữ mốc 55/55 trước đó với Gemini mock, không đổi mã xử lý hoặc restart server.

## Cần thử trên Android thật — chưa đánh dấu đạt

- [ ] Lắc hai nhịp và chuông khi Main foreground; đi bộ/cầm máy bình thường không mở form bất ngờ; lực lắc trên Xiaomi/thiết bị khác.
- [ ] Sensor không hoạt động khi màn hình khóa/background/màn khác; trở lại app không tự đọc.
- [ ] Cấp/từ chối/thu hồi quyền; listener disconnect phải báo lỗi thay vì nói hết thông báo. Máy thiếu sensor dùng chuông.
- [ ] ACB (VND) +752,790; các khoản chi, SD/SDTK và số dư không có VND; MB/VCB thực; thiếu thông tin phải REVIEW.
- [ ] 3 thông báo khác ngân hàng: đọc mới nhất trước, lưu/đọc tiếp đúng thứ tự; bỏ qua/đóng chưa lưu giữ nguyên mục; vuốt bỏ không đọc lại.
- [ ] Thông báo nhóm, cùng notification update, nội dung ngắn/dài; không ghép trùng đoạn. OTP/quảng cáo không thành bản nháp tiền.
- [ ] Form đang sửa, lắc lặp, nhấn thay rồi hủy/đóng; dữ liệu cũ không bị ghi đè ngoài xác nhận.
- [ ] Save/offline/retry chỉ một giao dịch theo khóa nguồn; sự kiện phát lại khác id cần review trùng bổ sung.

Giới hạn: đây là đọc thông báo Android đang hoạt động, không phải API xác nhận banner nổi. Một số hãng/phiên bản Android có thể che nội dung hoặc ngắt listener; không cố vượt quyền hệ thống. Khóa sự kiện không cam kết chống trùng ngữ nghĩa giữa các sự kiện khác nhau. Chưa đo độ chính xác hoặc độ trễ trên máy thật.
