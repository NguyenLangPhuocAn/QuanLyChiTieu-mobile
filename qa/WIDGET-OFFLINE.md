# Widget và ngoại tuyến — 29/10/2026

## Sửa lỗi và tối ưu widget — 30/10/2026

- Sửa số tiền VND nhập có dấu nhóm, thành tiền món không bị đổi94.000 thành94 hoặc buộc hiện0 khi xóa. USD giữ phần thập phân. Khóa camera ngay lần bấm đầu, không nhận kết quả đã hủy; mở camera dừng phần giọng nói đang nhập.
- Cache tải muộn có thể khôi phục form ngay tại chỗ, có Thử lại. Giữ cây giao diện khi main/widget chuyển chủ phiên đăng nhập, giữ Thu/Chi, ví, danh mục và tiền sau khôi phục cùng phiên. Kiểm widget/nonce/scope vẫn bắt buộc.
- Ghi tiền đã xác nhận không chờ thêm GET ví mới đóng; ví cập nhật nền có kiểm phiên và đọc cache mới. Lượt tải danh sách đọc cache sau khi mạng trả về để giữ khoản vừa lưu. Native có loading/Đóng trước khi React sẵn sàng, sửa khung loading sau khi nhìn ảnh thật; nâng chiều cao tối thiểu widget đầy đủ210dp để không co mất nút. Tái dùng PendingIntent và bỏ vẽ lại snapshot giống nhau.
- Jest101/101 qua12bộ (9ca mới), TypeScript/ESLint đạt. Debug local build/cài83s, sửa loading/cài21s; JVM11planner hiện có đạt. Android13 com.mobile.dev/Metro8081/API3301/MySQL QA: preview/offline chưa đổi SQL,1chờ; mở lại online đúng1khoản id27/−25.000/VND/category22/ví8, số dư975.000. WidgetChi25k/Thu0/0chờ; bật/tắt che tiền4lần PendingIntent15→15; camera ngoài app/Hủy về form đạt.
- Không nghiệm thu AI OCR/giọng nói thật hoặc điện thoại/OEM/hiệu năng release. Một lượt đầu bị Fast Refresh khi còn sửa source, đã chạy lại với source cuối; không gọi ảnh loading hẹp hoặc frame chuyển màn là đạt. Giữ server3000/.env, health200; không phát hành APK/web. Excel chỉH21/I21 và chiều cao hàng21, nhật ký tuần/patch note/bằng chứng cập nhật. Các mục C2b/đồng bộ lịch/ảnh offline chưa đổi. Bằng chứng mobile/qa/evidence/2026-10-30-widget-fixes/README.md.


## Mini 1×1 — đợt 5, 29/10/2026

Nhấn giữ launcher → Widgets → Sổ Thu Chi Nova → Nova · Mini 1×1, hoặc vào Tài khoản → Dữ liệu và xuất nhập → Thêm widget Nova → Mini 1×1. Mini dùng một ô và icon N+, chạm mở khung nhập trên launcher. Có cả lựa chọn bản đầy đủ4×2. Giữ bước chọn ví, kiểm tra/xác nhận; không ghi tiền khi chỉ chạm icon hoặc Hủy. Bản hiện tại mới cài local com.mobile.dev, chưa có trong APK production. Biên bản: evidence/2026-10-29-widget-mini/README.md.

## Danh mục đầy đủ — đợt 4, 29/10/2026

Bộ chọn panel dùng thẻ/icon cũ, có tìm kiếm và tổng số mục. Danh mục theo tài khoản từ API/cache, không giới hạn ở vài mục thử QA. Để xem bộ mẫu đủ12Chi/5Thu trên local dùng riêng QA8; không chuyển dữ liệu thật vào QA. Bộ chọn native lấy cùng danh sách đã tải. Biên bản: evidence/2026-10-29-widget-categories/README.md.

## Cửa sổ nổi trên launcher — đợt 3, 29/10/2026

Nút Thêm giao dịch, mic hoặc camera nay mở khung riêng trên launcher; không mở Tổng quan. Chọn ví, kiểm tra các trường rồi Xác nhận lưu; Hủy/Lưu xong trở về launcher. Thiếu đăng nhập hoặc cache mới cần Mở app để chuẩn bị. Ảnh quét không đính kèm. Các mô tả mở form trong app bên dưới là lịch sử trước đợt sửa này. Bằng chứng mới: evidence/2026-10-29-widget-popup/README.md.

## Bổ sung widget29/10 đợt2

Chọn Thu/Chi ngay trên widget, bấm tên danh mục để chọn từ danh sách đã tải; mỗi loại nhớ lựa chọn riêng. Bấm Thêm giao dịch để mở form, mic để nghe/xem trước hoặc camera để chụp/quét. Tất cả vẫn cần kiểm tra và bấm Lưu. Ảnh quét không tự đính kèm; muốn lưu ảnh thì bấm Thêm ảnh hóa đơn thủ công. Snapshot native nay có ID/tên/loại danh mục để chọn, không có token, ghi chú hoặc tên/số dư ví. Native chooser không gọi API, không ghi tiền.

Biên bản mới: evidence/2026-10-29-widget-input/README.md. Các kết quả widget hai nút phía dưới là mốc ban đầu trước mở rộng. Phần offline/auth/sync vẫn giữ nguyên.

## Luồng sử dụng

Đăng nhập online một lần và tải ví/danh mục. Sau đó mất mạng vẫn mở được hồ sơ trên máy và ghi thu/chi thường vào hàng chờ. Không phải đăng nhập mới bằng mật khẩu offline và không cấp quyền API bằng hồ sơ local. Khi có mạng/app mở lại, xác thực server rồi POST cùng client_request_id (hoặc source_ref ngân hàng), server idempotency xử lý trùng và cập nhật DB/số dư; chỉ sau xác nhận mới xóa bản nháp.

Android: Tài khoản → Dữ liệu và xuất nhập → Thêm widget Nova. Hoặc nhấn giữ launcher → Widget → Nova · Thu chi nhanh. Thêm giao dịch mở form; không tự ghi tiền. Form có ví mặc định để kiểm tra/chọn lại, khi đang có form chưa lưu sẽ giữ form cũ và báo. Widget hiển thị thu/chi thường của hôm nay trong dữ liệu đã tải, theo tiền tệ tài khoản, không phải số dư ngân hàng. Bấm Hiện tiền để bỏ che; đăng xuất/đổi tài khoản xóa dữ liệu hiển thị của widget. Snapshot quá ngày báo chưa cập nhật.

## Quy tắc dữ liệu

- Hồ sơ có backend và tài khoản của lần đăng nhập đã xác nhận, chỉ dùng để vào giao diện/cache. Đăng nhập lần đầu, Google, hồ sơ cần hoàn thiện/đổi mật khẩu vẫn cần mạng. Khi API xác nhận401/403 thì đóng phiên; lỗi mạng/5xx giữ hồ sơ. Không lưu mật khẩu đăng nhập vào cache.
- Bản nháp lưu trước khi đóng form. Lỗi lưu máy giữ form, không báo thành công. Không đổi số dư theo dự đoán; widget ghi riêng số bản chờ. API lỗi mạng hoặc xác thực dừng lượt gửi đầu tiên để tránh lặp hàng loạt.400cần người dùng sửa. Phiên/account/backend đổi không gửi tiếp bản nháp cũ.
- Draft cũ thiếu backend phải kiểm tra/thử lại trong Dữ liệu và xuất nhập. Hàng chờ hỏng được giữ nguyên, chặn ghi đè. Snapshot/cache cũ thiếu backend không được dùng như dữ liệu của server mới.
- Đồng bộ khi có mạng trong app hoặc khi trở lại app. Không có Android WorkManager/headless sync sau force-stop. Không phát biểu là luôn đồng bộ dù app bị tắt.
- Vay/nợ/tạo ví/danh mục/AI/OCR/Google vẫn cần mạng. Ảnh hóa đơn ngoại tuyến chưa được sao chép bền/xếp lịch upload; form báo thêm lại ảnh sau. Sao lưu vẫn là file thường theo yêu cầu.

## Thiết kế native

RemoteViews/AppWidgetProvider và PendingIntent bất biến, chỉ mở activity tường minh. Snapshot native có tổng tiền, số chờ và ID/tên/loại danh mục; không chứa JWT, ghi chú hoặc tên/số dư ví. Widget xử lý toggle/chọn danh mục khi appJS không chạy; nhận mạng từ ConnectivityManager, không polling. Liên kết được kiểm tra scope/account và mã riêng của widget trong native trước khi chuyển sang form/mic/camera; URL không mang số tiền hoặc wallet. Mã riêng không được đưa vào log/bằng chứng.

Nguồn kỹ thuật: [Android app widgets](https://developer.android.com/develop/ui/views/appwidgets), [cập nhật widget](https://developer.android.com/develop/ui/views/appwidgets/advanced). Tham khảo chức năng nhập nhanh từ [Money Lover](https://moneylover.zendesk.com/hc/en-us/sections/34632713589401-New-features); giao diện dùng theme Nova hiện có.

## Kiểm thử

Trạng thái thực tế và PNG/XML nằm trong evidence/2026-10-29-widget-offline/README.md. Chỉ đếm kiểm thử đã chạy. ServerQA3301/schema/tài khoản riêng; server ổn định3000 không đổi, không chạy workflow release/web.


## Vay/Nợ từ widget — 30/10/2026

Đợt chống lặp tiếp theo cùng ngày: Thu/Chi giữ mã yêu cầu qua Sửa lại/xem trước/thử lại. Sau khi đã SAVED/PENDING, không gửi lại hoặc sửa nội dung trong popup; lỗi native đóng cửa sổ chỉ cho Đóng/Back để thử đóng. Mô phỏng lỗi đóng sau lưu trên Android local đã xác nhận đúng một khoản1.250đ, database không đổi khi đóng lại. Mobile114/114 qua13bộ; bằng chứng evidence/2026-10-30-widget-retry/README.md. Không đổi yêu cầu mạng của Vay/Nợ.

Chạm N+ → Vay/Nợ → Vay hoặc Cho vay. Nhập số tiền, tên người, chọn ví thường và ngày giao dịch; ngày hẹn trả không bắt buộc. Kiểm tra dấu +/−, ví và người trước Xác nhận lưu. Lưu thành công tạo khoản trong sổ vay/nợ cùng giao dịch mở đầu. Khoản vay không nhập vào tổng thu/chi thường.

Luồng này cần mạng. Khi lỗi giữ form, không đổi thành bản nháp thu/chi thường. Thử lại cùng yêu cầu không ghi thêm tiền; đổi nội dung sau khi server đã xử lý báo xung đột để kiểm tra sổ. Backend phải hỗ trợ POST /loan-debts/quick-entry; server cũ bị chặn. Không thêm trả nợ/thu hồi nợ trong popup đợt này.

Android13 local Metro8082/API3302/MySQL QA đã lưu Vay100k và Cho vay50k, replay không đổi tiền. Jest mobile107/107, backend21/21; noEmit/ESLint đạt. Chưa APK/deploy hoặc điện thoại thật. Bằng chứng evidence/2026-10-30-widget-loan/README.md.


Bổ sung cùng đợt chống lặp30/10: Hàng chờ offline so sánh toàn bộ nội dung cùng mã (không phụ thuộc thứ tự khóa JSON). Nội dung khác báo409/OFFLINE_DRAFT_CONFLICT và giữ nguyên bản cũ; áp dụng giao dịch nhập tay và thông báo ngân hàng, gồm thay đổi món hóa đơn. Hai ca mới xác nhận không ghi đè hoặc gửi API.
