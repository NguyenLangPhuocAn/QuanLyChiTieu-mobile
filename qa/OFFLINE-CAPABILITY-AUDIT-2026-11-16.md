# Ma trận và thứ tự hoàn thiện offline — 16/11/2026

Mức “xem” chỉ có nghĩa đọc dữ liệu đã tải/lưu trên máy. Không đồng nghĩa thêm, sửa, xóa hay đồng bộ ngoại tuyến. Bằng chứng: [QA Android đợt 2 ngày 16/11](evidence/2026-11-16-offline-wave2/README.md), [QA Android đợt 1](evidence/2026-11-16-offline-audit/README.md); Thu/Chi sửa/xóa/xung đột: [QA 13/11](evidence/2026-11-13-offline-transactions/README.md). Bản debug qua Metro **không khởi động được khi tắt Wi-Fi/dữ liệu**; chưa được tính là đạt cold start standalone.

| Nhóm | Xem | Thêm | Sửa | Xóa | Đồng bộ và giới hạn |
| --- | --- | --- | --- | --- | --- |
| Giao dịch Thu/Chi trong app | Cache + hàng chờ | Hàng chờ, xem trước | Hàng chờ, xem trước | Hàng chờ, xác nhận | Chọn bản máy/server/để sau; server kiểm tra bản gốc và mã chống trùng. Ảnh hóa đơn bị chặn offline. Đã tắt Wi-Fi/dữ liệu trên emulator, nhưng cold start bản debug bị Metro chặn; chưa lặp toàn luồng trên điện thoại thật. |
| Lịch sử và Tìm giao dịch | Tìm/lọc trên giao dịch đã tải: ghi chú, ngày, ví, danh mục, Thu/Chi; hiện thời điểm và cảnh báo phạm vi | Theo luồng Thu/Chi | Theo luồng Thu/Chi | Theo luồng Thu/Chi | Android emulator khi radio tắt đã lọc nhóm Chi và ghi chú QA từ 3 giao dịch cache, còn 1 kết quả. Không tự xem cache là toàn bộ server. |
| Thống kê và báo cáo | Tính từ giao dịch trong phiên/cache; ghi thời điểm và cảnh báo thiếu/cũ; không hiện số 0 khi phiên offline chưa có cache | Không áp dụng | Không áp dụng | Không áp dụng | Ca mã xác nhận offline không gọi API thống kê. Xuất/gửi báo cáo vẫn cần API; chưa chụp màn Android với mã mới. |
| Chi an toàn hôm nay | Lịch tiền tính từ ví cache, lịch và khoản chờ; hiện thời điểm, cảnh báo cache cũ; Trung tâm tài chính không hiện số khi thiếu ví cache | Không ghi tiền | Không áp dụng | Không áp dụng | Cảnh báo sau 24 giờ hoặc thời điểm không rõ; vẫn chỉ là ước tính, có thể thiếu giao dịch chưa tải. Ca màn Lịch tiền qua, chưa chụp Android với mã mới. |
| Widget Thu/Chi | Dữ liệu/danh mục đã lưu | Qua kiểm tra/xác nhận | Qua Lịch sử | Qua Lịch sử | [Bằng chứng cũ](WIDGET-OFFLINE.md); chưa lặp cold start widget 16/11. Mic/OCR chưa xác nhận offline. |
| Ví | Cache Tổng quan, ghi thời điểm | Bị chặn | Bị chặn | Bị chặn | Chuyển tiền bị chặn. Chưa có ID tạm, hàng chờ và giải quyết xung đột; cache chỉ phản ánh lần tải gần nhất. |
| Danh mục | Cache Tổng quan, ghi thời điểm | Bị chặn | Bị chặn | Bị chặn | Chọn danh mục cũ cho Thu/Chi được; chưa có ID tạm và ánh xạ vào giao dịch chờ. Màn riêng chưa chụp Android; ca tự động đạt. |
| Ngân sách | Tổng quan có một phần cache; màn quản lý gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Chưa có cache màn quản lý theo bộ lọc hoặc hàng chờ. |
| Mục tiêu tiết kiệm | Tổng quan có cache; màn quản lý gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Ghi tiền tiết kiệm cần kiểm tra ví và xung đột. |
| Vay/Nợ | Màn danh sách/form gọi API | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ | Chưa có cache/hàng chờ/đối chiếu. |
| Lịch hóa đơn | Lịch cục bộ theo tài khoản/API | Lưu cục bộ | Lưu cục bộ | Lưu cục bộ dạng lưu trữ | Lịch không có nghĩa đã trả; thanh toán vẫn cần giao dịch và đối chiếu server. Chưa thử trọn luồng Android offline. |
| Lịch tiền | Khoản dự kiến cục bộ, giao dịch cache | Khoản dự kiến lưu cục bộ | Chưa có thao tác sửa trực tiếp | Xóa khoản dự kiến cục bộ | Chưa kiểm trọn luồng Android offline; số dư/giao dịch vẫn phụ thuộc cache và hàng chờ Thu/Chi. |
| Quy tắc tự chọn danh mục và nhắc Android | Dữ liệu lưu trên máy | Quy tắc/lời nhắc lưu cục bộ | Lưu cục bộ | Lưu cục bộ | 86 ca mã tập trung cho quy tắc, hóa đơn, lịch tiền và nhắc đạt; chưa lặp toàn bộ thao tác sau đóng/mở app với radio tắt trên Android. |
| AI, OCR, Excel, backup | Chưa có bằng chứng toàn luồng offline | Chưa xác nhận | Chưa xác nhận | Chưa xác nhận | Không quảng cáo offline cho các luồng này. |

## Thứ tự tiếp theo

1. Khép bài thử Thu/Chi trên điện thoại thật: tắt Wi-Fi/4G, khởi động lạnh bản standalone, tạo/sửa/xóa trong app và widget, đổi tài khoản, xung đột và gửi lại sau khi server đã ghi. Kiểm ảnh form sau đóng/mở. Chỉ thử bản standalone khi người dùng chốt cập nhật; hiện không build APK.
2. Lặp Android offline cho Thống kê, Lịch tiền, quy tắc, lịch hóa đơn và lời nhắc: kiểm tra tạo/sửa/xóa, đóng/mở, thời điểm cache và lịch không tự chuyển Đã trả. Sau đó hoàn thiện cache đọc Ngân sách/Mục tiêu tiết kiệm theo tài khoản, giữ trạng thái chỉ xem.
3. **Chỉ sau khi nhóm trên đạt**, thiết kế hàng chờ Ví và Danh mục: ID tạm, ánh xạ vào giao dịch chờ, thứ tự gửi, phiên bản server/kiểm tra xung đột, xem trước số dư và khóa chống gửi trùng. Thử nhiều tài khoản và khởi động lại trước khi mở UI ghi.
4. Sau Ví/Danh mục mới xét Ngân sách, Tiết kiệm, Vay/Nợ. Mọi khoản tiền phải xem trước/xác nhận và không tự ghi đè khi reconnect.
