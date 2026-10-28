# Kiểm tra khoản định kỳ — C1, 28/10/2026

Source đã triển khai; chưa phát hành APK. Vào Tài khoản → Hóa đơn định kỳ → Kiểm tra. Dùng chung lần tải lịch sử với gợi ý khoản lặp, tối đa 3 năm/2.000 khoản, báo rõ độ phủ. Không tự tải nền hoặc gửi cảnh báo suy đoán ra ngoài app.

## Cách xác định

- Chỉ xét lịch đã xác nhận, đang hoạt động. Ghép đúng tên chuẩn hóa và tiền tệ; tên thuộc nhiều lịch (kể cả lịch dừng/xóa) không tự ghép. Liên kết đã xác nhận được đối chiếu với giao dịch nguồn hiện có; không dùng số tiền snapshot cũ.
- Tăng tiền: bốn kỳ liên tiếp, mỗi kỳ đúng một khoản. Ba kỳ trước dao động trong ±10% quanh trung vị; kỳ mới tăng ít nhất 10% và vượt mức tối đa người dùng đặt. Trình bày mức cũ/mới/chênh lệch/% và bốn giao dịch gốc. Đây có thể là đổi gói, phí hoặc thuế, không phải kết luận dịch vụ thu sai.
- Có thể ghi lặp: các ID khác nhau, cùng lịch/kỳ/tiền tệ/số tiền, toàn cụm cách nhau tối đa ba ngày. Có thể là trả nhiều lần hoặc khoản riêng; không tự xóa/gộp giao dịch.
- Loại giao dịch lỗi, ID trùng trong phản hồi, số tiền/ngày không hợp lệ, tương lai, hoàn tiền/chuyển ví/vay/tiết kiệm. Không đoán gói dịch vụ không rõ tên hoặc quy đổi tiền tệ.
- “Đã kiểm tra” chỉ lưu lựa chọn theo tài khoản và backend; “Hiện lại” phục hồi. Khóa gồm ngữ cảnh lịch và ID/ngày/tiền nguồn, không chứa nội dung ghi chú. Nguồn đổi sẽ hiện lại cảnh báo. Thay phiên bản cũ của cùng sự kiện; dọn lựa chọn cùng lịch quá 180 ngày (tuần/tháng) hoặc 800 ngày (năm), không đặt giới hạn 20 lựa chọn.
- Hủy/rời màn/ra nền/đổi tài khoản bỏ phản hồi muộn. Lưu một lần trong hàng đợi, kiểm ngữ cảnh hiện tại và giữ cảnh báo nếu lưu lỗi.

## Tổng dự kiến

Tab Lịch đã tạo có tổng 30 ngày tính cả hôm nay: 28/10–26/11 trong fixture. Chỉ cộng kỳ chưa xử lý, còn hoạt động, không quá hạn, tôn trọng ngày bắt đầu. Cộng đơn vị tiền nhỏ nhất và tách từng tiền tệ; tràn số báo không tính được. Dùng mức đã đặt, không tự đổi theo cảnh báo tăng tiền. Giao dịch đã chi nhưng chưa liên kết vẫn có thể được tính. Chưa nối tổng này vào lịch tiền/chi an toàn.

## Kiểm chứng

- Jest 129/129, 15 bộ, gồm 20 ca mới cho thuật toán/lưu lựa chọn/UI. Metro QA 3/3; TypeScript và ESLint file đổi đạt. Kiểm thử mock bao gồm ngoại tệ, ngày 31/năm nhuận, tên mơ hồ, nguồn thay đổi, hủy/đổi tài khoản, lỗi lưu, tràn số và không phát sinh lệnh ghi tiền.
- Android giả lập API33, `com.mobile.dev`, source Metro local và Nest/MySQL QA loopback. Không build lại native. Ảnh/XML và kết quả thật: [evidence](evidence/2026-10-28-bill-activity/README.md).
- Fixture riêng: Internet 100k trong ba kỳ rồi 130k; Video 89k và hai khoản cùng ngày. SQL kiểm lại 9 giao dịch, số dư 1.125.000đ. Hai lịch local 100k+89k có tổng 189k, không tạo giao dịch/đánh dấu trả.
- JVM/debug build 27/10 và backend application tests đợt B2 là bằng chứng lịch sử, không phải chạy lại trong C1. Backend đợt này chỉ thêm công cụ fixture QA.

## Còn lại

C2: backup/sync book và nối lịch tiền/chi an toàn. Chu kỳ quý/thiếu kỳ/gói không rõ tên vẫn nhập tay. Điện thoại thật/OEM/reboot/4G, ngân hàng/Gemini/mic/OCR không được nghiệm thu trong batch này. API đối chiếu liên kết B2 chưa deploy production. Không cập nhật web, APK hoặc server ổn định.
