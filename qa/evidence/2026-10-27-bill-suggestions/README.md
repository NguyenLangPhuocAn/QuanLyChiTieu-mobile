# Gợi ý hóa đơn định kỳ — QA local 27/10/2026

Phạm vi: đợt B phần1, tìm khoản chi lặp và tạo lịch sau xác nhận. Chưa nghiệm thu toàn bộ plan/P3, thanh toán gốc sửa/xóa, backup/dự báo hoặc điện thoại vật lý. Quy tắc/giới hạn source: [BILL-SUGGESTIONS.md](../../BILL-SUGGESTIONS.md).

## Môi trường và dữ liệu

- Pixel3a emulator-5554, Android13/API33; app debug tách riêng `com.mobile.dev`, source qua Metro localhost8081. Bản production `com.mobile` không được cập nhật. Font hệ thống1,0.
- Backend Nest source và MySQL thật, chỉ127.0.0.1:3000, schema QA có giới hạn quyền. Không dùng API mock trong luồng Android. Không sửa server ổn định/.env/tunnel hoặc website. AI bị tắt trong QA.
- Tài khoản QA mới có một ví8.848.000đ và9khoản chi giả: Internet ba kỳ240k/260k/250k (31/7,31/8,30/9), Video ba kỳ89k (ngày5), Music ba kỳ45k (ngày14). Đều là VND/chi thông thường. Tài khoản QA cũ giữ2giao dịch/số dư6.590.000đ.
- `api-preflight.json`: health200/login201/GET200, đủ9/9. `database-before.json`, `database-mid.json`, `database-after.json`:9ID và số dư giữ nguyên. `original-account-unchanged.json`/`original-account-after.json`: hai giao dịch cũ không đổi. Token đăng nhập và mật khẩu chỉ nằm trong session riêng ngoài Git; ảnh mật khẩu được che.

## Ảnh gốc theo thao tác

Có75PNG từ00 đến74, mỗi ảnh có XML cùng tên. Ảnh là trạng thái quan sát, có cả bước chờ/không đạt; không phải mỗi ảnh đều chứng minh một ca hoàn tất. SHA256SUMS kiểm toàn bộ file bằng chứng trừ chính manifest; `.gitattributes` giữ byte gốc khi checkout.

| Ảnh | Thao tác và kết quả quan sát |
|---|---|
|00–08|Khởi động source, mở tài khoản QA cũ rồi đăng xuất. Native bỏ owner/mirror/alarm, book0: `native-after-signout.json`.|
|09–16|Đăng nhập thật tài khoản QA mới. Helper kiểm focused EditText và trường password có masking trước khi nhập. Ảnh14 là mật khẩu đã che. Native owner mới/book0, không lấy lịch cũ: `native-new-account.json`.|
|17–24|Mở Tài khoản → Hóa đơn định kỳ; ban đầu không tự tìm lịch sử. Bấm Kiểm tra:9/9,3gợi ý. Ảnh23 thấy lựa chọn dài bị xuống hàng; đổi nhãn ngắn Không định kỳ, ảnh24 sau sửa.|
|25–28|Mở bằng chứng Internet:3ngày/số tiền/nội dung gốc. Theo dõi mở form có thể sửa, gốc31/7 và bắt đầu31/10, khoảng240k–260k. `native-preview-not-saved.json`:book0.|
|29–33|Hủy preview, mở lại. Lần dump dự kiến32 bị UiAutomator exit137 khi các tool bị chồng; không có ảnh thành công cho bước đó. Ảnh32-observed là dump mới sau lỗi, vẫn ở đầu editor. Ảnh33 mới là phần tiền/nút lưu sau swipe riêng hoàn tất. Helper đã bổ sung retry khi dump lỗi, không dùng XML cũ.|
|34–38|Hộp xác nhận nêu tiền/chu kỳ/ngày bắt đầu và không ghi giao dịch cũ. Trước xác nhận và sau hủy vẫn book0. Xác nhận lại tạo1lịch/startDate1/handled0, nhắc tắt: `native-awaiting-confirmation.json`, `native-after-cancel.json`, `native-one-future-schedule.json`.|
|39–44|Sau lần lưu đầu, kết quả dài đẩy lịch mới xuống thấp. Đã sửa thu gọn kết quả khi lưu, thêm hồi quy mở cache không fetch lại. Ảnh39 tên compact-after-follow-fix nhưng thực tế Fast Refresh đổi hook làm debug quay Main; KHÔNG dùng ảnh39 chứng minh UI mới. Ảnh40–44 mở lại lịch đã lưu bền.|
|45–51|Kiểm tra lại chỉ còn Video/Music; Internet đã theo dõi không gợi ý lại. Không định kỳ Video, Để sau Music7ngày; mục Đã ẩn có2lựa chọn.|
|52–60|Đưa app về nền, chờ, `am kill com.mobile.dev` khi cached, xác minh tiến trình đã dừng rồi mở lại. Session/lịch còn; tìm lại và xem2lựa chọn ẩn vẫn giữ. Không dùng force-stop hoặc đổi đồng hồ máy.|
|61–67|Hiện lại Video, mở preview89k và xác nhận. Có2lịch/startDate2/handled0: `native-two-future-schedules.json`. Ảnh66 thực sự chứng minh source cuối thu gọn kết quả sau lưu; ảnh67 mở lại cache. Không đo network packet trên Android; số GET một lần được kiểm bằng integration test.|
|68–72|Chưa trả chỉ có các kỳ tương lai: Internet31/10, Video05/11, Internet30/11; không tạo nợ kỳ7–9. Hai swipe70–71 chưa lên đủ đầu, không bấm switch ở bounds khuất; swipe mép trái72 mới hiện đầy đủ cài đặt.|
|73–74|Bật nhắc QA, native alarmtrue và màn hình lần tới20:00 ngày28/10 (trước3ngày của31/10), `native-enabled-start-date.json`. Không đợi28/10 để kiểm tra phát thông báo trong batch này. Tắt lại sau thử: `native-final-disabled.json` enabledfalse/alarmfalse.|

## Kiểm thử và bản dựng

- Jest96/96 qua11bộ;24ca mới và72hồi quy. Bao gồm ngày31/leap/ngoại tệ/biến thiên, nhóm gói, dữ liệu lặp/hỏng, startDate, atomic save/concurrency, phân trang/hủy, preview/xác nhận/bỏ qua/để sau/khôi phục và cache sau lưu. Native/API trong Jest là mock. `jest-summary.txt` là phần kết quả từ log thật, không phải chạy toàn bộ test repo.
- JVM planner11/11, skipped0/failures0/errors0; `native-test-summary.txt` giữ header kết quả, không sao chép system-properties từ XML.
- MetroQA3/3; TypeScript và ESLint các file thay đổi đạt. Node syntax các QA helper đạt. Không chạy whole backend suite vì không đổi logic ứng dụng backend.
- Debug build/install thành công2phút47giây/284tasks (14executed/270uptodate),1thiết bị. `android-build-summary.txt` trích kết quả thật. Không ký hoặc phát hành APK production.
- Lần chạy mới test storage cần sửa mock thiếu clear; assertion UI ban đầu cần truy cập evidence bằng accessible label thay vì ghép children Text. Đã sửa và chạy lại đạt. Một HTTP preflight đầu khi server chưa ready thất bại; chạy lại khi Nest sẵn sàng đạt. Không coi các lần này là thành công trước khi thử lại.

## Giới hạn và bàn giao

- Chưa thử thiết bị vật lý, OEM/reboot/dài ngày, mạng4G, lịch sử lớn/nhiều trang hoặc ngoại tệ trên Android. Ngân hàng/Gemini/microphone/OCR không nằm trong batch này.
- Chưa hỗ trợ chu kỳ quý/kỳ bị thiếu/nhiều gói không có định danh. Giới hạn đọc3năm/2.000khoản được hiển thị; request đang bay chưa abort vật lý. PAID vẫn là snapshot local, kiểm lại khi giao dịch gốc sửa/xóa thuộc B phần2.
- Cuối QA đã tắt nhắc, giữ hai lịch thử trong tài khoản QA riêng. Số giao dịch/số dư hai tài khoản không đổi. Tiến trình QA do buổi thử tạo được dừng sau đối chiếu; không dừng MySQL hoặc server khác.
- Excel/plan/nhật ký gốc ở thư mục dự án bên ngoài hai repo; mã nguồn/test/biên bản/ảnh thuộc repo mobile, bộ dựng fixture thuộc repo backend. Commit Git không đồng nghĩa cập nhật app trên điện thoại.
