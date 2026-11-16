# QA offline đợt 2 — 16/11/2026

## Môi trường

- Android emulator `emulator-5554`, app QA debug `com.mobile.dev`, mã local qua Metro. API và MySQL QA riêng (`3304` qua ADB reverse `3303`). Không dùng tài khoản hay ảnh cá nhân.
- Trước khi thử, nạp dữ liệu QA trên Tổng quan: [ảnh](08-login-result.png). Trong bài thử ngắt Wi-Fi và dữ liệu di động bằng `svc wifi disable`/`svc data disable`, bỏ reverse API QA; `ping 8.8.8.8` báo `Network is unreachable`.
- Không build APK. Bản debug không đóng gói JS; Metro vẫn cần mạng/ADB reverse để khởi động và nạp mã mới. Không đụng server production, web tải APK hoặc bản release.

## Bước thử và kết quả

1. Tắt Wi-Fi/dữ liệu, force-stop rồi mở app QA: màn Android báo `Unable to load script` ([ảnh gốc](09-airplane-start.png)). **Cold start offline chưa đạt trên môi trường debug này**. Cần kiểm tra bản standalone trên điện thoại thật khi người dùng chốt bản cập nhật; không dùng ảnh này làm bằng chứng chức năng offline đạt.
2. Nạp app khi còn kết nối Metro, tắt Wi-Fi/dữ liệu khi app đang chạy. Form Thu/Chi vẫn mở được ([ảnh](13-radio-off-form.png)); chưa lưu giao dịch trong lượt này.
3. Từ Lịch sử mở Tìm giao dịch khi app vẫn chạy, chọn bộ lọc và chờ API QA thất bại. Màn chuyển sang tìm trong **3 giao dịch đã tải trên máy**, ghi thời điểm cập nhật và cảnh báo kết quả có thể thiếu ([ảnh](33-search-cached-result.png)).
4. Chọn nhóm **Chi**, vẫn thấy 3 kết quả trong dữ liệu QA đã tải ([ảnh](34-search-expense-offline.png)). Nhập `OfflineQA16Nov`: còn đúng 1 kết quả, số tiền 7.123 đ ([ảnh](35-search-note-offline.png)). Đây là tìm kiếm và lọc cache, không phải danh sách đầy đủ từ máy chủ.
5. Khi API QA không chạy nhưng Metro vẫn cấp mã debug, mở Quy tắc thông minh bằng tài khoản QA local. Tạo quy tắc `QAoffline16` cho danh mục Chi offline QA ([ảnh](43-rules-created.png)); xóa quy tắc cuối cùng ([ảnh](44-rules-deleted.png)), rời màn rồi vào lại ([ảnh](46-rules-reopen-settled.png)). Sau `force-stop` và mở lại app, danh sách vẫn trống ([ảnh](51-rules-after-restart.png)). Đây là phép thử lưu cục bộ khi mất API, **không phải** cold start khi cả Wi-Fi/dữ liệu di động đều tắt vì bản debug cần Metro.

## Kiểm tra mã

- Tìm kiếm cache lọc theo ghi chú không dấu, ngày, ví, danh mục, Thu/Chi, số tiền, hashtag và nhóm vay/nợ; áp dụng thay đổi Thu/Chi đang chờ trước khi lọc. Ca màn hình xác nhận offline không gọi API.
- Thống kê: offline không gọi API thống kê; khi không có cache, không hiển thị số 0 như kết quả. Khi tính từ cache, hiện số giao dịch và thời điểm tải. Lịch tiền và mức chi an toàn hiện thời điểm cache, cảnh báo sau 24 giờ hoặc khi không rõ thời điểm.
- 17/17 ca tập trung qua 4 bộ (Tìm giao dịch, bộ lọc cache, Thống kê, Lịch tiền); thêm 86/86 ca hiện có cho quy tắc, hóa đơn định kỳ, lịch tiền và nhắc Android. TypeScript `--noEmit` và ESLint file sửa đạt.

## Chưa xác nhận

- Chưa thử lại thêm/sửa/xóa Thu/Chi và widget với **cả Wi-Fi lẫn dữ liệu di động tắt**, đóng/mở app, reconnect 3 lựa chọn, retry sau khi server đã ghi, xung đột, đổi tài khoản và ảnh sau khi tắt app trong đúng phiên này. Bằng chứng QA mất API ở [đợt trước](../2026-11-16-offline-audit/README.md) và [sửa/xóa/xung đột 13/11](../2026-11-13-offline-transactions/README.md) không thay thế cold start standalone.
- Các ca quy tắc, hóa đơn, lịch tiền và nhắc Android ở trên là kiểm thử mã; chưa kiểm trọn luồng tạo/sửa/xóa sau khi tắt app trên Android thật. Chưa triển khai ghi offline cho Ví/Danh mục.
- Quy tắc đã thử riêng tạo/xóa và giữ trạng thái sau khi tắt mở app trên emulator mất API. Chưa thử lại với cả hai radio tắt, nhiều tài khoản và quy tắc Thu trên điện thoại thật.

## SHA-256 ảnh gốc

| Ảnh | SHA-256 |
| --- | --- |
| `08-login-result.png` | `500786F4DA4CFA007FD6514D22FF278F254E3A9BEF8C1CD4B10AED77EF144912` |
| `09-airplane-start.png` | `0D7753AE982A61E5C3D253DCCA2F0163DC97DA2B174A04A980F4F129C806C196` |
| `13-radio-off-form.png` | `591AB0E578F1155059254E36A98C0D2A716C8527E1C125AB18507C2BF9666405` |
| `33-search-cached-result.png` | `7D388481807F88D5F4067E3970689EA7C5EA3867D915BB269947944FA1BF0605` |
| `34-search-expense-offline.png` | `4A9F1A810C746A8216D1C598ED1F3FBF9790D69072767CE22B18933268D7AC6F` |
| `35-search-note-offline.png` | `E77266F9F75A21568B8AFCB6D470D53C6E627B3CB59C423B869EAF0EAA7FBF5A` |
| `43-rules-created.png` | `785932F4D1D4043D5F1ED4D1FD3B6E608DAA18AEC068C3E8B8FB130B3D80A331` |
| `44-rules-deleted.png` | `5D2A0FE993E2F145D4AFA1817A8A34DD6F96458E7349AE6FD0E936205443CEAD` |
| `46-rules-reopen-settled.png` | `70D7A61B1BA106D8384E3BEFB2EFEA366C85C3430B54EEC3B0B3ECD46BBA94EA` |
| `51-rules-after-restart.png` | `3EA258B93ABAE1A779708A90C90344DC4B720BE3DDC7A26766DAD72731CAC242` |
