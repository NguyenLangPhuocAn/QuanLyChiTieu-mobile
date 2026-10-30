# Lịch tiền và Chi an toàn

Tài khoản → Lịch tiền và Chi an toàn. Màn riêng, không khôi phục Trung tâm tài chính hoặc điểm sức khỏe. Dùng lịch hóa đơn thật từ recurringBillsService và khoản dự kiến scoped backend/tài khoản; phản hồi cập nhật book/cache/hàng chờ, làm mới ngày sau nửa đêm hoặc về foreground. Dữ liệu lỗi chặn tính, không thay bằng0giả.

Chi an toàn mỗi ngày = max(0, số dư ví thường cùng tiền tệ − hóa đơn chưa xử lý − chi dự kiến − chi chờ đồng bộ) /30, làm tròn xuống theo đơn vị tiền. Có số dư âm. Không tính ví tiết kiệm/ngoại tệ hoặc thu chưa nhận. Không thay hạn mức ngân sách từng danh mục. Biến động dùng mức tối đa. Kỳ quá hạn giữ từ hôm nay, kỳPAID/SKIPPED/lịchpaused/archived bỏ khỏi nghĩa vụ. Thu dự kiến chỉ đi vào số dư dự kiến cuối ngày; xét chi trước thu cùng ngày để không bỏ sót nguy cơ thiếu tiền trước khi lương về.

Người dùng mở Cách tính để xem từng thành phần và updatedAt cache. Khoản đã chi nhưng chưa liên kết hóa đơn vẫn có thể được giữ; bản chờ có thể đã được server nhận, nên mức này thận trọng. Chưa tự hợp nhất hai khoản nhập tay trùng một hóa đơn; form nhắc không nhập lại hóa đơn đã có lịch. Dự kiến là số liệu trên máy, không tự POST giao dịch, chọn ví hay đổi số dư.

Khoản dự kiến có xem trước/xác nhận thêm hoặc bỏ, validation ngày thật/tiền/ID, chặn xác nhận cũ sau rời màn, serialize ghi và không ghi đè dữ liệu hỏng. Chưa sync/backup các khoản dự kiến mới hoặc tự đồng bộ book giữa thiết bị. Tiền tệ xem theo tài khoản, không tự quy đổi. Sao lưu vẫn file thường theo yêu cầu.

Kiểm chứng30/10: evidence/2026-10-30-money-calendar-widget-full/README.md.
