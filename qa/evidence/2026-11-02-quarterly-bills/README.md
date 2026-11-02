# Kiểm thử hóa đơn định kỳ mở rộng — 02/11/2026

## Phạm vi thật đã chạy

- Android 13 Pixel 3a giả lập, `com.mobile.dev` được cài từ mã nguồn local và Metro cấu hình riêng; API Nest local cổng 3304, MySQL schema QA tách biệt. Không dùng APK 1.2.4 đã phát hành, server sản xuất, tài khoản hay tiền thật.
- Tạo qua API 14 khoản chi giả lập (số dư ví QA trước/sau là 3.179.000 đ). Ba khoản Internet FPT vào 31/01, 30/04 và 31/10/2026, đổi cách ghi tên và thiếu kỳ 31/07. Ba khoản Music thiếu tháng 09. Hai gói Netflix có số gói khác nhau và hai tên Hoa Lan/Lan Hoa không có căn cứ đủ chắc để gộp.
- Bấm **Tìm khoản lặp**: đã tải 14/14 giao dịch; đúng hai gợi ý Music hằng tháng và Internet FPT hằng quý. Mở đủ ba dòng chứng cứ FPT (ngày, số tiền, ID, ghi chú gốc). Thẻ nêu kỳ chưa thấy giao dịch; không kết luận chưa thanh toán.
- Theo dõi FPT: form tự điền chu kỳ quý, ngày gốc 31/01/2026, ngày bắt đầu 31/01/2027 và khoảng 300.000–330.000 đ. Hộp xác nhận hiện lại tên, chu kỳ, khoảng tiền, kỳ thiếu, các tên gốc và ghi rõ chỉ tạo lịch. Bấm **Hủy**: native mirror vẫn 0 lịch. Mở lại, bấm **Tạo lịch**: đúng 1 lịch quý, 0 kỳ cũ được đánh dấu, 0 giao dịch mới. Rời màn, vào lại: lịch vẫn có. Quét lại: FPT không trở thành gợi ý trùng, chỉ còn Music.
- MySQL trước/sau khớp chính xác 14 dòng và số dư 3.179.000 đ. API đồng bộ chấp nhận lịch quý/kỳ hợp lệ (200), phát lại đúng revision (200), từ chối ngày ngoài chu kỳ (400). Native JVM 14/14 cho planner, gồm ngày 31/tháng ngắn/năm nhuận.

## Ảnh chụp gốc theo luồng

| Bước | Ảnh | Kiểm tra |
| --- | --- | --- |
| Kết quả phát hiện | `30-quarter-card.png` | FPT hằng quý, kỳ thiếu, ba biến thể tên, khoảng tiền |
| Mở chứng cứ | `24-evidence-open.png`, `25-evidence-rows.png` | Ba giao dịch gốc |
| Form theo dõi | `31-quarter-editor.png`, `32-quarter-editor-lower.png` | Bốn chu kỳ bố cục 2×2, ngày gốc và tiền |
| Xác nhận | `33-review-confirmation.png` | Xem trước và Hủy/Tạo lịch |
| Sau lưu | `38-created-card.png` | Một lịch quý, bắt đầu từ 31/01/2027 |
| Mở lại và kiểm trùng | `43-reopen-created-card.png`, `44-rescan.png` | Lịch còn, không gợi ý FPT lần hai |

Mỗi PNG có XML cùng tên chụp từ Android. `preview-before-confirm.json`, `native-quarterly.json`, `api-results.json`, `sql-before.json`, `sql-final.json` giữ kết quả đối chiếu; `SHA256SUMS.txt` ghi hash cho tệp bằng chứng. Ảnh không chứng minh thông báo nhắc thực sự phát trong tương lai hoặc hoạt động trên điện thoại vật lý.

## Giới hạn và bàn giao

- Tên đổi hẳn không có từ chung vẫn cần người dùng tạo lịch thủ công. Quy tắc ghép tên giữ nguyên số gói và tiền tệ, không dùng AI suy đoán nhà cung cấp.
- Nhắc Android theo quý đã có mã native và JVM; chưa thử chờ tới hạn trên OEM/thiết bị thật. Đồng bộ quý chỉ thử với backend source QA mới. APK 1.2.4/server production hiện có chưa chứa cặp thay đổi này; cần gom phát hành app + backend ở lần người dùng chốt cập nhật tiếp theo.
