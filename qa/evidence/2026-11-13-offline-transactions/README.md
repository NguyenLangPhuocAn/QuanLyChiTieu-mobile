# Kiểm thử giao dịch ngoại tuyến — 13/11/2026

## Môi trường

- Android emulator `emulator-5554`, app debug riêng `com.mobile.dev`, source local qua Metro `8083` và ADB reverse `8081`.
- API QA cổng `3304` qua ADB reverse `3303`; database MySQL QA `nova_qa_bills_20261026_*`, tài khoản giả `qa.bills@example.test`. Cổng production `3000`, bản APK phát hành và trang web không tham gia bài thử.
- Ngắt riêng reverse `tcp:3303` để mô phỏng app không tới được API; giữ Metro để quan sát source đang sửa. Lúc reconnect nối lại reverse. Đây là mô phỏng mất API, chưa phải thử tắt Wi-Fi/4G trên điện thoại thật.

## Các bước và kết quả

1. Lúc online, giao dịch QA #2 chi 310.000 đ và #1 chi 3.100.000 đ, ví 6.590.000 đ. Tắt đường API; Lịch sử hiển thị bản gần nhất trên máy ([ảnh](23-offline-history-ready.png)).
2. Mở giao dịch #2; danh mục lịch sử `Hóa đơn QA` vắng trong danh sách danh mục hiện hành nhưng vẫn được giữ khi sửa ([ảnh](30-offline-edit-fixed-ready.png)). Đổi tiền thành 315.000 đ, xem lại/xác nhận và thấy trạng thái chờ ([ảnh](34-offline-save-confirm.png), [ảnh](35-offline-save-queued.png)). Xóa #1 bằng xác nhận; dòng biến mất ở bản trên máy ([ảnh](39-offline-delete-confirm.png), [ảnh](41-offline-delete-hidden.png)). Database vẫn giữ 310.000 đ, 3.100.000 đ và ví 6.590.000 đ trước reconnect.
3. Nối lại API: hộp so sánh nêu sửa/xóa trên máy và bản máy chủ ([ảnh](43-reconnect-after-wait.png)). Chọn thay đổi trên máy: #2 thành 315.000 đ, #1 bị xóa, ví 9.685.000 đ ([ảnh](45-local-sync-result.png)).
4. Lặp với #2 thành 320.000 đ khi offline, chọn giữ máy chủ khi nối lại và xác nhận bỏ bản máy. Lịch sử trở về 315.000 đ; database/ví vẫn 315.000 đ / 9.685.000 đ ([ảnh](53-offline-second-queued.png), [ảnh](55-discard-confirm.png), [ảnh](57-server-version-restored.png)).
5. Tạo xung đột thật: #2 sửa thành 320.000 đ trên máy khi offline, đồng thời QA server đổi thành 318.000 đ và nội dung khác. Hộp so sánh hiện cả hai ([ảnh](70-conflict-review-after-fix.png)); chọn bản máy lần đầu bị chặn, ví vẫn 9.682.000 đ ([ảnh](71-conflict-sync-blocked.png)). Vào Dữ liệu và xuất nhập → So sánh ([ảnh](80-data-conflict.png), [ảnh](82-conflict-compare-open.png)), chọn bản máy rồi xem trước/xác nhận đồng bộ ([ảnh](83-conflict-rebase.png), [ảnh](85-manual-sync-preview.png)). API trả #2 = 320.000 đ, ví = 9.680.000 đ; hàng chờ rỗng ([ảnh](86-conflict-resolved-sync.png)). Không ghi đè âm thầm.
6. Thử thêm một khoản Chi khi offline lộ dữ liệu QA thiếu danh mục Chi: form chặn lưu đúng quy tắc ([ảnh](00-create-preview.png)). Đã thêm danh mục hệ thống `Chi offline QA` **chỉ vào database QA** và xác nhận bộ chọn hiển thị ([ảnh](00-create-category-selected.png)). Bước lưu khoản mới trực tiếp trên emulator chưa hoàn tất vì công cụ chụp ảnh/Uiautomator bị timeout; không tính là đã đạt kiểm thử Android cho thao tác tạo. Luồng tạo bản nháp, chống trùng và đồng bộ được kiểm tra bằng unit test.

Ảnh là PNG gốc từ emulator kèm XML cùng tên. Chỉ có dữ liệu QA. Chưa thử đóng app cưỡng bức, đổi tài khoản hoặc mạng di động/điện thoại thật; các luồng đó cần kiểm tra trước khi chốt APK.
