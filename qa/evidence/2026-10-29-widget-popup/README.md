# Widget nhập giao dịch trên launcher — 29/10/2026

## Thay đổi và phạm vi

Đợt này sửa hiểu thiếu ở đợt 2: nút Thêm giao dịch/mic/camera không mở MainActivity/Tổng quan nữa, mà mở NovaWidgetEntryActivity trong task riêng với nền trong suốt. Đây là cửa sổ của chính app trên launcher, không xin quyền vẽ đè ứng dụng khác. Hủy hoặc xác nhận lưu xong đóng cửa sổ, trở lại launcher. Chọn ví rõ ràng; Thu/Chi và danh mục được kiểm theo dữ liệu hiện có. Bước Kiểm tra không ghi tiền. Xác nhận lưu khóa nhấn lặp và dùng cùng client_request_id khi phải giữ ngoại tuyến/thử lại. Không lưu ảnh quét; món/tổng tiền từ OCR có thể sửa trước xác nhận.

AuthProvider bầu một controller chung cho các React root trong cùng runtime, tránh hai bộ refresh/logout cạnh tranh. Bộ kiểm nguồn native và scope vẫn bắt buộc. Khi panel đang mở, MainScreen không nghe thao tác lắc để đọc ngân hàng phía sau. Lối tắt mở lặp giữ panel đang nhập. Đăng nhập/cache chưa đủ thì hướng dẫn Mở app; không đưa màn đăng nhập vào luồng nhập bình thường.

## Môi trường

Android13 Pixel3a emulator-5554, com.mobile.dev debug mới, Metro8081 đọc source local, Nest3301/MySQL schema QA loopback đã có. Dùng QA7/ví7; không tạo/reset/migrate database, không sửa dữ liệu production. Đầu đợt QA7 có 0 giao dịch/ví 1.000.000đ; fixture QA6 vẫn 1 khoản chi25k/ví975k. GEMINI_API_KEY của runner QA rỗng, không gọi model thật. Giữ server ổn định PID3764/port3000 và .env; health cuối HTTP200.

## Các bước thực tế và kết quả

- 00–04: launcher, widget rồi cửa sổ nổi. 02–03 là chuyển màn/tải bundle lạnh, chưa phải giao diện sẵn sàng; 04 mới thấy form và launcher phía sau. Có lần UiAutomator null root ở chuyển màn, driver thử lại và không dùng cây UI cũ.
- 05–06 Hủy về launcher. Có một lệnh nhầm tên helper không tồn tại sau khi chụp 05, không chạy được/không sửa dữ liệu; 06 xác nhận lại trạng thái UI. Không dùng exit0 của lệnh này làm bằng chứng.
- 07–11 nhập Chi25.000, chọn Ví nhập nhanh QA và xem trước −25.000/VND/Ăn uống QA. sql-preview vẫn 0 giao dịch/ví1triệu. 12 xác nhận, cửa sổ đóng, widget hiện Chi25k; SQL có đúng id24/−25k, ví975k.
- 13–18 Thu/Lương QA, nhập50k/chọn ví/xem trước. 19 tắt Wi-Fi và dữ liệu di động chỉ trên emulator; 20 xác nhận về launcher với 1 chờ đồng bộ, Thu vẫn0. SQL lúc ngoại tuyến vẫn chỉ id24/ví975k. Khôi phục cả hai mạng về trạng thái ban đầu bật; mở lại21–22, SQL có thêm đúng id25/+50k/ví1.025.000đ.
- 23 phát hiện lỗi: hàng chờ đã hết nhưng Thu trên widget còn0 do cache chưa làm mới. Không tính tên ảnh là kiểm thử đạt. Bổ sung callback làm mới cache sau lượt đồng bộ/xác thực của panel; kể cả lượt này báo0 vì React root khác có thể đã gửi trước. Có kiểm thử merge cache, giữ dòng lịch sử cũ và bỏ kết quả sau đổi scope.
- 24–27 nút mic từ widget mở panel và hỏi quyền thu âm, chọn từ chối; không thu âm môi trường. 28–30 sửa transcript bằng bàn phím “thu 5 nghin”, xem Thu5.000VND rồi điền vào form, giữ Lương QA. Đây không phải bằng chứng nhận dạng tiếng Việt thật.
- 31–35 chọn ví/xem trước5k, tắt mạng emulator và xác nhận thêm bản chờ. SQL lúc ngoại tuyến vẫn2 giao dịch/ví1.025.000. Bật lại mạng/mở panel: thêm đúng id26/+5k, tổng3 giao dịch/ví1.030.000. 36 vẫn là runtime trước khi tải đầy đủ sửa cache, Thu còn0; không tính là đạt.
- 37–40 nút camera widget mở com.android.camera2, chụp camera emulated và xem ảnh. 41 Done trở lại đúng panel nổi, có loading/Hủy đọc; 42 lỗi cấu hình API QA không có khóa AI, vẫn nhập tay được, không ảnh đính kèm/không giao dịch mới. Không dùng webcam/ảnh cá nhân, không gọi Gemini thật.
- 43 đóng về launcher; force-stop chỉ com.mobile.dev để bỏ runtime Fast Refresh cũ, không xóa dữ liệu. 44–45 tải lại source cuối, topResumedActivity là NovaWidgetEntryActivity. 46 đóng panel: widget hiện đúng Chi25.000/Thu55.000/0chờ. Đây mới là bằng chứng đạt của sửa cache. 47 che tiền trở lại. 48 là frame tải dữ liệu, không tính là form sẵn sàng.

49 là khung nhập cuối đã tải xong, launcher và widget che tiền ở phía sau, không còn LogBox của lần ngắt mạng. Để nguyên khung trống cho người dùng xem/thử; chưa chọn ví hoặc ghi khoản mới.

SQL cuối: QA7 đúng3 giao dịch (24/25/26), số dư1.030.000, receipt_image null ở cả3. QA6 không đổi. Hủy/mic/camera/xem trước không tạo khoản tiền khác. Ảnh và XML gốc được giữ nguyên, kèm SHA-256; không xuất native prefs chứa nonce/token vào Git.

## Kiểm thử

Jest cuối 88/88 qua11 bộ, 12 ca mới so với76 trước đợt này, gồm auth chia sẻ/handoff, bắt chọn ví/danh mục/tiền tệ/ngày, preview/xác nhận, khóa nhấn lặp, giữ khóa khi lỗi mạng, không xếp hàng lỗi400/đổi phiên, cache sau commit lỗi không tạo lại, camera không đính kèm ảnh, làm mới cache khi root khác đã đồng bộ. TypeScript noEmit và ESLint các file thay đổi đạt. Các API/native/model trong Jest là mock.

Build/cài installDebug + testDebugUnitTest QA x86_64 thành công2m33s/284tasks; 11 test JVM planner hiện có, không gọi là test native widget mới. Lượt Jest đầu có lỗi hoist mock/camera mock và cảnh báo key, đã sửa; giữ log chẩn đoán riêng. Bản debug local không phải phát hành APK production.

## Giới hạn và bàn giao

Chưa nghiệm thu tiếng nói/OCR AI thật/điện thoại vật lý/OEM/font lớn. Thông báo LogBox debug do ngắt kết nối Metro trong thử offline còn trong các ảnh trung gian; ảnh sau tải lại source cuối không dùng các frame này làm bằng chứng UI sạch. Không cam kết tự đồng bộ sau force-stop; hàng chờ tiếp tục khi mở lại. Ảnh offline chưa được xếp hàng upload; hóa đơn định kỳ C2b còn ngoài phạm vi. Khi process bị hệ điều hành hủy trước khi xác nhận lưu, form nhập chưa có cam kết khôi phục.

Giữ backend QA3301/Metro8081 chạy cho người dùng thử local, không đăng xuất QA7. Không phát hành APK, chạy workflow release, cập nhật web, deploy/restart backend production. Tài liệu kỹ thuật tham khảo: [Android activity/task](https://developer.android.com/guide/topics/manifest/activity-element), [React Native Android integration](https://reactnative.dev/docs/integration-with-android-fragment).
