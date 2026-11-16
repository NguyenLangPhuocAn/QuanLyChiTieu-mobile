# Rà soát offline Thu/Chi và cache đọc — 16/11/2026

## Môi trường và giới hạn

- Android emulator `emulator-5554`, app debug riêng `com.mobile.dev`, mã JS local qua Metro. API và MySQL QA riêng; cổng production `3000` không sửa, `/health` trả 200 sau thử.
- Ngắt ADB reverse tới API QA, rồi force-stop và mở lại app. Đây là thử mất kết nối API, **chưa** chứng minh hoạt động khi tắt Wi-Fi/4G trên điện thoại thật hoặc khi không có Metro.
- Ảnh trong thư mục là ảnh gốc của dữ liệu QA giả. Không dùng ảnh hay tài khoản cá nhân để kiểm thử.

## Các bước và kết quả

1. Khi API QA không tới được, force-stop rồi mở lại app: Tổng quan hiện “Chế độ trên máy” và dữ liệu cũ ([ảnh](06-cold-start-api-offline-ready.png)).
2. Tạo khoản Chi 7.123 đ với ghi chú `OfflineQA16Nov`; app báo đã giữ bản nháp ngoại tuyến ([ảnh](10-offline-create-result.png)). Force-stop/mở lại khi vẫn ngắt API; trang Dữ liệu còn khoản chờ −7.123 đ ([ảnh](17-pending-after-restart.png)).
3. Nối lại API QA, đăng nhập lại do phiên QA đã hết hạn. Hộp so sánh hiện giao dịch trên máy và máy chủ chưa có giao dịch tương ứng, với ba lựa chọn dùng máy, giữ máy chủ, để sau ([ảnh](21-qa-login-result.png)). Chọn bản máy; Tổng quan phản ánh khoản Chi mới ([ảnh](22-sync-local-result.png)). Truy vấn database **QA** xác nhận đúng một giao dịch số tiền −7.123 đ. Không tạo trùng trong lần gửi này.
4. Ngắt API QA lần nữa, đính ảnh QA vào form giao dịch ([ảnh](30-image-pick-state.png)). Bấm lưu: app cảnh báo ảnh chưa giữ được offline, form và ảnh còn ở màn hình, không xếp giao dịch có ảnh vào hàng chờ ([ảnh](32-image-offline-blocked.png)). Kiểm thử tự động xác nhận hành vi không enqueue cả lúc app biết đang offline lẫn lúc request bị mất kết nối giữa chừng.
5. Force-stop/mở lại khi ngắt API: màn Ví hiển thị bản lưu trên máy và thời điểm cập nhật ([ảnh](33-wallets-offline-cache.png)). Bấm thêm ví bị chặn bằng thông báo cần kết nối ([ảnh](34-wallet-write-blocked.png)). Danh mục dùng cùng cache theo tài khoản; ca tự động xác nhận đọc cache không gọi API và chặn tạo danh mục offline. Chưa chụp trực tiếp màn Danh mục trên emulator trong đợt này.

## Kiểm tra mã

- `MainScreenDrafts`, `OfflineSessionSync`, `CategoriesScreen`: 45/45 ca qua; TypeScript `--noEmit` và ESLint các file sửa đạt.
- Ca đổi tài khoản tự động xác nhận bản nháp của tài khoản cũ không được đồng bộ từ hộp so sánh cũ. Bài thử đổi tài khoản trực tiếp trên điện thoại chưa thực hiện.
- Ca tự động bấm lưu hai lần trên cùng form ảnh khi request liên tiếp mất mạng xác nhận hai lần dùng cùng `client_request_id`; backend hiện kiểm tra mã này và từ chối cùng mã nếu nội dung khác. Chưa mô phỏng mất phản hồi **sau khi** server đã ghi ảnh/giao dịch trên Android.
- Ảnh hóa đơn hiện **không** được lưu bền vững trong hàng chờ. Vì vậy UI ngăn lưu offline; người dùng bỏ ảnh để giữ giao dịch hoặc chờ có mạng. Không coi OCR/AI là offline.
- Chưa thử sửa/xóa và widget lại trong đúng phiên QA này; bằng chứng Android trước đó ở `../2026-11-13-offline-transactions/README.md` và `../2026-11-11-offline-matrix/README.md`. Chưa thử xung đột server mới trong phiên này; dùng ca tự động và bằng chứng 13/11.
