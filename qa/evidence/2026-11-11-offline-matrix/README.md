# Kiểm tra ngoại tuyến trên Android QA · 11–12/11/2026

Thiết bị: Pixel 3a giả lập, Android 13; `com.mobile.dev` chạy mã local qua Metro. Tài khoản, ví và giao dịch đều là dữ liệu QA trong cơ sở dữ liệu riêng của backend cổng 3303. Không dùng app, tài khoản hoặc server production. APK phát hành không được dùng làm bằng chứng cho mã local.

## Cách cô lập mạng

- Đầu tiên bật chế độ máy bay và xác nhận `Active default network: none`. Phát hiện giả lập vẫn truy cập được backend trên máy tính qua địa chỉ nội bộ/ADB reverse, nên các ảnh bước này **không** được tính là bằng chứng cho việc xếp hàng ngoại tuyến.
- Sau đó dừng **riêng** tiến trình backend QA cổng 3303 và kiểm tra cổng không còn lắng nghe. Giữ Metro để bản debug nạp JavaScript; mọi API nghiệp vụ của app QA đều không thể trả lời. Backend production cổng 3000 không bị thay đổi.
- Trước khi nối lại, cơ sở dữ liệu QA có đúng một giao dịch thử `OfflineWidgetQ` 12.345đ (ID 51) được tạo ở bước phát hiện giới hạn trên; hai ghi chú `OfflineQA2` và `OfflineAppQA2` chưa có bản ghi.

## Kết quả trên màn hình

| Luồng | Kết quả | Ảnh |
| --- | --- | --- |
| Lịch sử với dữ liệu đã tải | Xem lại giao dịch cũ khi API QA ngắt. Đây là dữ liệu cache; không coi tổng số là số mới từ server. Ảnh Tổng quan ở bước chế độ máy bay chỉ là quan sát, vì backend QA lúc ấy vẫn còn truy cập được. | `17-server-offline-app.png` |
| Widget đầy đủ trên launcher | Vẫn hiện widget; chọn **Chi**, mở được danh mục đã lưu và form có danh mục/ví. | `04-offline-launcher.png`, `05-offline-widget-categories.png`, `07-offline-widget-entry-loaded.png` |
| Thêm giao dịch từ widget khi API ngắt | Nhập 23.456đ, danh mục Ăn uống, ví QA; xem trước rồi xác nhận. Widget hiện **1 chờ đồng bộ**. AsyncStorage có một bản nháp, cơ sở dữ liệu QA chưa có giao dịch tương ứng. | `14-server-offline-widget-filled.png`, `15-server-offline-widget-review.png`, `16-server-offline-widget-queued.png` |
| Thêm giao dịch trong app khi API ngắt | Nhập Thu 34.567đ và ghi chú `OfflineAppQA2`; app thông báo giữ bản nháp ngoại tuyến. Hàng chờ có hai bản nháp, chưa đổi số dư server. | `18-server-offline-app-entry.png`, `23-server-offline-app-review-loaded.png` |
| Tài khoản và Hóa đơn định kỳ | Menu tài khoản và màn lịch mở được từ dữ liệu local. Bộ lọc 7/30/90 ngày/1 năm hiện. Ban đầu form lịch không hiện danh mục khi API ngắt; đã sửa để lấy danh mục đã cache. Sau khi nạp lại mã local, form hiện Chưa phân loại/Khác/Bảo hiểm/Làm đẹp khi backend vẫn tắt. | `26-server-offline-account-menu.png`, `28-server-offline-recurring-loaded.png`, `32-server-offline-recurring-reopened.png`, `44-recurring-category-cache-verified.png` |
| Nối lại backend QA | Bản nháp widget tạo ID 52: −23.456đ; bản nháp trong app tạo ID 53: +34.567đ. Mỗi ghi chú xuất hiện đúng một lần, hàng chờ trở về `[]`. Lần nối lại đầu xử lý một bản nháp; đưa app lên trước lần nữa xử lý bản còn lại. Đã bổ sung xử lý tiếp một đợt thành công một phần, có kiểm thử tự động. | `38-qa-app-reconnected-loaded.png`, `40-qa-sync-complete.png`, `41-qa-sync-after-resume.png` |

## Phạm vi và giới hạn

- Đây là thử nghiệm trực tiếp cho các đường ngoại tuyến quan trọng: dữ liệu đã cache, widget, thêm Thu/Chi, hàng chờ và lịch. Các bài Jest kiểm tra thêm logic ngân sách, ví, kế hoạch, sao lưu, tìm kiếm, nhắc lịch, OCR/AI, giọng nói và xác thực; chúng **không** thay thế phép thử trên điện thoại thật.
- OCR ảnh, chatbot, trích xuất thông báo bằng AI, đăng nhập Google lần đầu và dữ liệu chưa từng tải cần mạng/server. Không thể kết luận các dịch vụ này hoạt động ngoại tuyến. Mic/ảnh widget chưa được thử trực tiếp trong đợt này.
- Bản debug cần Metro để khởi động nguội, nên chưa xác nhận khởi động nguội hoàn toàn không mạng trên APK ký. Cần kiểm trên điện thoại thật sau khi cài bản phát hành.
- Không tự đồng bộ khi app bị Android force-stop; hàng chờ được thử lại khi app hoạt động và kết nối trở lại. Trường hợp backend hồi phục nhưng Android không phát sự kiện mạng có thể cần đưa app ra trước; không có polling nền liên tục.
- Cấu hình API tạm trỏ 3303 chỉ dùng trong QA đã được khôi phục về cấu hình repo trước khi commit/phát hành. Sau thử, máy chủ QA cổng 3303 và kết nối mạng giả lập được khôi phục.
