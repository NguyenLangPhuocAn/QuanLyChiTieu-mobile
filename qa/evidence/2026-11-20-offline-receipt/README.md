# QA ảnh hóa đơn trong giao dịch offline — 20/11/2026

## Môi trường

- Android emulator, app debug riêng `com.mobile.dev`, mã JS chạy từ Metro local.
- API cổng 3303 và MySQL QA tách biệt; ngắt/nối lại API bằng ADB reverse. Không đổi server production.
- Ảnh thử là ảnh chụp giao diện QA cũ, không phải hóa đơn hoặc dữ liệu cá nhân.

## Bước thử và kết quả

1. Ngắt kết nối API. Trong form Chi, chọn ví và danh mục QA, đính ảnh từ thư viện [ảnh form](01-receipt-selected.png). Lưu giao dịch; app xác nhận **giao dịch và ảnh đã lưu trên máy** [ảnh](02-offline-saved.png). Force-stop rồi mở lại: ảnh vẫn có trong thư mục riêng của app, dung lượng 154.252 byte.
2. Nối API. App hiện khoản chờ cùng nhãn ảnh, cho chọn bản máy, bản máy chủ hoặc để sau [ảnh](03-reconnect-review.png). Chọn bản máy: DB QA có đúng một khoản `-2345`, ID 61, có tệp ảnh và URL trả HTTP 200. Ảnh ở bộ nhớ riêng được xóa sau xác nhận. Khi mở form sửa [ảnh](04-synced-transaction.png), ảnh chưa hiển thị: bộ chọn ảnh đã đặt tên/MIME JPG cho nội dung PNG; máy chủ trả `image/jpeg` dù byte đầu là PNG. Đây là lỗi phát hiện trong QA, không tính ca đầu là hoàn chỉnh.
3. Sửa mã để nhận dạng JPG/PNG/WEBP từ byte ảnh, rồi lặp lại với khoản Chi `23.466` và ảnh được bộ chọn đặt tên `.jpg`. Khi API ngắt, app giữ ảnh PNG 229.989 byte trong bộ nhớ riêng [ảnh lưu](05-normalized-offline.png); force-stop/mở lại vẫn còn. Nối API, màn đối chiếu xuất hiện [ảnh](06-normalized-review.png). Chọn bản máy: DB QA có đúng một khoản `-23466`, ID 62; tệp ảnh tồn tại, URL trả HTTP 200 với `image/png`, byte đầu là PNG. Tệp ảnh đang chờ trên máy đã được xóa. Form sửa giao dịch hiển thị ảnh từ server [ảnh](07-normalized-synced.png).
4. Ca mã kiểm tra ảnh thiếu/đã đổi không gửi giao dịch, ảnh sai loại, ảnh lớn hơn 10 MB, lỗi tải ảnh sau khi giao dịch đã tạo và lần gửi lại không tạo thêm tiền. **25/25** ca trong hai bộ Jest đạt; TypeScript `--noEmit` đạt. Các trường hợp ảnh đã được ghi lên server nhưng mất phản hồi được xử lý bằng ID giao dịch đã lưu trong hàng chờ.

## Giới hạn

- Thử Android bằng Metro khi API QA ngắt; chưa thử APK standalone khi tắt cả Wi-Fi và dữ liệu di động, hoặc điện thoại thật.
- Chưa mô phỏng lỗi tải ảnh sau khi giao dịch tiền đã được ghi trên Android; ca này mới được kiểm tra ở tầng hàng chờ bằng Jest.
- Xác nhận đồng bộ giao dịch và ảnh vẫn do người dùng chọn. AI/OCR ảnh không được tính là hoạt động offline.

## SHA-256 ảnh QA gốc

```text
01-receipt-selected.png C78AE8D3F503CF0BBCD2403B6A2A8396723463694EE70F158D49B4F8EE477591
02-offline-saved.png 50643C651CAB3EE9AFA9B1643477AF18EDD604659DF9FB2562C0F8F3BCAD62D3
03-reconnect-review.png B27AA2FDDB8B263FD45D9CF058F576A9E342A84EF8D15C34EFCAA019C44B2F2D
04-synced-transaction.png 8A4E9D3AF2EFEDA30D939FF8189A5C61A8972BB862153159395874EAB813B5D9
05-normalized-offline.png 26A3B3CDA9F14F01A709A96683298CA02B91C800C7C830A1EABBB6A842F01684
06-normalized-review.png 2779C5AFA07083975CFC9FA4735E830F01895692C2D26E76BD5EB262FDA8C5FA
07-normalized-synced.png DBB2D9E4A4E7FC14C62CF39E447F93E1E4E589C89B3DDD35F8C9A280BFDBBE39
```
