# Android QA: lịch hóa đơn khi mất mạng

Máy thử: Pixel 3a API 33 (`emulator-5554`), app QA `com.mobile.dev` chạy từ source local qua Metro; tài khoản và backend QA cổng 3303. Không dùng APK production.

## Bước thử và kết quả

1. Bật airplane mode, tắt Wi-Fi và dữ liệu di động. `dumpsys connectivity` báo `Active default network: none`.
2. Tạo lịch tháng `QA_offline_0911` 2.000đ khi ngoại tuyến. Lịch hiện trong **Chưa trả**; đóng rồi mở lại màn hình vẫn thấy lịch. Ảnh `01-airplane-empty.png`, `02-created-offline.png`, `03-reopened-offline.png`.
3. Phát hiện lỗi: sau khi tắt hẳn bản debug, app không nạp được JS qua Metro khi ngoại tuyến. Khi nối mạng và đăng nhập lại, lịch ở bước 2 không hiện vì URL API dự phòng `localhost:3303` tạo khóa lưu khác với URL chính `10.0.2.2:3303`. Kiểm tra cơ sở dữ liệu AsyncStorage của app QA xác nhận hai khóa khác nhau. Đây là lỗi thật ở bản local, không phải kết quả đạt.
4. Sửa danh tính lưu trữ để luôn dùng URL cấu hình chính, độc lập với URL kết nối dự phòng. Sau đó nhập lịch `QA_fixed_offline` 3.000đ lúc `Active default network: none`. Lịch và tổng 3 kỳ 9.000đ hiển thị trong **Lịch đã tạo** (`04-fixed-created-offline.png`).
5. Nối mạng (`airplane_mode_on=0`, active network `111`), force-stop rồi mở lại app QA. Phiên đăng nhập tự khôi phục và lịch vẫn hiện ở **Chưa trả** (`05-restarted-reconnected.png`). Xóa lịch thử `QA_fixed_offline` sau khi chụp ảnh; không tạo giao dịch thanh toán.

## Kiểm tra mã

- `npx tsc --noEmit`: đạt.
- Jest `offlineTransactionQueue.test.ts` và `financialPlanning.test.ts`: 16/16 đạt.
- ESLint các file lõi liên quan: đạt.

## Giới hạn

Bản debug local không kiểm tra được khởi động nguội khi hoàn toàn ngoại tuyến vì React Native cần Metro để nạp JavaScript. Cần thử riêng hành vi này trên APK phát hành khi đến đợt cập nhật app. Các banner Fast Refresh và cảnh báo trong ảnh chỉ thuộc bản debug. Lịch `QA_offline_0911` của bước phát hiện lỗi nằm dưới khóa URL dự phòng của tài khoản QA, không hiện trong bản sửa; không phải dữ liệu người dùng thật.
