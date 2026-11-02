# Android QA demo: mất mạng rồi kết nối lại (02/11/2026)

## Phạm vi

- Android emulator, gói `com.mobile.dev`, tài khoản và API/MySQL QA riêng. Ứng dụng debug tải mã JavaScript từ Metro nội bộ khi đang có mạng; không dùng APK production.
- Đăng nhập và tải dữ liệu khi có mạng, sau đó bật chế độ máy bay bằng `adb shell cmd connectivity airplane-mode enable`. Lệnh ping `10.0.2.2` trả `Network is unreachable`.
- Chỉ điều hướng, xem dữ liệu và làm mới. Không tạo, sửa, xóa giao dịch hoặc thay số dư để làm demo.

## Ảnh gốc và kết quả

| Tệp | Kết quả quan sát |
| --- | --- |
| `06-offline-home.png` | Tổng quan vẫn mở với biểu tượng máy bay và tài khoản QA đang đăng nhập. |
| `11-offline-cache.png` | Dữ liệu lưu trên máy báo 14 giao dịch đã tải, không có khoản chờ đồng bộ. |
| `13-offline-history.png` | Lỗi được tái hiện: Lịch sử báo không kết nối dù có cache. |
| `22-offline-history-loaded.png` | Sau khi sửa và nạp mã local, Lịch sử hiển thị 14 giao dịch trong cache, có thông báo cần mạng để xem đầy đủ/sửa. `22-offline-history-loaded.xml` xác nhận nút sửa giao dịch 35 `enabled=false`. |
| `23-reconnect-refresh.png` | Tắt chế độ máy bay, ping `10.0.2.2` thành công, kéo làm mới Lịch sử; thông báo cache biến mất, dữ liệu máy chủ hiện lại. `23-reconnect-refresh.xml` xác nhận nút sửa giao dịch 35 `enabled=true`. |

Các PNG/XML từ `01` đến `23` giữ lại trình tự thử, bao gồm khung hình đang chuyển màn hoặc overlay của Metro; chỉ các ảnh trong bảng là bằng chứng cho kết luận. Dữ liệu hiển thị là fixture của tài khoản QA.

## Thay đổi mã và kiểm tra

- Lịch sử dùng trang cache đã lưu khi mất mạng với truy vấn mặc định; không coi cache là toàn bộ lịch sử. Ẩn tổng thu/chi do cache có thể thiếu giao dịch và khóa sửa khi chỉ có dữ liệu trên máy. Có mạng/làm mới thì trở lại dữ liệu máy chủ. Lỗi HTTP 4xx không dùng cache để che lỗi.
- `npx jest --runInBand __tests__/HistoryOffline.test.tsx __tests__/HistoryScreen.test.tsx __tests__/AuthContext.test.tsx __tests__/OfflineSessionSync.test.tsx --silent --no-coverage`: 4 bộ, 22/22 đạt (`tests.log`).
- `npx tsc --noEmit --incremental false` và ESLint hai file thay đổi: đạt.
- Sau demo đã tắt chế độ máy bay; ping host QA thành công. Production server và APK không thay đổi.

## Giới hạn

- Ảnh này chứng minh phiên đã đăng nhập tiếp tục dùng dữ liệu cache khi mạng rớt. Bản debug cần Metro khi khởi động nguội, nên chưa dùng ảnh để khẳng định mở app từ trạng thái tắt hẳn khi offline. Khôi phục phiên offline và thử lại khi có mạng được kiểm bằng unit test `AuthContext`/`OfflineSessionSync`; cần thử bản standalone trên điện thoại thật để xác nhận hành vi cold start.
- Cache Lịch sử chỉ có các giao dịch đã tải cho Tổng quan. Bộ lọc/tìm kiếm và sửa giao dịch cần kết nối.
