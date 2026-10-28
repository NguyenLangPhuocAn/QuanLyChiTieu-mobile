# LỊCH SỬ THỬ NGHIỆM ĐÃ BỎ

Các ảnh/log bên dưới thử mã hóa trước khi người dùng yêu cầu bỏ toàn bộ mã hóa ngày28/10. Không phải nghiệm thu phiên bản hiện tại. Xem thư mục ../2026-10-28-plain-backup và ../../BILL-BOOK-BACKUP.md cho kết quả file thường. Các số143/33và giao diện mật khẩu chỉ thuộc lần thử cũ.

# C2a — sao lưu lịch, 28/10/2026

Android13/API33, emulator-5554/Pixel3a, app riêng `com.mobile.dev`; Metro/source local, Nest/MySQL loopback QA. Không build native, ký/phát hành APK, đổi web hoặc triển khai server ổn định. Dùng tài khoản activity QA4, ví4; file thử chỉ có dữ liệu QA. Password/token/session và file mã hóa sinh thử nằm trong .runtime bị ignore, không đưa lên Git.

## Mốc và giới hạn bằng chứng

- 00DevMenu,01Reload,02–03là chờ bundle/restore session, **không phải ảnh đạt**.04dashboard tài khoản4.
- 05–08bấm mục Hóa đơn khi nó sát thanh điều hướng đã mở nhầm bản nháp giao dịch (nút cộng ở giữa thanh dưới). XML còn liệt kê node màn Tài khoản phía sau, nên không dùng XML một mình để nói đã vào màn hóa đơn. Không có ảnh09 vì không tìm được nút sao lưu.
- 10–11vẫn ở form nháp, chưa tạo giao dịch.12bấm Back đưa app ra Home, không đóng bản nháp. Không có ảnh13vì driver chặn thao tác khi app không foreground.14mở app lại vẫn còn nháp.15cuộn đến header,16bấm **Đóng bản nháp giao dịch**;17cuộn Account để mục hóa đơn nằm hẳn phía trên thanh dưới.
- 18mở đúng màn Hóa đơn,19mở công cụ sao lưu,20thấy hai trường mật khẩu được che và nút tạo/chọn file. Các ảnh này xác nhận giao diện, chưa xác nhận thao tác save/restore.
- Lần chạm ô mật khẩu sau20làm giả lập treo: UiAutomator không trả về; đã dừng đúng tiến trình dump QA, thêm timeout30s cho driver. Không có ảnh21/22hợp lệ. Screencap phụ thu được0byte, không coi là bằng chứng và không đưa vào thư mục này. Reboot từ adb trễ/timeout, thiết bị offline; tiếp tục phục hồi AVD với dữ liệu được giữ nguyên. Không coi các lần thử đó là khôi phục file thành công.

## Kiểm chứng không phụ thuộc giao diện

- Mobile18suite/143test;11ca mới về export/preview/restore, chống stale file/book/session, single flight, native picker cancel/background, lỗi lưu và không ghi tiền. Sáu ca domain được chạy lại với TRACKED/IGNORED/LATER/reviewedAlerts để kiểm metadata không bị mất. Native/HTTP trong Jest là mock.
- Backend6suite/33test;7ca mới, gồm vòng mã hóa, ràng buộc JWT account, tamper/wrong-password, DTO, parser HTTP Nest. Một lỗi parser source khiến login400 trong QA đã sửa, kiểm hồi quy loginJSON và giới hạn từng route. Các stack413trong log parser là trường hợp chủ động thử file quá lớn, không phải suite lỗi.
- `api-proof.json`: Nest/MySQL QA HTTP thật, login201,export/preview201; mật khẩu sai/sai owner/tamper400, không JWT401; book159.976bytes đọc được. Các API lịch không ghi DB; đăng nhập vẫn tạo phiên xác thực. Không dùng kết quả này để nói SAF Android đã chạy thành công.
- `test-summary.txt` chỉ chép tổng kết kiểm thử; SQL/native proof ở cuối buổi phân biệt metadata với giao dịch/số dư. SHA256SUMS bảo toàn byte; `.gitattributes` tắt chuyển newline trong folder.

Điện thoại thật/OEM/4G, provider SAF cloud chưa thử. Backup cần mạng và gửi book/mật khẩu tới API JWT, không phải mã hóa đầu cuối hoặc backup offline. Chưa tự đồng bộ hoặc nối chi an toàn. Source/API mới chưa có trong APK/server production.
