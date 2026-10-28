# File thường — QA28/10/2026

Kết quả hiện tại, theo yêu cầu bỏ mã hóa tất cả backup. Biên bản đầy đủ: ../../BILL-BOOK-BACKUP.md. PNG/XML là ảnh gốc Android local com.mobile.dev/Metro8081/API3301, không phải APK release hoặc máy thật.

- 00–02: không ô mật khẩu, lưu file lịch1192bytes bằng SAF.
- 03–06: chọn chính file đã xuất, preview3lịch/1liên kết/1bỏ qua, tên và mức tiền.
- 07–08: xác nhận/Hủy giữ3lịch/2kỳ.
- 09–10: xác nhận lại/khôi phục, native mirror3lịch/2kỳ/nhắc tắt; không tạo giao dịch. File và book bắt đầu cùng3lịch, không thử thêm mới ở bước này.
- 11–14: trở về tài khoản, thẻ Backup cá nhân dùng file thường, không ô mật khẩu.
- 15–21: lưu9giao dịch/1ví, chọn lại chính file, preview0sẵn sàng/9trùng/0lỗi. Không nhập mới bằng UI Android trong lượt này.
- 22trở đi: rời màn, bàn giao.

API MySQL thật: personal-api-confirmed-restore.json ghi QA5preview không ghi tiền/nhập1khoản79k/ví1triệu→921k. personal-api-repeated-restore.json ghi nhập lại400/0READY/2trùng/số dư giữ921k. Các tài khoản/ví QA1–4được đối chiếu bằng helper, không thay số lượng/số dư. Lỗi ISO tìm trong thử thật đã sửa trước nghiệm thu; không sửa TransactionsService toàn cục.

Mobile135/135 qua16bộ; backend24/24 qua2bộ; Metro4/4. Log Jest mock không thay cho bằng chứng API/Android. Backend có cảnh báo từ test giả lập lỗi tạo nhắc ngân sách có chủ đích (giao dịch vẫn lưu), không phải lỗi serverQA. TypeScript/ESLint log rỗng nghĩa exit0.

Giới hạn: chưa máy thật/OEM/4G, chưa thử lịch offline bằng cách ngắt mạng trên thiết bị (domain test chứng minh không gọi API), chưa buildnative/APK/web/deploy production. Server ổn định3000 không thay. Thư mục 2026-10-28-bill-backup kế bên là lần thử mã hóa đã bỏ, không dùng để chứng minh bản hiện tại.

Đã xem ảnh06và21: danh sách và số đếm rõ; filename dài có xuống dòng. Ảnh24bàn giao Home.
