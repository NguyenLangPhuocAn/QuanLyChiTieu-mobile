# Giảm thao tác nhập và xuất — 31/10/2026

Phạm vi rà soát: luồng nhập giao dịch, widget, đọc ảnh, Excel, báo cáo, backup cá nhân và lịch tiền trong source mobile/backend. Không coi một ý tưởng là chức năng đã hoàn tất. Các phần bên dưới chưa bắt đầu triển khai trừ mục đã ghi rõ.

## Đợt đang hoàn thiện

- Gộp lịch hóa đơn và thu/chi dự kiến vào một file sao lưu JSON thường. File cũ version2 chỉ chứa lịch vẫn nhập được và giữ các khoản dự kiến hiện có. File mới version3 thay cả hai phần trong một lần ghi local, có xem trước/xác nhận, kiểm file và dữ liệu thay đổi sau xem trước. Không cộng dồn bản nhập lại.
- Chọn file lịch tự hiện xem trước, bỏ nút đọc file riêng. Không bỏ bước xác nhận thay dữ liệu.
- Đồng bộ lịch tiền giữa thiết bị theo tài khoản, người dùng tự bật sau xem trước/xác nhận. Giữ local khi mất mạng, so phiên bản trước khi ghi, hai bên cùng sửa cần chọn bản. Không tự ghi tiền. Source và unit/API QA đã có; nghiệm thu Android ghi riêng trong biên bản.

## Các chức năng đề xuất tiếp theo

| Ưu tiên | Chức năng | Giảm thao tác cho người dùng | Điều kiện trước khi làm |
| --- | --- | --- | --- |
| 1 | Nhập lại giao dịch gần đây | Chọn một khoản cũ để điền tiền, ghi chú, loại và danh mục; ngày mặc định hôm nay. Người dùng kiểm ví và xác nhận, không ghi ngay khi chạm. | Lấy đủ chi tiết món nếu người dùng chọn sao chép; bỏ ID ngân hàng/ảnh/khóa yêu cầu cũ; tạo khóa chống trùng mới sau xác nhận. |
| 2 | Nhớ cách nhập Excel | Nhớ cách ghép cột và ví/danh mục theo từng mẫu file, tài khoản và backend, chỉ hỏi lại phần không còn khớp. | Hiện xem trước toàn bộ, chỉ ra dòng lỗi/trùng, không đoán ví để tự ghi. Giữ kiểm tra trùng và hoàn tác hiện có. Luồng Excel hiện tại đã tự xem trước khi chọn file, không làm lại tính năng này. |
| 3 | Xuất lại báo cáo gần nhất | Nhớ kỳ, ví, định dạng và tải xuống/gửi email lần trước; chọn kỳ mới nhanh hơn. | Hiện phạm vi xuất trước khi chạy; không tự gửi email hoặc lưu địa chỉ của tài khoản khác. File vẫn có đủ dữ liệu trong phạm vi người dùng chọn. |

## Tối ưu kỹ thuật nên đo trước khi quyết định

- Đồng bộ lịch: có thể thêm kiểm tra revision nhẹ để không tải cả snapshot khi chưa đổi. Bản hiện tại đã gộp lần đồng bộ sau thay đổi và không PUT lại khi nội dung giữ nguyên, nhưng GET vẫn lấy snapshot khi app đang mở. Chưa gọi đây là tối ưu lưu lượng đã hoàn thành.
- Đọc ảnh: tái sử dụng kết quả cùng ảnh trong phiên, hủy yêu cầu khi đổi ảnh/rời màn; đo thời gian nén/upload/model trên điện thoại và4G trước khi chọn mức nén.
- Danh sách giao dịch: tiếp tục dùng cache, phân trang và tránh tải lại toàn bộ sau mỗi lần lưu; chỉ thêm tối ưu nếu số đo chỉ ra điểm chậm.

Cập nhật02/11: mục1 đã có source, kiểm thử và Android/API/MySQL QA đạt (xem biên bản nhập lại). Mục2 nhớ mẫu Excel và mục3 nhớ bộ lọc xuất vẫn chưa triển khai. Backend mới đã triển khai theo xác nhận; APK1.2.4 đang chuẩn bị, web giữ nguyên.


## Nhập lại giao dịch — 02/11/2026

- Đã triển khai từ Chi tiết giao dịch thu/chi: tiền, ghi chú, hashtag, danh mục/ví còn hợp lệ; ngày hôm nay. Kèm món phải tự bật, không sao chép ảnh, ID ngân hàng hoặc khóa cũ. Xem trước/xác nhận trước khi ghi.
- Giữ một mã yêu cầu mới cho retry và hàng chờ offline; hủy xác nhận cũ sau đóng form/ra nền/đổi tài khoản. Không áp dụng vay/nợ hoặc chuyển tiết kiệm.
- Mobile624/624 qua99bộ, TypeScript/ESLint đạt; backend377/377. Android local/API3303/MySQL QA: chưa xác nhận giữ944.750đ; xác nhận thêm đúng một khoản79.000đ, còn865.750đ. Hai replay trả cùngID32, không trừ tiếp. Bằng chứng qa/evidence/2026-11-02-repeat-transaction.
- Backend hỗ trợ lịch/sao lưu/widget mới đã triển khai ngày02/11 theo xác nhận người dùng: thêm planning_snapshots, giữ nguyên bảng tiền; health local/public200, planning-sync thiếuJWT401. Giữ dist cũ riêng để quay lui. Không đổi web quảng bá.
- Đang chuẩn bị phát hành APK1.2.4/code9 theo yêu cầu chốt. Giới hạn máy thật/OEM/AI thật ghi riêng, không coi emulator là điện thoại thật.
