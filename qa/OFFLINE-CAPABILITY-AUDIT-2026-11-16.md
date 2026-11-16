# Ma trận và thứ tự hoàn thiện offline — 16/11/2026

Mức “xem” chỉ có nghĩa đọc dữ liệu đã tải/lưu trên máy. Không đồng nghĩa thêm, sửa, xóa hay đồng bộ ngoại tuyến. Bằng chứng mới: [QA Android 16/11](evidence/2026-11-16-offline-audit/README.md); Thu/Chi sửa/xóa/xung đột: [QA 13/11](evidence/2026-11-13-offline-transactions/README.md).

| Nhóm | Xem | Thêm | Sửa | Xóa | Đồng bộ và giới hạn |
| --- | --- | --- | --- | --- | --- |
| Giao dịch Thu/Chi trong app | Cache + hàng chờ | Hàng chờ, xem trước | Hàng chờ, xem trước | Hàng chờ, xác nhận | Chọn bản máy/server/để sau; server kiểm tra bản gốc và mã chống trùng. Ảnh hóa đơn bị chặn offline. Chưa thử Wi-Fi/4G thật. |
| Widget Thu/Chi | Dữ liệu/danh mục đã lưu | Qua kiểm tra/xác nhận | Qua Lịch sử | Qua Lịch sử | [Bằng chứng cũ](WIDGET-OFFLINE.md); chưa lặp cold start widget 16/11. Mic/OCR chưa xác nhận offline. |
| Ví | Cache Tổng quan, ghi thời điểm | Bị chặn | Bị chặn | Bị chặn | Chuyển tiền bị chặn. Chưa có ID tạm, hàng chờ và giải quyết xung đột; cache chỉ phản ánh lần tải gần nhất. |
| Danh mục | Cache Tổng quan, ghi thời điểm | Bị chặn | Bị chặn | Bị chặn | Chọn danh mục cũ cho Thu/Chi được; chưa có ID tạm và ánh xạ vào giao dịch chờ. Màn riêng chưa chụp Android; ca tự động đạt. |
| Ngân sách | Tổng quan có một phần cache; màn quản lý gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Chưa có cache màn quản lý theo bộ lọc hoặc hàng chờ. |
| Mục tiêu tiết kiệm | Tổng quan có cache; màn quản lý gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Ghi tiền tiết kiệm cần kiểm tra ví và xung đột. |
| Vay/Nợ | Màn danh sách/form gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Chưa có cache/hàng chờ/đối chiếu. |
| Lịch hóa đơn | Lịch cục bộ theo tài khoản/API | Lưu cục bộ | Lưu cục bộ | Lưu cục bộ dạng lưu trữ | Lịch không có nghĩa đã trả; thanh toán vẫn cần giao dịch và đối chiếu server. Chưa thử trọn luồng Android offline. |
| Lịch tiền | Khoản dự kiến cục bộ, giao dịch cache | Khoản dự kiến lưu cục bộ | Chưa có thao tác sửa trực tiếp | Xóa khoản dự kiến cục bộ | Chưa kiểm trọn luồng Android offline; số dư/giao dịch vẫn phụ thuộc cache và hàng chờ Thu/Chi. |
| AI, OCR, Excel, backup | Chưa có bằng chứng toàn luồng offline | Chưa xác nhận | Chưa xác nhận | Chưa xác nhận | Không quảng cáo offline cho các luồng này. |

## Thứ tự tiếp theo

1. Khép bài thử Thu/Chi trên điện thoại thật: tắt Wi-Fi/4G, khởi động lạnh bản standalone, tạo/sửa/xóa trong app và widget, đổi tài khoản, xung đột và gửi lại sau khi server đã ghi. Kiểm ảnh form sau đóng/mở, xác nhận không có hiểu lầm ảnh được giữ.
2. Hoàn thiện cache đọc màn Ngân sách/Mục tiêu tiết kiệm theo tài khoản và API, với ngày cập nhật và trạng thái chỉ xem. Test Android từng màn khi không tới API.
3. Thiết kế hàng chờ ví và danh mục trước khi mở ghi offline: ID tạm, ánh xạ danh mục/ví của giao dịch chờ, thứ tự gửi, phiên bản server/kiểm tra xung đột, xem trước số dư và khóa chống gửi trùng. Thử nhiều tài khoản và khởi động lại trước khi mở UI ghi.
4. Sau ví/danh mục mới xét ngân sách, tiết kiệm, vay nợ. Mọi khoản tiền phải xem trước/xác nhận và không tự ghi đè khi reconnect.
