# QA đối chiếu liên kết — 28/10/2026

Android13/API33 Pixel3a emulator-5554, app riêng com.mobile.dev chạy source Metro localhost8081, Nest127.0.0.1:3000/MySQL thật schema QA có quyền giới hạn. Không dùng APK production cũ để nghiệm thu source mới. Native debug đã cài27/10, không build/cài lại trong batch JS/backend này. Không sửa .env/server ổn định/tunnel/web hoặc phát hành APK.

## Dữ liệu thử và bằng chứng

Tài khoản thứ ba `Liên kết QA` được tạo riêng; ví ban đầu690.000đ và một khoản Chi310.000đ ngày28/10/2026. Hai fixture trước không bị sửa. Các file api/database chỉ ghi dữ liệu giả và HTTP status; password/JWT/database URL ở private session ngoài Git.

| Mốc | Database QA mới | Bằng chứng |
|---|---|---|
|Trước thao tác|1giao dịch310k/ví690k|api-before.json|
|Sửa nguồn bằng PUT thật|1giao dịch330k/ví670k|api-after-edit.json|
|Đối chiếu/cập nhật snapshot local|vẫn1giao dịch/ví670k|database-after-link-refresh.json|
|DELETE nguồn thật|0giao dịch/ví1triệu|api-after-delete.json|
|Mở lại kỳ sau xác nhận|vẫn0giao dịch/ví1triệu|database-final.json|

Endpoint thật trả200 với ID thuộc tài khoản; ID1 thuộc fixture khác chỉ ở missingIds, không trả nội dung. Thiếu JWT401, ID trùng400. `other-qa-suggestions-unchanged.json` và `other-qa-bills-unchanged.json` xác nhận9giao dịch/8.848.000đ và2giao dịch/6.590.000đ không đổi.

## 64ảnh gốc và XML từ00–63

Mỗi ảnh có XML cùng tên; SHA256SUMS kiểm toàn bộ file trừ chính manifest. Một số ảnh chụp chuyển cảnh có thể đi sau XML vài khung hình; dùng ảnh trạng thái ổn định tiếp theo khi cần kết luận. Không coi ảnh trắng/loading/lỗi dump là ca đạt.

| Ảnh | Thao tác và quan sát |
|---|---|
|00–06|Mở app cũ trong QA, Dev Menu → Reload lấy bundle source mới. 04–05 còn trắng/loading;06 mới là dashboard sau biên dịch Metro. Không lấy thời gian biên dịch debug làm tốc độ APK release.|
|07–13|Vào Tài khoản; swipe08 chuyển nhầm Danh mục, không coi là thành công cuộn tài khoản. Back09, dùng nút đăng xuất ở vị trí đã quan sát;10splash,11welcome,12–13login.|
|14–20|Nhập tài khoản QA thứ ba bằng helper kiểm focus/masking. Password được che trong17–18; không ghi giá trị thật.19login,20dashboard có Ví liên kết QA.|
|21–25|Tài khoản, cuộn bằng mép trái.22–23 Hóa đơn định kỳ còn sát thanh dưới nên chưa bấm;24 hiện đầy đủ,25 mở lịch rỗng của tài khoản mới.|
|26–33|Tạo lịch Internet QA bằng UI, ngày28/10,310k, hằng tháng; nhập tên/tiền, ẩn bàn phím, lưu rồi Chưa trả. Không seed book bằng cách sửa storage.|
|34–38|GET chọn giao dịch12, xem trước310k, xác nhận liên kết thật. Đã xử lý có nút đối chiếu. native-linked.json:1lịch/handled1/nhắcfalse.|
|39–40|Kiểm tra nguồn gốc310k: khớp. Nguồn HTTP được đọc thật, không mock.|
|41–46|Sau PUT nguồn330k/note mới, kiểm tra thấy cần kiểm tra và giá trị đã lưu310k/hiện tại330k.43preview,44hủy giữ cũ,45preview lại,46xác nhận hiển thị snapshot330k và chưa đối chiếu lại. native-after-refresh.json vẫn handled1. SQL vẫn1/ví670k.|
|47–49|Kiểm lại khớp330k. Đưa app về Home48, mở lại49: kết quả cũ bị bỏ, hiện chưa đối chiếu. Không dừng/đổi dữ liệu ứng dụng production.|
|50–53|Dừng đúng tiến trình backend QA đã tự tạo.50request,51ảnh đã hiện lỗi nhưng XML còn ở bước chuyển;52ảnh/XML ổn định báo chưa đối chiếu, không kết luận đã xóa, giữ snapshot. Khởi động lại đúng runner QA rồi53thử lại khớp.|
|54–57|Sau DELETE nguồn qua HTTP thật,54kiểm tra,55không truy cập được; snapshot330k vẫn còn. native-deleted-link-retained.json handled1.56mở lại preview,57hủy, native-after-reopen-cancel.json vẫn handled1.|
|58–60|Bổ sung câu giải thích kỳ có thể được nhắc lại trong hộp thoại. Fast Refresh remount màn về tab mặc định; thao tác dự kiến58-reopen-confirm-again bị helper từ chối vì không tìm thấy control, không có ảnh thành công tên đó.58-observed là trạng thái mới,59–60 mở lại Đã xử lý xác nhận snapshot330k vẫn lưu. Đây là chuyển trạng thái dev khi sửa source, không coi là ca mất dữ liệu/app release.|
|61–63|Preview cuối nêu chỉ gỡ trạng thái local/không sửa giao dịch và có thể nhắc lại theo cài đặt;62xác nhận, native-final-reopened.json handled0/billCount1/nhắcfalse/alarmfalse.63Chưa trả lại có kỳ28/10 và nút chọn giao dịch. SQL cuối0/ví1triệu không đổi.|

UiAutomator đôi lần báo null root trong chuyển cảnh; helper retry tạo dump mới, không dùng XML cũ hoặc coi lần lỗi là thành công. Không force-stop/đổi đồng hồ, không bật nhắc trong batch này.

## Kết quả tự động và giới hạn

- Mobile109/109 qua13bộ (7domain/service mới,6UI flow mới,96hồi quy), backend23/23 qua2bộ (4mới/19hồi quy). File summary trích log thật. API/native trong Jest dùng mock, tách khỏi thử Android/HTTP/SQL thật ở trên.
- Một UI test ban đầu timeout vì act chờ chính request đang cố giữ pending; sửa test để phát request không await trong act, sau đó chạy lại đạt. Helper HTTP đầu dùng nhầm đường auth, đã sửa thành users/login và users/me trước khi xác minh đạt. Không coi những lần thất bại ban đầu là bằng chứng đạt.
- TypeScript/ESLint file đổi hai repo đạt, MetroQA3/3. JVM/build native11/11 ngày27/10 không chạy lại vì không đổi native. Không chạy toàn bộ test backend.
- Chưa thử điện thoại vật lý,101ID trên Android (đã thử100+1 trong unit), OEM/4G/Gemini/ngân hàng/mic/OCR. Không tự đối chiếu khi mở app hoặc ở nền; kết quả không được coi là xác minh liên tục.
- Cuối buổi giữ một lịch QA đã mở lại, nhắc tắt; app về Home, dừng đúng backend/Metro QA tự tạo. MySQL/server khác giữ nguyên. Excel/plan/nhật ký ở thư mục dự án ngoài hai Git repo; source/test/bằng chứng thuộc mobile, endpoint/helper thuộc backend.
