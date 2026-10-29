# Widget Android và hàng chờ ngoại tuyến — 29/10/2026

## Môi trường và phạm vi

Android13/Pixel3a emulator5554, com.mobile.dev tách khỏi com.mobile. Source Metro local8081 cấu hình qa/metro.bill-backup.cjs; API Nest source QA3301 + MySQL schema QA riêng, user6/ví6. Tài khoản PREMIUM chỉ để lấy hai danh mục riêng của fixture; schema QA không seed danh mục hệ thống cho BASIC. Không reset schema, không đổi tài khoản/tiền của fixture trước. Server ổn định3000/MySQL production không sửa, không chạy release/web. Đây là kiểm thử ứng dụng local có native mới, không dùng APK production cũ.

## Các bước đã kiểm chứng

1. Online: đăng nhập QA6, tải hai danh mục và ví1.000.000đ. Tài khoản → Dữ liệu và xuất nhập → Thêm widget Nova → Android Add to home screen. Ảnh32–39 và local-profile-before.json. Snapshot native chỉ lưu scope/day/tổng/số chờ, không lưu token/ghi chú.
2. Dừng đúng process APIQA3301, giữ server3000. Đóng rồi mở lại app bằng widget: hồ sơ trên máy vẫn vào Tổng quan và có banner ngoại tuyến (46-offline-cache-open.png). Đây là mất kết nối API, không phải thử trên sóng4G thật. Cold bundle Metro mất nhiều phút; ảnh40–45 đang tải, không tính là chức năng đạt.
3. Khi API tắt, widget Chi mở form. Xem danh mục Chi widget QA/ví1triệu, nhập25.000đ và ghi chú Widget offline QA, bấm Lưu (52–62). Alert xác nhận chỉ giữ bản nháp. sql-offline-queued.json: DB0, ví1.000.000đ. local-offline-queued.json: PENDING1, gắn đúng backend. 64-widget-pending.png hiển thị1chờ, chưa cộng vào tiền đã chi.
4. Khởi động lại APIQA3301, từ launcher bấm Thu đưa app trở lại. Không bấm nút đồng bộ. sql-after-sync.json: đúng1giao dịch chi25.000đ, ví975.000đ; local-after-sync.json: hàng chờ0. 66-income-form-confirmed.png: đúng Thu widget QA/Khoản thu, ví975k; đóng form không tạo khoản thu.
5. Widget69 hiển thị Đã chi25.000VND, Đã thu0, chờ0. Đưa app trở lại thêm lần nữa (70): sql-repeat-resume.json vẫn1giao dịch/ví975k và local-repeat-resume.json vẫn0chờ. Không coi đây là thử timeout sau commit DB; chống trùng retry/đổi phiên/backend có kiểm thử service riêng.
6. Build/cài lại debug QA sau khi giảm chiều cao tối thiểu widget. Widget cũ giữ3hàng theo launcher; nhấn giữ và kéo giảm còn2hàng (73–75). 75-widget-compact-final.png/XML: bounds[23,96][851,724], chữ/số/nút không chồng. 76 bấm Ẩn tiền. Không khẳng định default size đã thử trên mọi launcher; cần máy thật/OEM. 71/77/78 là ảnh reload bundle, không là bằng chứng form đã mở lần hai sau cài.

## Kiểm thử tự động và bản dựng

Bổ sung cuối buổi: sau tải xong bundle mới, ảnh79 mở đúng form Chi từ widget compact;80 đóng không ghi. 81–87 tới Tài khoản và Đăng xuất;88 widget hiện “Mở app để đăng nhập”, cả hai số che lại và native prefs là `<map />` (scope/snapshot đã xóa). Không cần đăng nhập lại để giữ số liệu thử; SQL vẫn chỉ có giao dịch chi đã xác nhận. Ảnh81–85 là thao tác cuộn tìm nút, không phải tính năng mới.

Kết thúc: đưa emulator ra launcher, dừng đúng hai process QA3301 và Metro8081 đã mở cho buổi thử. Server ổn định3000 còn chạy, health HTTP200. Log Gradle giữ nguyên byte kể cả khoảng trắng cuối dòng; .gitattributes chỉ miễn kiểm tra khoảng trắng cuối dòng của hai bản log, không sửa PNG/XML/log gốc.

- jest-final.txt: 68/68 qua8bộ AuthContext/OfflineSessionSync/api/widget/billReminderLinking/MainScreenDrafts/App/offlineTransactionQueue. API/native trong Jest được mock; tách khỏi SQL/Android ở trên.
- TypeScript --noEmit và ESLint các file TS/TSX thay đổi: exit0. Kiểm tra cache/widget tiền tệ, loại chuyển ví, qua ngày báo chưa cập nhật; URL khác tài khoản/backend không được mở form.
- android-build.txt: installDebug + testDebugUnitTest QA x86_64 thành công2m31s,284tasks; test XML11tests/0failures/0errors (reminder planner hiện có, không gọi là11test widget).
- compact-build.txt: assembleDebug QA thành công1m17s,277tasks; adb install-r thành công. Không ký production, không phát hành GitHubRelease/APK/web.

## Những lần chưa đạt và điều chỉnh

00–17 là kiểm tra Metro/devmenu/loading;18–29 là tài khoản QA cũ và thao tác tìm đăng xuất, không ghi tiền.30–39 mới đăng nhập QA6/thêm widget. Lần48 widget chưa mở form vì fixture BASIC không nhận hai danh mục riêng; sửa fixture QA sang PREMIUM và tải cache2danh mục (49), không seed/sửa dữ liệu production. Lần51 bấm widget khi đã có form giữ nguyên form và báo để tránh mất nội dung. Một thao tác bấm ngay sau Home bị guard từ chối khi launcher chưa lấy focus; chụp lại68 rồi mới thao tác. Mọi PNG/XML giữ nguyên, các ảnh đang tải/đang sửa không tính là pass.

## Giới hạn và việc cần thử

Đăng nhập lần đầu/Google cần mạng. Chỉ hồ sơ xác thực trước đó, đúng backend, đã hoàn thiện và không buộc đổi mật khẩu mới mở offline; API401/403 đóng phiên. Draft/cached legacy chưa có backend cần tải lại/kiểm tra thủ công. Đồng bộ khi app đang active hoặc resume; chưa có WorkManager/headless sau force-stop. Widget lấy dữ liệu đã tải theo tiền tệ, không phải số dư ngân hàng/tổng toàn bộ server. Form vẫn có ví mặc định thông thường để người dùng kiểm tra/chọn lại; widget không truyền wallet_id. Vay/nợ/tạo ví/danh mục/Google/AI/OCR và ảnh tự upload offline chưa hỗ trợ. Sao lưu vẫn file thường. C2b lịch tiền/chi an toàn và tự đồng bộ lịch giữa thiết bị chưa hoàn tất. Chưa nghiệm thu mất sóng/4G, reboot/OEM, widget khóa màn hình và đăng xuất trên điện thoại thật. Không dùng thời gian tải devbundle làm benchmark APK release.
