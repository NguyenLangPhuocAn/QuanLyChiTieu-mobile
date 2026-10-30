# Bản kế tiếp — bản nháp, chưa phát hành

## Chống lưu lặp khi thử lại widget — 30/10/2026

- Thu/Chi giữ cùng mã yêu cầu qua Sửa lại, xem trước và thử lưu lại. Khi máy chủ đã xử lý, cùng mã/nội dung không ghi thêm tiền; nội dung thay đổi vẫn do backend kiểm tra xung đột.
- Khi đã lưu hoặc đã đưa vào hàng chờ, khóa gửi và bỏ Sửa lại/Xác nhận lưu. Nếu native không đóng được popup, hiện trạng thái đã tiếp nhận cùng nút Đóng; bấm lại/Back chỉ thử đóng, giữ đúng kết quả SAVED/PENDING.
- Mobile114/114 qua13bộ (7ca mới), TypeScript/ESLint đạt. Android13 source local với QA mô phỏng lỗi native đóng đúng sau xác nhận: giao dịch Chi1.250đ tạo đúng tx30, ví1.025.000→1.023.750; đóng lại về launcher, SQL/số dư không đổi.
- Bằng chứng mobile/qa/evidence/2026-10-30-widget-retry/README.md. Mô phỏng lỗi chỉ nằm trong cấu hình Metro QA8083, không vào cấu hình release. Trả emulator về Metro8082 bình thường sau thử. Không build native/APK, deploy/web hoặc đổi server3000.

## Vay/Nợ trong form widget — 30/10/2026

- Form mở từ N+ hoặc widget đầy đủ có Chi, Thu và Vay/Nợ. Vay/Nợ tách Vay/Cho vay, nhập tên người, chọn ví thường, ngày giao dịch và ngày hẹn trả tùy chọn. Kiểm tra trước khi xác nhận; Vay cộng tiền, Cho vay trừ tiền và tạo liên kết sổ vay/nợ thật. Không tính khoản vay thành thu/chi thường.
- Vay/Nợ cần mạng, lỗi giữ form để sửa/thử lại. Cùng mã yêu cầu chỉ ghi một lần; đổi nội dung của mã đã xử lý báo409. Route quick-entry riêng chặn server cũ chưa hỗ trợ chống trùng. Thu/Chi thường vẫn dùng hàng chờ offline hiện có.
- Sửa treo khôi phục đăng nhập khi hồ sơ local thuộc backend khác. Jest mobile107/107 qua13bộ; backend21/21 qua2bộ, TypeScript/ESLint đạt.
- Android13 com.mobile.dev từ Metro8082/API3302/MySQL QA: QA8 vay100k (loan1/tx28), cho vay50k (loan2/tx29), ví975k→1.075k→1.025k. Replay song song từng khoản trả cùng ID, đổi tiền409/thiếu mã400; SQL và số dư giữ nguyên. Bằng chứng qa/evidence/2026-10-30-widget-loan/README.md.
- Đây là source và kiểm thử local, chưa phát hành APK hoặc deploy backend. Cần đưa backend hỗ trợ quick-entry lên trước bản app thật. Không đổi server3000/.env/web, không build native đợt này. Vay/Nợ offline, trả nợ ngay trong widget và thử điện thoại/OEM chưa nằm trong kết quả này.

## Sửa lỗi và tối ưu widget — 30/10/2026

- Sửa số tiền VND nhập có dấu nhóm, thành tiền món không bị đổi94.000 thành94 hoặc buộc hiện0 khi xóa. USD giữ phần thập phân. Khóa camera ngay lần bấm đầu, không nhận kết quả đã hủy; mở camera dừng phần giọng nói đang nhập.
- Cache tải muộn có thể khôi phục form ngay tại chỗ, có Thử lại. Giữ cây giao diện khi main/widget chuyển chủ phiên đăng nhập, giữ Thu/Chi, ví, danh mục và tiền sau khôi phục cùng phiên. Kiểm widget/nonce/scope vẫn bắt buộc.
- Ghi tiền đã xác nhận không chờ thêm GET ví mới đóng; ví cập nhật nền có kiểm phiên và đọc cache mới. Lượt tải danh sách đọc cache sau khi mạng trả về để giữ khoản vừa lưu. Native có loading/Đóng trước khi React sẵn sàng, sửa khung loading sau khi nhìn ảnh thật; nâng chiều cao tối thiểu widget đầy đủ210dp để không co mất nút. Tái dùng PendingIntent và bỏ vẽ lại snapshot giống nhau.
- Jest101/101 qua12bộ (9ca mới), TypeScript/ESLint đạt. Debug local build/cài83s, sửa loading/cài21s; JVM11planner hiện có đạt. Android13 com.mobile.dev/Metro8081/API3301/MySQL QA: preview/offline chưa đổi SQL,1chờ; mở lại online đúng1khoản id27/−25.000/VND/category22/ví8, số dư975.000. WidgetChi25k/Thu0/0chờ; bật/tắt che tiền4lần PendingIntent15→15; camera ngoài app/Hủy về form đạt.
- Không nghiệm thu AI OCR/giọng nói thật hoặc điện thoại/OEM/hiệu năng release. Một lượt đầu bị Fast Refresh khi còn sửa source, đã chạy lại với source cuối; không gọi ảnh loading hẹp hoặc frame chuyển màn là đạt. Giữ server3000/.env, health200; không phát hành APK/web. Excel chỉH21/I21 và chiều cao hàng21, nhật ký tuần/patch note/bằng chứng cập nhật. Các mục C2b/đồng bộ lịch/ảnh offline chưa đổi. Bằng chứng mobile/qa/evidence/2026-10-30-widget-fixes/README.md.


## Widget mini 1×1 — 29/10/2026, đợt 5

- Thêm provider riêng Nova · Mini 1×1, icon N+ màu cam, không hiện số tiền. Chạm icon mở NovaWidgetEntryActivity trên launcher, dùng chung form Thu/Chi, danh mục đầy đủ, chọn ví, mic/camera và xem trước/xác nhận; Hủy/Đóng về màn hình chính. Giữ widget Thu chi nhanh 4×2, không giả lập thu gọn bằng cách chiếm ô lớn. Không xin quyền overlay.
- Trong Dữ liệu và xuất nhập → Thêm widget Nova có lựa chọn Mini hoặc Bản đầy đủ. Bộ kiểm native chỉ nhận ID widget đang tồn tại của hai provider, cùng scope/nonce theo tài khoản. Xóa widget dùng cùng cơ chế xóa lựa chọn/mã riêng; không đưa nonce vào bằng chứng.
- Kiểm tra Android13 Pixel3a/com.mobile.dev source local: launcher liệt kê1×1 và4×2; thêm mini, chạm mở panel, chuyển Thu/chọn đủ5danh mục, Hủy/Đóng về launcher, mở lại được. Nút trong app gửi đúng yêu cầu ghim từng loại tới launcher. QA8 giữ0giao dịch/ví1triệu, QA7 giữ3/ví1.030.000. Không ghi khoản tiền mới đợt này.
- Jest92/92 qua12bộ hiện có; TypeScript/ESLint đạt. Build/cài debug QA và JVM11/11 planner đạt2m28s, cập nhật resource cuối/cài lại36s. Không gọi11JVM là test widget mới. Lần mở nguội debug chờ tải bundle Metro; các ảnh chuyển màn/blank không tính là form sẵn sàng. Chưa đo hiệu năng release hoặc thử điện thoại/OEM khác.
- Đã cập nhật Excel H21/I21, kế hoạch, nhật ký tuần và patch note. Không build/ký/phát hành APK production, cập nhật web, đổi.env hoặc restart backend3000; health200. Còn thử máy thật/mic/OCR AI thật và các đầu việc C2b đã ghi trước. Bằng chứng mobile/qa/evidence/2026-10-29-widget-mini/README.md.


## Danh mục widget theo giao diện cũ — 29/10/2026, đợt 4

- Hai mục QA trước đó thuộc tài khoản thử QA7, không phải danh mục thật bị xóa hoặc giới hạn số lượng trong app. Đổi bộ chọn trong panel từ nút chữ sang thẻ có CategoryIcon gốc, tên, hệ thống/cá nhân và dấu đang chọn như màn Danh mục cũ. Thẻ danh mục đã chọn có icon, Khoản thu/chi và Đổi; ví tách riêng bên dưới.
- Có tìm kiếm và tổng số danh mục, lấy toàn bộ danh mục thu/chi thường đúng loại từ tài khoản, không cắt còn vài mục. Làm mới API danh mục cùng cache, panel nhận cập nhật mà giữ số tiền đang nhập. Không nhúng danh mục mẫu vào mã chạy ứng dụng.
- Thêm helper QA catalog riêng: QA8 có12Chi/5Thu bằng icon có sẵn, ví1triệu và0giao dịch. Không đổi/xóa QA7 (giữ3giao dịch/ví1.030.000), không sửa database production. Android local kiểm native đủ12Chi, panel có icon12Chi/5Thu, tìm “hi” ra Bảo hiểm và chọn đúng; không Lưu khoản tiền nào. Để bộ chọn Chi đầy đủ trên emulator cho người dùng xem, vẫn là dữ liệu thử.
- Jest92/92 qua12bộ (4ca mới), TypeScript/ESLint đạt, node --check helper đạt. Không build/cài lại native vì chỉ đổi JS/QA; dùng com.mobile.dev local/Metro8081/API3301. Không phát hành APK/web/deploy/restart server3000/.env, health200. Bằng chứng mobile/qa/evidence/2026-10-29-widget-categories/README.md. Giới hạn mic/OCR thật/OEM/C2b không đổi.


## Widget nhập ngay trên launcher — 29/10/2026, đợt 3

- Sửa yêu cầu bị hiểu thiếu: Thêm giao dịch/mic/camera mở cửa sổ riêng trên launcher, không đưa người dùng vào Tổng quan. Thu/Chi, danh mục, ví, số tiền/ngày/ghi chú và chi tiết món OCR có thể kiểm tra/sửa; phải chọn ví. Hủy hoặc xác nhận lưu đóng cửa sổ về launcher. Không xin quyền vẽ đè app khác.
- Có bước Kiểm tra rồi Xác nhận lưu. Khóa nhấn lặp và dùng cùng khóa chống trùng khi mất mạng. Giữ hàng chờ ngoại tuyến, chưa đổi số dư trước server xác nhận; khi mở lại/có mạng đồng bộ và làm mới tổng widget. Sửa trường hợp root khác đã gửi hàng chờ trước nhưng panel chưa làm mới cache.
- Chia sẻ một controller phiên đăng nhập giữa các React root, không tạo hai luồng refresh/logout. Kiểm nguồn native/scope, giữ bản đang nhập khi bấm widget lặp; tạm ngừng lắc ngân hàng ở MainScreen phía sau panel. Ảnh quét không tự đính kèm hoặc xếp hàng upload.
- Android local/Nest/MySQL QA: preview0/ví1triệu; Chi25k xác nhận → id24/ví975k. Thu50k và Thu5k giữ ngoại tuyến, mở lại đồng bộ đúng id25/26; cuối3 giao dịch/ví1.030.000. Sau tải source cuối widget Chi25k/Thu55k/0chờ, Hủy/Lưu trở lại launcher. Mic hỏi quyền/từ chối rồi sửa transcript bàn phím; camera emulated chụp/trả về panel/loading và lỗi vì QA không có khóa. Không gọi model/nhận dạng giọng nói thật; QA6 không đổi.
- Jest cuối88/88 qua11bộ (12ca mới), TypeScript/ESLint đạt; debug local install/test2m33s, JVM11/11 planner hiện có. Biên bản/PNG/XML/SQL: mobile/qa/evidence/2026-10-29-widget-popup/README.md. Giữ cả ảnh trung gian lỗi, chỉ tính 46/49 là giao diện/cache cuối đã kiểm.
- Chưa phát hành APK/web/deploy hoặc sửa server3000/.env; health200. Còn điện thoại thật/OEM/giọng nói/Gemini/4G, C2b lịch tiền/chi an toàn và đồng bộ lịch, ảnh offline upload. Khung nhập chưa xác nhận chưa có cam kết giữ qua process death.


## Widget chọn danh mục, mic và camera — 29/10/2026, đợt2

- Widget2hàng có Thu/Chi, danh mục theo loại từ dữ liệu đã tải, nút Thêm giao dịch, mic và camera. Nhớ danh mục riêng theo widget/loại; đổi tài khoản/backend xóa lựa chọn. Bộ chọn chạy native, chọn xong trở lại launcher. Form kiểm tra danh mục theo dữ liệu hiện có; không truyền số tiền hay ví từ widget, không tự ghi tiền.
- Mic mở phần nghe/xem trước ngay trong form, có sửa câu và Hủy. Khi điền, giữ danh mục widget nếu còn phù hợp với loại Thu/Chi; vẫn cần người dùng chọn/kiểm tra ví rồi Lưu. Chưa nghiệm thu nghe tiếng Việt thật trên điện thoại.
- Kiểm tra nguồn liên kết bằng mã ngẫu nhiên riêng của widget ở native trước khi chuyển sang form/mic/camera. Đổi tài khoản/backend hoặc xóa widget vô hiệu mã cũ; không dựa vào userId/backend có thể đoán để mở phần cứng. Không đưa mã riêng này vào nhật ký hoặc bằng chứng.
- Camera mở chụp ảnh rồi gọi OCR hiện có. Ảnh quét chỉ phục vụ trích xuất, không tự đi vào ảnh đính kèm ở luồng thêm giao dịch/widget/chatbot. Tên món/tổng tiền vẫn có thể điền vào form để kiểm tra. Thêm ảnh thủ công và ảnh đã chủ động đính kèm giữ riêng; quét không tự thay ảnh này. Giữ danh mục widget trước gợi ý OCR khác loại.
- Kiểm thử cuối: mobile76/76 qua8bộ (8ca bổ sung), TypeScript/ESLint đạt; debug QA install/test thành công2m53s, JVM11/11 planner hiện có. Android13 local: chọn2loại/danh mục, nhớ lựa chọn qua reboot, form Lương QA đúng Khoản thu; mic xin quyền và nhánh từ chối/nhập câu mẫu25k giữ Đi lại QA; camera emulated chụp/Done/trả về, OCR báo lỗi vì QA không có khóa; panel ảnh vẫn trống, thêm ảnh thủ công vẫn có lựa chọn. QA7 vẫn0giao dịch/ví1triệu, fixture trước không đổi.
- Không gọi Gemini thật hoặc nghiệm thu nhận dạng giọng nói thật, không coi OCR mock là đọc hóa đơn thật. Có lỗi SystemUI của emulator và một lượt test timeout5s; reboot emulator, cuối cùng chạy lại với timeout30s mỗi test đạt76/76. Chưa phát hành APK/web, không deploy hoặc đổi server ổn định. Bằng chứng: mobile/qa/evidence/2026-10-29-widget-input/README.md. C2b lịch tiền/chi an toàn và đồng bộ lịch giữa thiết bị vẫn còn.

## Widget và giao dịch ngoại tuyến — source 29/10/2026

- Thêm widget Android Nova · Thu chi nhanh ở màn hình chính ngoài app: hai nút Chi/Thu mở form để người dùng chọn ví, nhập tiền và xác nhận. Mặc định che số tiền, có Hiện/Ẩn. Widget chỉ phản chiếu dữ liệu đã tải theo tiền tệ, không cộng số tiền của bản nháp vào số đã xác nhận; chuyển ngày khi chưa có dữ liệu mới báo chưa cập nhật.
- Đăng nhập lần đầu/Google vẫn cần mạng. Sau một lần xác thực, lưu hồ sơ cùng phiên và backend; có thể mở app bằng hồ sơ đã lưu trong khi kiểm tra lại server. Mất mạng giữ chế độ trên máy, không đăng xuất nhầm. Backend/tài khoản khác, phiên bị server từ chối hoặc người dùng đăng xuất không được dùng hồ sơ cũ.
- Lưu giao dịch thường khi ngoại tuyến tạo bản nháp bền trên máy, chưa đổi số dư. Khi app đang mở và mạng trở lại, hoặc mở app lại, kiểm tra phiên rồi gửi hàng chờ bằng cùng khóa chống trùng. Chỉ xóa bản nháp sau khi server xác nhận. Mạng lỗi/401 dừng lượt gửi và giữ chờ; dữ liệu 400cần kiểm tra. Tách máy chủ, bỏ bản gửi cũ sau đổi tài khoản, không ghi đè hàng chờ hỏng.
- Bản nháp cũ chưa có thông tin backend phải được người dùng kiểm tra và thử lại; không tự gán sang server hiện tại. Cache cũ thiếu backend được giữ nguyên nhưng cần một lần tải online mới trước khi dùng ngoại tuyến.
- Giới hạn: chưa đồng bộ khi Android đã force-stop/đóng hẳn app, sẽ tiếp tục ở lần mở sau. Thu/chi thường được xếp hàng; vay/nợ, tạo ví/danh mục, Google, AI/OCR online vẫn cần mạng. Ảnh chưa được giữ để tự upload lại trong hàng chờ; giao dịch có lời nhắc thêm ảnh sau. Widget không tự ghi tiền; form có ví mặc định thông thường để người dùng kiểm tra/chọn lại. C2b lịch tiền/chi an toàn và tự đồng bộ lịch giữa thiết bị vẫn còn.



## Sao lưu file thường — 28/10/2026 (C2a)

- Theo yêu cầu mới: bỏ mã hóa và toàn bộ ô mật khẩu ở Backup cá nhân và sao lưu lịch hóa đơn. File mới là JSON thường. Không còn tạo hoặc mở backup mã hóa cũ.
- Lịch hóa đơn: lưu/chọn file Android, xem trước số lịch/kỳ, xác nhận thay toàn bộ lịch local. Hoạt động không cần API/mạng; giữ kỳ liên kết/bỏ qua, lựa chọn gợi ý/cảnh báo. Kiểm tra tài khoản/máy chủ khai trong file, dữ liệu local/file đổi sau xem trước và phiên bị hủy. Tắt nhắc từng lịch sau khôi phục, không ghi giao dịch hoặc đổi số dư. Đây là file người dùng sửa được, không phải xác thực tính toàn vẹn bằng mã hóa.
- Backup giao dịch: xuất file JSON, xem trước/chọn/xác nhận dòng cần nhập; chặn trùng trong file và dữ liệu đang có. Kiểm tra lại checksum file trước ghi, giữ idempotency. Sửa lỗi ngày ISO trong backup không khớp ngày lịch YYYY-MM-DD mà luồng giao dịch yêu cầu; chống trùng theo ngày lịch. Chỉ nhập thu/chi thường vào ví/danh mục đã có; ảnh, chuyển ví, tiết kiệm và vay/nợ chưa phục hồi bằng luồng này. Cần API mới, chưa deploy.
- Kiểm thử: mobile135/135 qua16bộ, backend24/24 qua2bộ, Metro4/4; TypeScript và ESLint file đổi đạt. Android local com.mobile.dev lưu/đọc file lịch3lịch/2kỳ, Hủy rồi xác nhận khôi phục; nhắc tắt. API3301/MySQL QA5: preview không ghi tiền, nhập1khoản79.000đ, ví1.000.000→921.000đ; xem lại không còn dòng hợp lệ, nhập lại bị chặn.
- Chưa phát hành APK, cập nhật web hoặc thay server ổn định. C2 còn đồng bộ tự động và nối lịch tiền/chi an toàn; P3 vẫn đang làm. Máy thật/OEM/4G chưa nghiệm thu. Biên bản mobile/qa/BILL-BOOK-BACKUP.md.

## Cảnh báo khoản định kỳ và tổng 30 ngày — source 28/10/2026

- Hóa đơn định kỳ → Kiểm tra: xem khoản tăng ít nhất 10% so với trung vị ba kỳ ổn định, vượt mức dự kiến; xem khoản có thể ghi lặp (khác ID, cùng kỳ/tiền tệ/tiền, tối đa ba ngày). Có giao dịch nguồn và giải thích, không tự xóa/gộp hoặc ghi tiền.
- Đã kiểm tra/Hiện lại lưu riêng theo tài khoản/backend; nguồn hoặc ngữ cảnh đổi sẽ hiện cảnh báo mới. Bỏ phản hồi muộn khi ra nền/rời màn/đổi tài khoản. Dùng chung lần tải lịch sử với gợi ý, không thêm API tự chạy nền.
- Lịch đã tạo có tổng 30 ngày theo mức người dùng đặt, tách tiền tệ; loại kỳ quá hạn/đã xử lý/lịch dừng. Chưa tự điều chỉnh theo cảnh báo hoặc nối vào chi an toàn.
- Mobile Jest129/129 qua15bộ (20ca mới), MetroQA3/3, TypeScript/ESLint đạt; Android source local/Nest/MySQL QA riêng. Chi tiết qa/BILL-ACTIVITY.md. Chưa phát hành APK/web hoặc thay server ổn định.

## Đối chiếu liên kết thanh toán — source 28/10/2026

- Trong Hóa đơn định kỳ → Đã xử lý, bấm Kiểm tra liên kết để biết nguồn còn khớp, đã đổi hoặc không còn truy cập được. Giữ thông tin cũ để đối chiếu, không tự bỏ lịch sử hoặc ghi tiền.
- Cập nhật cần xem trước/xác nhận và đọc lại nguồn trước ghi; mở lại kỳ cũng có xác nhận. Chống áp dụng snapshot/xác nhận cũ khi liên kết đổi, hủy/ra nền/rời màn/đổi tài khoản.
- API JWT đọc tối đa100ID/lượt bằng một truy vấn có giới hạn chủ sở hữu. Lỗi mạng hoặc server cũ không bị hiểu là giao dịch đã xóa.
- Mobile109/109, backend23/23, MetroQA3/3; Android source local/Nest/MySQL thật,64ảnh gốc. Endpoint chưa deploy production, chưa phát hành APK. Chi tiết qa/PAYMENT-LINK-CHECKS.md.

## Gợi ý khoản chi lặp — source 27/10/2026

- Trong Hóa đơn định kỳ, bấm Kiểm tra để tìm khoản có ít nhất3lần chi theo tuần/tháng/năm; xem ngày, tiền và nội dung gốc trước khi quyết định.
- Theo dõi mở form và yêu cầu xác nhận; Không định kỳ/Để sau7ngày/Hiện lại được lưu theo tài khoản và backend.
- Lịch từ gợi ý theo dõi từ kỳ tới, giữ ngày gốc qua tháng ngắn/năm nhuận; không tạo kỳ quá hạn cũ, giao dịch hoặc tự đánh dấu đã trả.
- Giới hạn lịch sử3năm/2.000khoản, báo rõ chưa tải hết; chỉ đọc khi yêu cầu, bỏ kết quả muộn, chống bấm tìm/lưu trùng. Sau tạo lịch thu gọn kết quả, mở lại không cần tải lại.
- Jest96/96, JVM11/11, MetroQA3/3; debug local và Nest/MySQL QA thật. Chi tiết/giới hạn ở qa/BILL-SUGGESTIONS.md. Chưa phát hành APK production.

## Nhắc hóa đơn — source 27/10/2026

- Nhắc trước3ngày,1ngày và đúng hạn; gộp các khoản cùng ngày, chọn giờ nhận và tắt riêng từng lịch.
- Thông báo không lộ tên/số tiền; bấm mở nhóm hóa đơn ngày nhắc. Không tự tạo khoản chi hoặc đổi số dư.
- Lưu mốc đã gửi theo tài khoản, loại kỳ đã trả/bỏ qua/lịch dừng hoặc xóa; tái đặt nhắc khi mở lại app và Android nhận boot/đổi giờ.
- Đã thử emulator local: quyền thông báo, nhận ngoài app khi JS dừng, bấm mở nhóm và bỏ qua một kỳ. Jest72/72, JVM10/10, Metro3/3; SQL QA giữ2giao dịch/ví6.590.000đ. Chi tiết và giới hạn trong qa/BILL-REMINDERS.md.
- Chờ điện thoại thật/OEM/reboot; giờ nhận có thể trễ do giới hạn Android. Chưa phát hành APK trong đợt này.

## Hóa đơn định kỳ — source 26/10/2026

- Thêm **Tài khoản → Hóa đơn định kỳ**: lịch tuần/tháng/năm, tiền cố định hoặc khoảng dự kiến, giữ đúng ngày gốc qua tháng ngắn/năm nhuận.
- Xem kỳ chưa trả/đã xử lý; tạm dừng, tiếp tục, bỏ qua một kỳ và mở lại. Xóa lịch vẫn giữ lịch sử liên kết đã trả.
- Liên kết khoản chi đã có sau xem trước/xác nhận. Chặn dùng trùng giao dịch giữa các kỳ; không tạo/sửa/xóa giao dịch hoặc thay đổi số dư.
- Lưu local theo tài khoản/môi trường, khóa ghi tuần tự, giữ form khi lỗi và không ghi đè dữ liệu hỏng. Giao dịch tải theo trang, bỏ phản hồi muộn sau khi đóng.
- Sửa lỗi form/picker mất khi token tự làm mới, tăng vùng bấm nút đóng form và tránh báo không có giao dịch khi thực ra đang lỗi mạng. Thử lại sau mất kết nối tải được danh sách.
- 50/50 kiểm thử qua 4 bộ, thêm 2/2 kiểm tra cấu hình Metro; TypeScript/ESLint đạt. Đã thao tác Android emulator với backend/MySQL QA thật, lưu 97 ảnh gốc từng bước tại qa/evidence/2026-10-26-recurring/README.md. Đối chiếu trước/sau vẫn 2 giao dịch, số dư 6.590.000đ.
- Chỉ build/cài debug local tách riêng phục vụ test; chưa phát hành APK production hoặc cập nhật web tải. Chưa thử điện thoại vật lý. Chưa có nhắc hạn từng hóa đơn, gợi ý tự động, đồng bộ/backup lịch hoặc tích hợp chi an toàn; snapshot thanh toán chưa tự theo dõi sửa/xóa giao dịch gốc. Chi tiết: qa/RECURRING-BILLS.md.

Cập nhật source ngày 23/10/2026 — AI trích xuất thông báo ngân hàng.

## Lắc/chuông và AI

- Lắc khi dùng màn chính hoặc bấm chuông để chọn thông báo giao dịch mới nhất chưa xử lý còn trên thanh thông báo Android. Không chụp ảnh hoặc khoanh vùng.
- Sau khi được đồng ý gửi chữ, Gemini là bộ trích xuất chính cho Thu/Chi, số tiền và nội dung. Không dùng parser regex để điền các trường trước AI hoặc đoán thay khi AI lỗi.
- Vẫn lọc OTP/dữ liệu không cần thiết và đối chiếu số tiền, tiền tệ, dấu tiền, bằng chứng nguyên văn sau AI. Bộ lọc native chỉ tìm ứng viên thô có chữ số/dấu hiệu tài chính, không phụ thuộc mẫu số tiền cụ thể.
- Hỏi quyền gửi chữ sang máy chủ/Gemini: Nhập tay, Chỉ lần này hoặc Luôn cho phép. Lựa chọn nhớ theo tài khoản, có mục Quyền dùng AI để đặt lại. Ảnh và khóa Gemini không gửi từ app.
- Có thông báo chờ AI và nút Hủy. Hủy/rời app/đổi tài khoản bỏ kết quả muộn; HTTP hỗ trợ hủy và không thử máy chủ khác sau khi người dùng hủy một read.
- Giữ kết quả cùng sự kiện/nội dung trong RAM 2 phút; khác tài khoản/phiên/nội dung không dùng lại. Không ghi nội dung vào kho lưu quyền AI. Cache cờ tính năng ngắn hạn để giảm request.
- AI lỗi, cờ tắt, server cũ chưa có endpoint hoặc người dùng chọn Nhập tay: mở form REVIEW với các trường tiền/Thu-Chi rỗng để nhập tay; không fallback regex để tự điền.

## Giao dịch và trải nghiệm

- Mới nhất trước; chỉ đánh dấu đã xử lý sau Lưu hoặc giữ offline an toàn. Đóng chưa lưu giữ mục cho lần sau. Cùng nguồn giữ sửa đổi, nguồn khác hỏi trước khi thay.
- Ví do người dùng chọn; chỉ ghi tiền sau xác nhận. Giữ source_ref, không gửi thêm client_request_id xung đột. Quy tắc danh mục không đổi ngược Thu/Chi đã đọc.
- Mic trong form đã có nghe, sửa câu, xem trước và điền nháp từ 21/10. OCR hóa đơn và việc bỏ chờ cố định 220 ms giữ nguyên.

## Backend, kiểm tra và giới hạn

- Thêm JSON Schema cho kết quả Gemini; yêu cầu một thông báo, tối đa 600 token đầu ra, timeout riêng 12 giây (client 16 giây). Không đổi model đang cấu hình hoặc mặc định timeout của các tác vụ khác.
- AI được gọi trước bước đối chiếu số tiền; không chặn toàn bộ chỉ vì có thêm phí. Sau model, kiểm chứng tiền/bằng chứng/dấu của khoản được chọn; sai hoặc không chắc thì REVIEW.
- Giữ cờ FEATURE_BANK_NOTIFICATION_AI mặc định tắt và hạn mức 3 lần/phút/tài khoản, một upstream đồng thời. Không có thao tác ghi tiền trong API trích xuất.
- Mobile 100/100 kiểm thử mục tiêu qua 9 bộ; backend 73/73 qua 5 bộ (gồm Gemini/HTTP/OCR hóa đơn). TypeScript, ESLint và compile Android Kotlin đạt. Tất cả model/provider đều mock trong kiểm thử.
- Chưa triển khai source mới lên server, chưa bật cờ/.env/restart, chưa build/ký/phát hành APK hoặc cập nhật website. AI chưa có trong APK hiện tại.
- Cần triển khai thử riêng, bật cờ có kế hoạch và thử Gemini thật/điện thoại thật; chưa có số đo độ trễ/độ chính xác thực tế. AI thường cần mạng nên không được coi là nhanh hơn regex cục bộ.
- Source_ref chống lặp cùng sự kiện; chưa cam kết chống mọi bản phát lại của cùng giao dịch. Snapshot thông báo không xác nhận riêng banner đang nổi.

---

# Sổ Thu Chi Nova 1.2.1

**Ngày phát hành:** 19/10/2026

**Phiên bản:** 1.2.1 (`versionCode 6`)

**Tải APK:** https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/download/v1.2.1/QuanLyChiTieu-1.2.1.apk

**SHA-256:** `C43B25FE437B18F3B685000AA0F25B91C8D3FF99555D3C159A83C35E4B1F8B63`

**Dung lượng:** 49.550.426 byte (khoảng 47,3 MB)

## Hóa đơn và giao dịch

- Màn sửa giao dịch giữ lại ảnh hóa đơn hiện có khi người dùng chỉ sửa nội dung.
- Cho sửa, thêm hoặc xóa từng món; hiển thị tổng các món, tổng thanh toán và phần chênh lệch.
- Tăng thời gian chờ OCR, giảm kích thước ảnh trước khi tải để ổn định hơn trên mạng di động.
- Giao diện chi tiết hóa đơn được làm gọn theo theme cam–kem; ô Tên món và Số tiền nằm cùng hàng trong một khung liền.
- Kiểm tra lại ảnh hóa đơn Tháng 2 Cafe & Trà: đọc đúng Bạc xỉu số lượng 2, thành tiền 94.000đ và tổng thanh toán 79.000đ.

## Excel và dữ liệu

- Màn xem trước nhập Excel dùng toàn chiều ngang, hiển thị từng dòng mới, trùng hoặc lỗi cùng lý do.
- Dòng trùng và lỗi không được chọn để nhập; ngày hiển thị theo định dạng Việt Nam.
- Xác nhận nhập lại file đã xuất nhận đúng giao dịch trùng và không ghi thêm lần nữa.
- Bỏ phần hướng dẫn dài ở cuối màn Dữ liệu và xuất nhập.

## Quy tắc thông minh và giao diện

- Quy tắc không phân biệt chữ hoa/thường: `Grab`, `grab` và `GRAB` cho cùng kết quả.
- Căn đều các nút danh mục, rút gọn phần hướng dẫn và giảm biểu tượng trang trí.
- Sửa trạng thái tải đăng nhập, giữ thông báo lỗi từ máy chủ và kiểm tra mật khẩu đăng ký ngay trên thiết bị.
- Sửa nội dung giải thích quỹ khẩn cấp khi tài khoản chưa có lịch sử chi thiết yếu.

## Kiểm tra

- TypeScript và ESLint đạt.
- Kiểm thử phần nhập giao dịch, OCR và chi tiết hóa đơn đạt.
- APK Android thử nghiệm đã build và cài thành công trên máy ảo trước khi phát hành.

## Lưu ý cập nhật

- Có thể cài đè lên bản production 1.2.0 và giữ nguyên dữ liệu.
- Đây là bản cập nhật không bắt buộc.
