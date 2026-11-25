# Rút gọn màn đồng bộ và bỏ hộp kiểm tra Thu/Chi — 25/11/2026

## Môi trường

- Android giả lập API 33, `com.mobile.dev` build debug từ source hiện tại với JS local nhúng; backend/database QA ở `127.0.0.1:3303`. Không dùng APK phát hành hoặc backend production.
- App QA đã có sẵn một ví và danh mục Chi. Khoản thử mới: Chi 9.000đ, ghi chú `Bun bo`.

## Bước thử và kết quả

1. Ngắt Wi-Fi, dữ liệu di động và `adb reverse`. Trong form Thu/Chi thường, nhập số tiền và ghi chú rồi bấm `Lưu giao dịch` [trên form](10-offline-ready.png). App không hiện hộp `Kiểm tra giao dịch`; [thông báo giữ bản nháp](11-offline-saved.png) xuất hiện. Đây là thao tác lưu bản nháp trên máy, chưa ghi tiền lên máy chủ.
2. Nối lại mạng và API QA. [Màn chọn bản giữ](12-reconnected.png) mặc định chỉ nêu `1 thay đổi chưa đồng bộ` và `1 giao dịch` so với lần kết nối trước; các lựa chọn bản máy, bản máy chủ và để sau vẫn hiện.
3. Bấm `Xem chi tiết`: [khoản Chi 9.000đ](13-expanded.png) và trạng thái `Máy chủ: Chưa gửi giao dịch` hiện ra. Bấm `Để sau`: [màn chọn đóng](14-deferred.png), không chọn gửi hoặc bỏ khoản.

## Kiểm tra mã và giới hạn

- Ba bộ Jest liên quan đạt 62/62 ca; TypeScript và build debug local đạt. Kiểm thử xác nhận bấm Lưu hai lần chỉ gọi tạo giao dịch một lần, và lựa chọn đồng bộ vẫn chờ người dùng.
- Lượt Android này kiểm giao diện một khoản và thao tác `Để sau`; không thử hai khoản trở lên, xung đột, lựa chọn ghi đè hay điện thoại thật. Các ảnh xem trước Thu/Chi trong biên bản cũ ghi lại giao diện trước thay đổi, không còn là hành vi hiện tại.
