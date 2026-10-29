# Sửa lỗi widget — 30/10/2026

## Lỗi và thay đổi

- Số tiền món dùng Number trực tiếp làm94.000 thành94 và xóa nội dung lại hiện0. Đổi sang bản nhập chuỗi và bộ xử lý tiền tệ chung: VND có dấu nhóm, USD giữ thập phân, chỉ chuyển thành số khi kiểm tra. Số tiền giao dịch cũng dùng cùng bộ xử lý.
- Trạng thái React cập nhật chậm hơn hai lần bấm camera liên tiếp. Thêm khóa ref ngay từ lần đầu và khóa theo lượt đọc; Hủy khiến kết quả muộn bị bỏ, không ghi đè nhập tay. Mở camera dừng/ẩn phần giọng nói trước.
- Ban đầu chưa có cache thì form báo thiếu dữ liệu; subscriber cũ chỉ cập nhật data mà không mở lại form. Nay cache đến muộn có thể khởi tạo lại đúng lối tắt; có nút Thử lại khi lỗi. Lối tắt sai scope/nonce vẫn bị chặn.
- Khi app chính nhường controller phiên đăng nhập cho widget, nhánh Controller/Follower cũ tạo lại cây giao diện và xóa bản nhập. Nay controller và cây con tách riêng; controller vẫn chỉ có một chủ, giá trị khôi phục vẫn được công bố. Panel giữ Thu/Chi, danh mục, ví, tiền và ghi chú khi khôi phục lại cùng lối tắt. Đây là giữ qua chuyển controller, không hứa giữ qua process death.
- Sau POST đã thành công, widget cũ chờ thêm GET ví trước khi đóng. Nay cập nhật khoản đã xác nhận vào cache rồi trả SAVED; ví tải nền có kiểm phiên/server, đọc cache mới để giữ các khoản xuất hiện sau đó. Lượt tải danh sách cũng đọc cache sau khi mạng trả về để không mất khoản vừa lưu. Lỗi cache sau commit không biến thành khoản tiền mới.
- Native hiển thị loading/Đóng trước khi React sẵn sàng, chỉ bỏ loading khi panel layout. Tham chiếu yếu tới activity cho phép bỏ loading cả khi camera ngoài app đang mở. Tăng chiều cao tối thiểu widget đầy đủ từ110 lên210dp, giữ đủ hàng/nút ở kích thước nhỏ được hỗ trợ. Tái dùng định danh PendingIntent theo widget/action, không tạo một token hoạt động mới cho mỗi timestamp vẽ lại. Activate cùng scope và snapshot giống nhau không vẽ lại.

## Môi trường

Pixel3a Android13/API33 x86_64, com.mobile.dev debug mới, Metro8081 nguồn local, Nest3301/MySQL QA loopback hiện có. Đăng nhập QA8. Khởi động lại các tiến trình QA vì máy đã reset: backend17528/Metro17120; không dừng PID3764/server3000. GEMINI_API_KEY của QA rỗng, mail/payment ngoài không bật. Không sửa config production/.env, schema hoặc dữ liệu thật.

## Các bước thực tế

- 00 launcher có mini.01 là loading bản đầu còn hẹp/chữ bị cắt, giữ làm bằng chứng lỗi và không tính đạt.02 form mở được. Sửa layout native, cài lại;03 launcher,04 loading đủ chữ/nút và màu cam,05 vào form thật.
- 06–08 nhập25.000, đóng bàn phím vẫn giữ tiền, mở đủ12danh mục Chi. Khi đang tiếp tục sửa source, Fast Refresh đã làm runtime chuyển lại form; thao tác chọn Khác của lượt09 bị driver từ chối vì nút không còn trên màn hình, không ghi dữ liệu và không có ảnh09.10–11 chọn ví. Không dùng lượt đang Fast Refresh này làm nghiệm thu giữ bản nhập.
- 12–15 chạy lại source cuối: nhập25.000, đóng bàn phím, chọn Khác/category22, giữ Ví tiền mặt/ví8.16 Kiểm tra thấy−25.000VND, ví/danh mục/ngày30/10. SQL lúc này0giao dịch/ví1triệu.
- 17 tắt Wi-Fi và dữ liệu di động chỉ trên emulator (ban đầu đều bật1), bấm Xác nhận lưu.18 đóng về launcher;19 widget đầy đủ hiện1chờ đồng bộ. SQL lúc offline vẫn0/ví1triệu, chưa ghi tiền trước server xác nhận. Có LogBox debug do mất kết nối Metro trong ảnh trung gian.
- Khôi phục cả Wi-Fi/dữ liệu di động và reverse8081.20 vẫn ở launcher.21–22 mở lại form từ widget đầy đủ để đồng bộ;23 Hủy form trống về launcher. Database có đúng1giao dịch id27, amount−25000, currencyVND, category22, receipt_image null, ví8 còn975000.24 hiện đúng Chi25.000/Thu0/0chờ, chưa tạo khoản thứ hai.
- 24–27 bật/tắt che tiền4lần, kết thúc che tiền. Đếm PendingIntentRecord của riêng packagecom.mobile.dev trong dumpsys trước/sau vẫn15→15. Không lưu dumpsys/URI có nonce. Đây là kiểm tra không tăng số token qua4lần repaint, không phải benchmark heap hoặc đo pin.
- 28–29 nút camera widget mở camera Android ngoài app, không chụp webcam/ảnh cá nhân.30 Back/Hủy camera trả đúng form (Thu theo widget đầu tiên đang chọn),31 không còn loading native, nhập tay vẫn được.32 Hủy về launcher,33 trở lại trang mini. Không gọi OCR AI thật hoặc lưu khoản tiền mới từ camera.

SQL cuối vẫn1giao dịch/id27/ví975k; QA7 trước đó giữ3giao dịch/ví1.030.000. Khôi phục mạng emulator về1/1. Giữ QA/Metro chạy cho người dùng thử local.

## Kiểm thử và giới hạn

Jest cuối101/101 qua12bộ,9ca mới: cache đến muộn, tiền VND/ô món trống, USD thập phân, khóa camera và bỏ kết quả hủy, POST thành công không chờ GET ví chậm, merge khoản vừa lưu, bỏ kết quả ví sau đổi phiên, giữ cây con khi chuyển controller, giữ bản Thu/ví/danh mục/tiền qua auth restore. API/native/model trong Jest là mock. Các bộ auth/app/offline/chống trùng hiện có vẫn đạt.

diagnostics-before ghi lại ba lỗi cache/món/camera và một timeout của test hiện có khi đang khởi động emulator/chạy build; lượt service lúc đó đã nạp phần source sửa nên không gọi toàn bộ log là baseline nguyên bản. diagnostics-handoff-before tái hiện mất“Grab25.000” thành chuỗi rỗng trước sửa sharedProvider. Sau sửa, kiểm tra lifecycle/auth/panel đạt18/18 và toàn bộ12bộ đạt101. TypeScript ban đầu báo callback setImmediate chưa đúng kiểu; đã sửa và noEmit cuối exit0. ESLint bỏ cảnh báo no-void, cuối exit0/không cảnh báo.

Native installDebug/testDebugUnitTest QA mới đạt83s; sau sửa layout loading cài lại21s. JVM11/11 thuộc BillReminderPlannerTest hiện có, không phải11ca widget native. Ảnh/XML gốc và manifest SHA-256 được giữ; log text chuẩn hóa xuống dòng để đối chiếu index. Helper đọc SQL đầu tiên chọn nhầm cột type không tồn tại đã thất bại an toàn, sửa phép đọc theo schema rồi mới dùng sql-confirmed-rows làm bằng chứng; không thay schema.

Chưa đo tốc độ release/điện thoại thật/OEM/font lớn, chưa nhận dạng giọng nói/OCR AI thật. Chưa hứa khôi phục bản chưa xác nhận sau process death hoặc tự đồng bộ sau force-stop. Không build/ký/phát hành APK production, workflow release, cập nhật web hoặc restart server3000; health cuối200. Excel chỉH21/I21 và chiều cao hàng21 được thay, dữ liệu/công thức/định dạng/cấu hình khác đối chiếu giữ nguyên. C2b/đồng bộ lịch/ảnh offline vẫn ngoài đợt này.
