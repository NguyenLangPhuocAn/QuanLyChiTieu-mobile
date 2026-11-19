# QA tự đối chiếu Thu/Chi khi API trở lại — 19/11/2026

## Môi trường

- Android emulator `emulator-5554`, app QA `com.mobile.dev` chạy JS local qua Metro 8081; API và MySQL QA tách riêng ở cổng 3303. Không thay server production hay APK đã phát hành.
- Giữ Wi-Fi emulator và Metro hoạt động; tháo `adb reverse tcp:3303` để mô phỏng **API không truy cập được dù điện thoại còn mạng**. Nối lại đúng reverse đó khi app vẫn mở. Bản debug vẫn cần Metro, nên đây chưa phải cold start độc lập khi tắt cả Wi-Fi/4G.
- Chỉ dùng tài khoản và ví QA. Không đưa token hay dữ liệu người dùng thật vào ảnh.

## Bước thử và kết quả

1. Mở form Thu/Chi: danh mục `Chi offline QA` và `Ví QA local` đã tải vẫn chọn được ([ảnh 03](03-form.png)). Ngắt reverse API, nhập Chi **3.471 đ**, ghi chú `QA_reconnect_19Nov`, bấm lưu. App xác nhận bản nháp ngoại tuyến và nói rõ chưa đổi số dư ([ảnh 06](06-preview.png)).
2. Nối reverse API khi app vẫn ở foreground và Wi-Fi không đổi. Sau vòng thử lại tối đa 20 giây, màn “Dữ liệu khi có mạng lại” tự hiện khoản Chi và ba lựa chọn bản máy, máy chủ, để sau ([ảnh 07](07-auto-after-api-return.png)). Chưa bấm lựa chọn ghi tiền trong bước này.
3. Chọn **Để sau**, force-stop/mở lại app khi API đang hoạt động. Màn đối chiếu hiện lại cùng bản nháp, chứng minh khoản chờ còn sau khi app bị tắt ([ảnh 09](09-reopen-choice.png)).
4. Chọn **Dùng thay đổi trên máy**. Màn đối chiếu đóng; Tổng chi tháng từ 19.671 đ lên **23.142 đ**, đúng cộng 3.471 đ ([ảnh 10](10-after-confirmed-sync.png)). Truy vấn chỉ đọc trong schema QA theo ghi chú trả đúng **một** hàng: ID 58, `amount=-3471`, `wallet_id=1`, ngày `2026-11-19`.

## Kiểm thử mã và giới hạn

- `OfflineSessionSync`, hàng chờ tạo Thu/Chi và hàng chờ sửa/xóa: **33/33** ca qua 3 bộ. Có ca Android network callback, API phục hồi không đổi Wi-Fi, người dùng chọn để sau, mất phản hồi khi đang đồng bộ, tài khoản cũ, hàng chờ bị đồng bộ thủ công trong lúc đối chiếu. TypeScript `--noEmit`, ESLint file sửa và Prettier đạt.
- Mất phản hồi **đúng lúc API đã ghi nhưng app chưa nhận kết quả** được thử ở mức mã với hàng chờ và mã yêu cầu ổn định; chưa tạo lỗi mạng chính xác theo thời điểm đó trên emulator trong đợt này. Lần thử Android dùng API mất kết nối trước khi lưu, rồi khôi phục khi app mở.
- Chưa chạy cold start trên APK standalone với cả Wi-Fi/4G tắt hoặc điện thoại thật. Ảnh hóa đơn chưa lưu bền vững offline và vẫn bị chặn. Ví, danh mục, tài khoản, quy tắc chỉ đọc bản đã tải phục vụ Thu/Chi; không có hàng chờ ghi cho các mục này.

## SHA-256 ảnh gốc

| Ảnh | SHA-256 |
| --- | --- |
| 03-form.png | `219400422801091d58d5a6889065996344be439047a7e58b967f531fefcc5124` |
| 06-preview.png | `587fa79e6b5a0b6e3a9283c3a968f78472297a5e4a0c7cc9a5272b3e32ed47f8` |
| 07-auto-after-api-return.png | `a64165c7d1220f2900bdbf02ea1cef2adccb046dd3d907526dd61426eac94bb3` |
| 09-reopen-choice.png | `4cdea8b7c00b8b5196e0dad517cdf2a9939be26dbacc0d3248f6e232c08771fb` |
| 10-after-confirmed-sync.png | `724715e707f9fe7cb4649bbde4e3912f2b0ed766a18f5bd92abe105ac608e8bc` |
