# Sao lưu file thường — 28/10/2026

Người dùng yêu cầu bỏ mã hóa ở tất cả phần sao lưu. C2a hiện dùng file JSON thường, không nhập mật khẩu, không tạo/đọc backup mã hóa cũ.

## Lịch hóa đơn

Tài khoản → Hóa đơn định kỳ → Sao lưu và khôi phục lịch. Lưu/chọn bằng Android SAF; một số trình quản lý file tự thêm đuôi .json. Chức năng đọc được file đó. Lưu và khôi phục hoàn toàn trên máy, không gửi lịch lên server. File giới hạn512KB, book256K ký tự, tối đa1.000lịch/5.000kỳ; đọc bằng RNFS, kiểm tra schema, quan hệ và trùng khóa. Có lịch, kỳ liên kết/bỏ qua, gợi ý TRACKED/IGNORED/LATER và cảnh báo đã kiểm tra; không chứa token hoặc ảnh.

Xem trước ngày tạo, số hiện có và số trong file. Xác nhận thay toàn bộ book, không cộng dồn/ghi tiền. Đọc lại file, so sánh nội dung đã xem và snapshot local trong hàng đợi trước ghi. Hủy/ra nền/rời màn/đổi tài khoản bỏ phản hồi hoặc xác nhận cũ; native picker được phép tạm rời app. Giữ lựa chọn nhắc toàn cục, tắt nhắc từng lịch nhập lại. Cần đối chiếu nguồn thanh toán trước khi bật nhắc. Tài khoản/máy chủ là trường trong file thường, không phải ràng buộc chống sửa file.

## Backup cá nhân

Tài khoản → Dữ liệu và xuất nhập → Backup cá nhân. Bỏ toàn bộ mật khẩu và nhãn mã hóa. API JWT xuất JSON thường UTF8 qua Base64 chỉ để vận chuyển khi lưu Android. Giới hạn25MB/10.000giao dịch; xem trước không ghi; không chọn sẵn; chọn phần nhìn thấy rồi xác nhận mới nhập. Checksum SHA256 gắn file đã xem; file khác bị chặn. Kiểm lại DB/rows hợp lệ, trùng trong file và dữ liệu có sẵn; requestID chống ghi lặp qua TransactionsService. Ngày giao dịch theo ngày lịch UTC YYYY-MM-DD, không phục hồi giờ trong ngày.

Chỉ phục hồi thu/chi thường vào ví/danh mục có sẵn; không tạo ví, không ghi đè số dư gốc, không phục hồi ảnh/chuyển ví/tiết kiệm/vay nợ. File xuất vẫn chứa các dòng khác để lưu trữ và báo không hỗ trợ khi nhập. Các phần này cần luồng phục hồi riêng. Cần mạng/API mới; gặp backend cũ thiếu checksum sẽ chặn nhập thay vì coi như thành công.

## Bằng chứng

- Mobile Jest135/135 qua16bộ (gồm domain và component với mock); backend24/24 qua2bộ; Metro4/4. TypeScript noEmit/ESLint file đổi đạt. Log tổng trong evidence/2026-10-28-plain-backup. Không coi Jest là bằng chứng điện thoại thật.
- Pixel3a API33 com.mobile.dev/Metro8081, API chỉ3301/schemaQA riêng. Không dùng APKproduction. Bộ PNG/XML00–10 chứng minh lưu file lịch1192bytes, chọn chính file đã xuất, preview3lịch/1liên kết/1bỏ qua, Hủy, xác nhận khôi phục, native mirror3lịch/2kỳ/0lịch đủ điều kiện nhắc. Book ban đầu và file cùng3lịch; đây là vòng lặp lưu/đọc/khôi phục, không phải thử thêm lịch mới.
- PNG/XML13trở đi: thẻ Backup cá nhân không mã hóa, không ô mật khẩu; lưu9giao dịch QA4/1ví và chọn lại chính file. Kết quả xem trước được ghi bằng ảnh sau tải, không dùng ảnh loading làm pass.
- API/MySQL QA5 độc lập: trước0giao dịch/ví1triệu, preview2dòng(1READY/1DUPLICATE) giữ nguyên dữ liệu; file đổi400, thiếuJWT401. Xác nhận API nhập1giao dịch79k, sau1/ví921k; nhập lại400/không ghi, preview0READY/2DUPLICATE. Đây là API thật, không phải thao tác xác nhận khôi phục giao dịch mới qua UI Android. User4 và3fixture trước giữ số lượng/số dư.
- Thử khôi phục đầu tiên tìm lỗi ngày ISO và trả failed1, không ghi tiền. Đã sửa chuẩn hóa ngày và chạy lại thành công. Một lần UiAutomator trả nullroot rồi tự thử lại lấy cây mới; không dùng cây cũ.
- Thư mục evidence/2026-10-28-bill-backup là lần thử mã hóa trước khi người dùng đổi yêu cầu. Giữ làm lịch sử thử nghiệm, không dùng số143/33hoặc ảnh mật khẩu làm nghiệm thu phiên bản hiện tại.

Chưa kiểm điện thoại thật/OEM/4G, Google/Gemini/ngân hàng/mic/OCR trong batch này. Không build/cài native mới, phát hành APK/web hoặc deploy/restart server production3000. C2a là sao lưu thủ công; tự đồng bộ/nối lịch tiền/chi an toàn còn trong plan.
