# Rà soát hệ thống và kế hoạch nâng cấp theo từng phần

Ngày rà soát: 22/09/2026. Đối tượng: đồ án quản lý chi tiêu cá nhân của sinh viên năm 4; backend chạy trên laptop, thử APK từ xa trước khi tính đến CH Play.

## 1. Phạm vi và kết luận

**Cập nhật triển khai tiếp theo ngày 22/09:** đã bắt đầu G1–G3 theo ưu tiên mới của người dùng: component hashtag/nút/ô nhập chung cho các luồng vừa sửa, phương án lưu trên thiết bị với nghĩa vụ nhập tay và đối chiếu tháng hoàn tất, thẻ phương án chatbot mở trình chỉnh. Đồng thời nâng cấp báo cáo/email (5 sheet Excel, nội dung thư chi tiết, trạng thái SMTP đúng, lọc ví và tải file dự phòng). Đây chưa phải lưu kế hoạch trên server, lịch nợ tự động hoặc hoàn tất toàn bộ G1–G3. Khoản định kỳ/offline đồng bộ tiếp tục hoãn. Chi tiết và kiểm thử tại `APP_OPTIMIZATION_PLAN.md`.

Đã đọc cấu trúc màn hình mobile, API controller, các luồng kế hoạch/chatbot, Prisma schema, cấu hình server, upload, lịch nhắc và một phần web quản trị. Đây là rà soát mã nguồn và tài liệu sản phẩm chính thức, không phải chạy thử giao diện hai ứng dụng tham khảo. Chưa mở Android, chạy server/tunnel, truy cập dữ liệu thật hoặc kiểm thử tải trong lượt này.

Mốc kiểm thử gần nhất trước bản kế hoạch: mobile 45 bộ/193 test; backend 41 bộ/240 test; TypeScript mobile và build backend đạt. Không dùng kết quả mock để kết luận APK, giọng nói, MySQL đồng thời hay mạng 4G đã hoạt động.

**Định hướng:** hoàn thiện vòng sử dụng “ghi chép → hiểu tình hình → chọn kế hoạch → thực hiện → xem kết quả”. Hệ thống đã có phần lớn chức năng ghi chép; ưu tiên độ tin cậy, kế hoạch thực hiện được và giao diện dễ dùng hơn là tăng số lượng màn hình.

## 2. Học gì từ MISA và Money Lover?

Ở đây “MISA” được hiểu là **Sổ Thu Chi MISA / MoneyKeeper**, phù hợp bài toán cá nhân; không lấy bộ kế toán doanh nghiệp làm phạm vi đồ án.

| Sản phẩm và bằng chứng chính thức | Điều nên học cho đồ án |
|---|---|
| [Sổ Thu Chi MISA](https://sothuchi.misa.vn/) giới thiệu ghi chép, giọng nói, hạn mức, báo cáo, vay/nợ, chia sẻ, xuất Excel/PDF và đồng bộ | Liên kết các nghiệp vụ thành quy trình hằng ngày; nhập ít bước; báo cáo và hạn mức dễ hiểu |
| [Money Lover](https://moneylover.me/) giới thiệu theo dõi chi tiêu, ngân sách, khoản định kỳ, mục tiêu, vay/nợ, nhiều thiết bị và tiền tệ | Làm rõ khoản đến hạn, tiến độ mục tiêu và việc cần làm tiếp theo |
| [Tài liệu Premium của Money Lover](https://moneylover.zendesk.com/hc/en-us/articles/35836986998809-Premium-Main-features-and-purchase-instructions) phân biệt các chức năng và dịch vụ bổ sung | Tham khảo cách nhóm chức năng, không mặc định mọi tính năng đối thủ đều miễn phí hoặc cùng một gói |

Đây là định hướng thiết kế rút ra từ tính năng công bố, không phải chấm điểm chất lượng hoặc tốc độ của đối thủ. Không sao chép thương hiệu, icon hay giao diện nguyên mẫu. Không đề xuất mua gói để làm đồ án.

## 3. Hệ thống hiện có và khoảng trống

“Có” nghĩa là tìm thấy đường đi trong mã nguồn; “chưa thấy” là chưa tìm thấy implementation tương ứng trong phạm vi rà, không khẳng định một dịch vụ ngoài repo không tồn tại.

| Phần | Hiện trạng có bằng chứng | Nâng cấp cần thiết |
|---|---|---|
| Tài khoản | Đăng nhập, Google, refresh token, hồ sơ, OTP/reset mật khẩu, vô hiệu hóa tài khoản | Giới hạn thử đăng nhập/OTP; chuẩn hóa phiên; xác minh quyền bằng test hai tài khoản |
| Giao dịch | Thêm/sửa/xóa, danh mục, hashtag, tìm kiếm, ảnh và OCR | Mẫu nhập nhanh, bản nháp; chống ghi trùng phía server; giữ hóa đơn ở mức tổng quát |
| Ví/chuyển tiền | Nhiều loại ví, số dư, chuyển cùng tiền tệ, ví tiết kiệm | Đối chiếu số dư với bút toán; làm rõ tiền có thể chi và tiền dành cho mục tiêu |
| Ngân sách | Theo ví/danh mục/kỳ, dự báo, cảnh báo, tạo kỳ tiếp | Còn được chi bao nhiêu; liên kết kế hoạch đang theo; chọn cách xử lý kỳ mới rõ ràng |
| Tiết kiệm | Mục tiêu, góp/rút, lịch góp, bản xem thử 1–4 tháng | Lưu phương án đã chọn, tính khả năng góp sau nghĩa vụ khác, theo dõi kế hoạch so với thực tế |
| Kế hoạch tài chính | Dự báo 1–4 tháng; gợi ý giảm theo danh mục; mở bản nháp ngân sách | Lựa chọn hiện chủ yếu ở state màn hình; chưa có model riêng lưu phiên bản phương án và lần rà soát |
| Chatbot | Lịch sử hội thoại, gợi ý, nhập giọng nói, ba loại kế hoạch có số liệu | Trả thẻ phương án có cấu trúc, chỉnh và lưu; hiểu nhiều cách diễn đạt; không tự ghi tiền |
| Báo cáo | Thống kê, Excel/PDF và gửi email đã có; nâng cao/xuất báo cáo bị giới hạn Premium | Đối chiếu số liệu giữa màn hình/file; giải thích biến động; đường demo không đòi thanh toán thật |
| Vay/nợ | Tiền gốc, trả từng phần, đến hạn, liên kết bút toán | Đưa nghĩa vụ dự kiến vào kế hoạch; nhắc việc có thể phục hồi sau laptop tắt |
| Thông báo | Trong app, cài đặt, broadcast, scheduler ngân sách/kế hoạch và dedupe key | Lịch bù khi server bật lại; timezone rõ; chưa coi thông báo trong app là push khi app đóng |
| Khoản định kỳ | Chưa thấy model/API lịch thu chi định kỳ tổng quát | Tiền trọ, Internet, học phí, nguồn thu định kỳ; xác nhận từng kỳ trước khi tạo giao dịch |
| Offline | Phiên được lưu AsyncStorage; FinanceContext giữ dữ liệu trong bộ nhớ | Chưa có kho dữ liệu offline/hàng đợi đồng bộ giao dịch; trước mắt lưu bản nháp và cache đọc |
| Chia sẻ | Chưa thấy thành viên ví/nhóm và phân quyền cộng tác trong schema | Hoãn đến sau phiên bản cá nhân ổn định |
| Admin | Có trang người dùng, danh mục, thống kê, thông báo, logs, hồ sơ admin | Cấu hình API theo môi trường, xử lý 401/403 đúng, thông tin vận hành và audit tối thiểu |
| Vận hành | Health marker, cấu hình HTTPS remote, hướng dẫn laptop/APK | Readiness DB, sao lưu/phục hồi đã diễn tập, theo dõi dung lượng và lỗi, bảo vệ ảnh riêng tư |

Bằng chứng chính: `src/screens/home/`, `src/context/FinanceContext.tsx`, `src/hooks/useVoiceInput.ts`, `../backend/prisma/schema.prisma`, `../backend/src/*/*.controller.ts`, `../web_admin/src/app/(dashboard)/`.

## 4. Các phát hiện cần ưu tiên

| ID | Phát hiện và vị trí | Tác động / cách hoàn thành |
|---|---|---|
| AUD-01 / P0 | `backend/src/app.module.ts` phục vụ toàn bộ `uploads` qua static route; ảnh hóa đơn lưu trong vùng này | Ai có URL có thể yêu cầu ảnh mà static route không kiểm tra chủ sở hữu. Tách ảnh hóa đơn riêng tư sang endpoint có xác thực/quyền sở hữu; cập nhật mobile tải ảnh có auth; chặn đường static cũ. Test chủ sở hữu được xem, người khác/khách bị từ chối, URL cũ không còn truy cập. Tên ngẫu nhiên không thay thế quyền truy cập |
| AUD-02 / P0 | Chưa thấy idempotency store/key trong API ghi; mobile có khóa bấm và không tự retry ghi | Mất phản hồi sau commit vẫn có thể khiến lần thử lại thủ công tạo trùng. Lưu khóa theo user + thao tác + payload hash cùng transaction; cùng khóa/cùng payload trả kết quả cũ, khác payload trả xung đột. Kiểm thử trên MySQL riêng |
| AUD-03 / P0 | `notifications.scheduler.ts` có cron 08:00/08:05, không chỉ định timezone hoặc cơ chế quét bù tại đây | Lịch phụ thuộc giờ máy; laptop tắt có thể bỏ lượt chạy. Dùng timezone nghiệp vụ và quét các kỳ còn thiếu khi khởi động/định kỳ; tận dụng dedupe hiện có, không tạo lại cảnh báo mỗi lần bật máy |
| AUD-04 / P0 | `/health` xác nhận process; chưa có bằng chứng restore DB + uploads thành công | Health xanh chưa đủ chứng minh hệ thống dùng được. Thêm readiness giới hạn thời gian, không lộ lỗi kết nối; diễn tập restore vào DB/thư mục thử, không ghi đè dữ liệu đang dùng |
| AUD-05 / P0 | Chưa thấy limiter ứng dụng qua rà main/module/controller; upload hiện kiểm MIME, đuôi và kích thước | Giới hạn login/OTP/chat/OCR trước public tunnel; hạn mức theo người dùng phù hợp. Xác minh nội dung ảnh thực trước lưu/xử lý. Chưa kiểm tra cấu hình limiter ở proxy bên ngoài repo |
| AUD-06 / P1 | `financial-plans/spending-actions.ts` chọn mức giảm bằng tên danh mục và cắt 3 mục đầu | Đề xuất hiện là quy tắc mẫu, chưa biết khoản cố định/thiết yếu của từng người. Cho người dùng đánh dấu khoản cần giữ và sửa hạn mức; hiển thị cơ sở tính |
| AUD-07 / P1 | `chatbot/financial-plan-reply.ts` dùng regex các câu mẫu; năng lực góp vẫn nêu rõ chưa trừ trả nợ | Câu hỏi khác mẫu có thể đi nhánh model; chưa có đối tượng phương án lưu được. Tách intent/plan schema, tính nghĩa vụ nợ và tiền giữ lại, để model chỉ diễn đạt |
| AUD-08 / P1 | `web_admin/src/services/api.ts`: API localhost cố định; `handleExpiredSession` xử lý cả 401 và 403 | Bị từ chối quyền có thể bị đưa về đăng nhập. Tách hết phiên và thiếu quyền; gom các nguồn API config, chạy test admin. Admin tiếp tục chỉ dùng nội bộ trong buổi APK |
| AUD-09 / P1 | Nhiều màn có mã màu/bo góc/font weight riêng ngoài `Colors.ts`; chưa xem trên thiết bị | Có nguy cơ thiếu nhất quán, chưa kết luận giao diện thực tế. Chuẩn hóa component rồi kiểm trực quan, nhất là chip “di chuyển”, chữ lớn và bàn phím |

P0 là ưu tiên của dự án này, không phải điểm CVSS. Buổi demo riêng có thể dùng dữ liệu giả; trước khi đưa dữ liệu cá nhân thật qua tunnel phải hoàn tất bảo vệ tài nguyên riêng tư và kiểm tra quyền liên quan.

## 5. Backlog nâng cấp từng phần

Ước lượng là ngày công tập trung của một người đã quen repo, gồm kiểm thử chức năng; không phải cam kết theo lịch. Không triển khai tất cả trước thứ Sáu. Mỗi phần chốt xong điều kiện nghiệm thu rồi mới mở rộng.

### G0 — Server và tính đúng dữ liệu (P0, khoảng 4–7 ngày)

- Xử lý AUD-01 đến AUD-05 theo các lát nhỏ; bảo vệ ảnh/readiness/backup trước, chống trùng giao dịch kế tiếp.
- Giữ kiến trúc hiện tại: APK → HTTPS → một backend NestJS → MySQL; uploads riêng tư trên laptop. Chưa cần microservice, Redis hoặc VPS trả phí để chứng minh đồ án.
- Thêm request ID, log lỗi được lọc token/mật khẩu/nội dung chat, thời gian phản hồi và dung lượng uploads. Không in `.env` hoặc dữ liệu cá nhân ra báo cáo lỗi.
- Chuẩn hóa migration: backup → kiểm tra schema → migrate thử trên bản sao → test → mới áp dụng môi trường dùng; không tự chạy các script seed/sync/migration cũ.
- Nghiệm thu: hai tài khoản không đọc/sửa dữ liệu nhau; gửi song song cùng thao tác chỉ ghi một lần; số dư khớp; restart không mất dữ liệu; restore DB + ảnh vào vùng thử đọc được.

### G1 — Ghi chép và UI hằng ngày (P1, khoảng 3–5 ngày)

- Màn chính ưu tiên số dư theo tiền tệ, thu/chi tháng, khoản sắp đến hạn và nút thêm giao dịch; không dồn toàn bộ dự báo/chatbot vào trang đầu.
- Form nhập theo thứ tự số tiền → chi/thu → danh mục → ví → ngày. Ghi chú, tag và ảnh là tùy chọn; có ví gần dùng, mẫu “ăn trưa”, “tiền trọ” và sao chép giao dịch thành bản nháp.
- Hóa đơn chỉ có ảnh, tổng tiền, ngày và gợi ý danh mục. Không đưa lại danh sách từng món theo yêu cầu của người dùng; trường `receipt_items` cũ chưa xóa khỏi DB trong đợt này.
- Tạo bộ component: nút chính/phụ, field, hàng danh sách, chip, trạng thái tải/lỗi/rỗng, số tiền. Dùng một hệ khoảng cách, vài cỡ chữ và một màu nhấn; giảm khung lồng nhau và chữ đậm dày đặc.
- Chip “di chuyển”: text và nền nằm trong cùng container, căn giữa, không bù bằng translateY. Thử dấu tiếng Việt, font hệ thống 100–150%, tag dài, nhiều tag, nền selected/unselected. Đây là tiêu chí kiểm thiết bị, chưa tuyên bố sửa được biểu hiện chỉ qua mã.
- Nghiệm thu: tạo khoản mẫu trong tối đa 5 thao tác sau khi mở form; không mất nội dung khi mạng lỗi; lỗi đặt gần ô nhập; số tiền dài không tràn và chip không lệch nền.

### G2 — Ngân sách và kế hoạch tiết kiệm có thể thực hiện (P1, khoảng 5–8 ngày)

**Luồng:** chọn mục tiêu → chọn 1/2/3/4 tháng hoặc ngày cụ thể → khai báo nghĩa vụ → xem phương án → chỉnh → lưu → rà soát hằng tuần.

- Tận dụng nút 1–4 tháng, roadmap và bản nháp ngân sách đã có; không tạo lại các màn tương đương.
- Bổ sung đầu vào: thu nhập dự kiến theo tháng, khoản thiết yếu cần giữ, khoản trả nợ dự kiến, số dư tối thiểu muốn giữ, mục tiêu ưu tiên. Có chỗ xác nhận/sửa suy luận từ lịch sử.
- Mỗi phương án ghi rõ: dùng dữ liệu từ ngày nào, tiền tệ, chi bình quân, hạn mức mới, mức giảm, hành động cụ thể, ngày kiểm tra. Tách “dự báo theo lịch sử” và “kịch bản nếu giảm chi”.
- Tính khả năng góp theo từng tháng: tiền đầu kỳ + thu dự kiến − chi dự kiến − nợ cần trả − mức tiền cuối kỳ cần giữ. Khoản góp cho các mục tiêu chia từ cùng phần còn lại; không cấp cùng một khoản dư cho nhiều mục tiêu.
- Chi dự kiến đã chứa chi cố định thì không trừ lần hai. Không cộng chuyển nội bộ vào thu nhập; không coi tiền chưa thu hồi từ người vay là tiền chắc chắn có. Tiền tệ khác nhau tách riêng khi chưa có tỷ giá được xác nhận.
- Nếu thiếu tiền: chỉ rõ thiếu tháng nào, cho giảm mức góp, lùi hạn hoặc thay ưu tiên; không tự gợi ý vay mới để đạt mục tiêu.
- Lưu snapshot phương án, các giả định và phiên bản; dữ liệu mới cập nhật phần thực tế, không âm thầm viết lại kế hoạch gốc.
- Màn theo dõi: dự kiến/đã góp/còn thiếu; giới hạn/đã chi/còn được chi; kết thúc tuần “đạt”, “cần điều chỉnh” và hành động tiếp theo.

Ví dụ minh họa giao diện, không phải số liệu của người dùng:

| Danh mục | Mức cũ/tháng | Mức thử/tháng | Hành động | Giảm dự kiến |
|---|---:|---:|---|---:|
| Đặt đồ ăn | 600.000đ | 400.000đ | Chuyển một số bữa sang tự chuẩn bị, kiểm lại số lần và chi phí mỗi tuần | 200.000đ |
| Giải trí | 400.000đ | 300.000đ | Chọn trước hoạt động trong tuần, hoãn khoản vượt hạn mức | 100.000đ |
| Gói dịch vụ ít dùng | 100.000đ | 50.000đ | Kiểm tra gói đang đăng ký, chỉ giảm nếu có lựa chọn phù hợp | 50.000đ |

Kịch bản giảm 350.000đ/tháng, tương đương 1.050.000đ/3 tháng nếu duy trì; chưa phải tiền đã tiết kiệm. Mục tiêu còn thiếu 1.500.000đ trong 3 tháng cần 500.000đ/tháng; vẫn cần thêm 150.000đ/tháng từ phần dư khác hoặc điều chỉnh thời hạn. Không tự suy ra người dùng chắc chắn có khoản dư này.

- Nghiệm thu: mở lại app vẫn thấy phương án đã chọn; tổng phân bổ không vượt năng lực tháng; test thiếu dữ liệu, thu nhập thất thường, nợ đến hạn, nhiều mục tiêu, tháng ngắn/ngày nhuận và mục tiêu quá hạn. Số liệu ngân sách tạo từ phương án khớp màn xem trước.

### G3 — Chatbot thành trợ lý thực hiện kế hoạch (P1, khoảng 3–5 ngày; phụ thuộc G2)

- Giữ ba ý định đã có: giảm chi, góp mục tiêu và dự phòng. Khi thiếu đầu vào, hỏi từng thông tin cần thiết thay vì trả một đoạn dài chung chung.
- API trả `plan_proposals` có số tiền/thời hạn/giả định/hành động và ID bản nháp; UI hiển thị thẻ “Nhẹ”, “Cân bằng”, “Nhanh hơn” nếu dữ liệu đủ hỗ trợ. Không ép sinh đủ ba khi chỉ có một phương án khả thi.
- Nút “Xem cách tính”, “Chỉnh phương án”, “Lưu kế hoạch”. Mọi tạo ngân sách/góp tiền đi qua xác nhận và kiểm tra phía server; chatbot không tự chuyển tiền.
- Số học dùng cùng engine với G2; model diễn đạt và giải thích. Nhánh theo quy tắc vẫn dùng được khi dịch vụ AI lỗi/hết hạn mức; không hứa mọi câu hỏi AI hoạt động miễn phí.
- Giọng nói hiện là nhập câu hỏi: hiển thị bản chép để sửa trước gửi, có trạng thái đang nghe/dừng/hủy. Nâng cấp nhập giao dịch bằng giọng nói chỉ tạo bản nháp để duyệt số tiền/ví/ngày.
- Nghiệm thu: cùng dữ liệu cho số tiền giống màn kế hoạch; câu hỏi biến thể tiếng Việt đi đúng ý định; thiếu dữ liệu thì hỏi; lỗi AI có đường tiếp tục; chữ từ giọng nói không tự gửi khi chưa duyệt.

### G4 — Khoản định kỳ, lịch nghĩa vụ và nhắc việc (P1, khoảng 3–5 ngày; sau G0)

- Thêm lịch tiền trọ, điện/nước, học phí, thuê bao và thu nhập; theo tuần/tháng, ngày đến hạn, ví, danh mục, có thể dừng/bỏ qua một kỳ.
- Bản đầu chỉ nhắc và tạo bản nháp, người dùng xác nhận đã trả/đã nhận; không mặc định lịch đến hạn là giao dịch thực tế.
- Xử lý ngày 29/30/31, đổi timezone, laptop tắt nhiều ngày; mỗi lịch/kỳ chỉ tạo một occurrence và tối đa một giao dịch đã xác nhận.
- Gộp nghĩa vụ nợ với lịch chi trên màn “Sắp tới”; tránh ghi hai lần cùng khoản. Chỉ đưa số tiền trả nợ vào dự báo khi lịch đã xác định, không tự chia đều khoản vay tùy ý.
- Nghiệm thu: khởi động lại vẫn thấy kỳ bị lỡ; xác nhận hai lần chỉ một khoản; bỏ qua kỳ không làm thay đổi số dư; thông báo trong app và push được ghi rõ là hai phạm vi khác nhau.

### G5 — Báo cáo, dữ liệu cá nhân và offline (P1/P2, khoảng 4–7 ngày)

- Báo cáo: so với kỳ trước cùng độ dài; bấm danh mục mở đúng danh sách; phân biệt dòng tiền, chuyển ví, vay/nợ và góp tiết kiệm; thông báo ngày dữ liệu gần nhất.
- Tận dụng Excel/PDF đã có, thêm đối chiếu tự động tổng theo tiền tệ giữa API và file. Chốt cấu hình tài khoản demo có quyền phù hợp, không mở thanh toán thật chỉ để thử báo cáo.
- Thêm xuất dữ liệu cá nhân để mang đi; import CSV chỉ sau khi có mapping cột, bản xem trước, kiểm lỗi từng dòng và chống trùng. File xuất báo cáo không phải bản backup khôi phục hệ thống.
- Offline bước 1: lưu bản nháp + dữ liệu đọc gần nhất theo tài khoản; hiện “Dữ liệu lúc …”, xóa/tách cache khi đổi tài khoản, bảo vệ dữ liệu trên máy. Không hiển thị nháp như giao dịch đã ghi.
- Offline bước 2, sau G0: outbox có khóa thao tác, trạng thái chờ/đã đồng bộ/cần xử lý; xử lý conflict bằng phiên bản bản ghi. Không tự phát lại lệnh chuyển tiền khi chưa có idempotency.
- Nghiệm thu: tắt mạng không mất nháp; mở app bằng tài khoản khác không thấy cache cũ; nối lại không nhân đôi; file xuất đối chiếu đúng và nhập lỗi không để dữ liệu dở dang.

### G6 — Web quản trị và bảo trì (P2, khoảng 2–4 ngày)

- Sửa AUD-08; cấu hình API thống nhất, admin giữ nội bộ trong giai đoạn thử APK.
- Dashboard vận hành: tình trạng DB, lỗi theo nhóm, thời gian phản hồi, số tác vụ nhắc còn chờ, dung lượng ảnh và lần backup xác minh gần nhất. Không ghi “backup OK” chỉ vì file tồn tại.
- Audit ai làm gì/khi nào cho thao tác quản trị; quyền admin kiểm ở server; 403 hiển thị thiếu quyền thay vì đăng xuất.
- Tách dần các màn lớn thành component/hook theo hành vi khi chỉnh chức năng, không rewrite đồng loạt. Mỗi thay đổi chạy test module, typecheck và kiểm tra tích hợp liên quan.
- Nghiệm thu: tài khoản thường không gọi được admin API; không lộ dữ liệu chi tiêu cá nhân không cần thiết trên dashboard; lỗi server có thông báo và request ID để tra.

### G7 — Phần hoãn sau bản cá nhân ổn định (P3)

Ví chung/nhóm cần membership, quyền đọc/ghi, lịch sử và xung đột; liên kết ngân hàng cần nhà cung cấp, điều kiện sử dụng và chi phí; phát hành CH Play cần bản release ký đúng và quy trình riêng. Chưa làm trong mốc demo này. Cũng chưa ưu tiên chi tiết từng món hóa đơn, đọc số dư ngân hàng tự động, đầu tư hay kế toán doanh nghiệp.

## 6. Những thay đổi dữ liệu/API dự kiến

Đây là bản thiết kế để triển khai dần, chưa tạo bảng hoặc chạy migration.

| Thay đổi đề xuất | Dữ liệu chính / nguyên tắc |
|---|---|
| `mutation_requests` | user, operation, key, payload hash, trạng thái, resource/result; unique key theo user + operation + key; ghi nhận kết quả trong cùng transaction nghiệp vụ; hết hạn không được làm một request đang xử lý trở thành thao tác mới |
| `financial_plan_versions` + `financial_plan_allocations` | Chủ sở hữu, phiên bản, kỳ, tiền tệ, snapshot giả định, phân bổ theo tháng/mục tiêu/danh mục, status draft/active/archived; nguồn dữ liệu tính toán; version check khi cập nhật |
| `recurring_rules` + `recurring_occurrences` | Chu kỳ/timezone, kỳ phát sinh, đến hạn, trạng thái pending/skipped/confirmed, transaction liên kết; unique(rule, kỳ) |
| API ảnh riêng tư | Lấy ảnh bằng ID giao dịch, kiểm chủ sở hữu; static uploads không tiếp tục lộ file đó; xử lý logout/cache và xóa ảnh theo vòng đời |
| API kế hoạch | Xem trước không ghi tiền; lưu phương án với version; áp dụng ngân sách rõ từng ví; cập nhật thực tế đọc từ nghiệp vụ gốc |
| API readiness | Status tối giản, timeout DB ngắn; không trả host DB, exception hoặc credential |

## 7. Thứ tự thực hiện và mốc thứ Sáu

1. **Trước 25/09:** xử lý phần G0 thiết yếu cho thử từ xa; chốt dữ liệu demo, quyền ảnh, readiness, backup/restore và checklist. Không cố nhét toàn bộ backlog vào ba ngày.
2. **Thứ Sáu 25/09, dự kiến 19:00 Việt Nam:** theo [kế hoạch APK từ xa](APK_REMOTE_TEST_PLAN.md), build/cài/thử khi bắt đầu buổi đó. Kết quả cần lưu: phiên bản APK, URL, tài khoản thử, kịch bản, kết quả và lỗi thực tế. Không mở Android Studio/giả lập; chưa đưa CH Play.
3. **Sau demo:** G1 cùng G2 là đợt sản phẩm đầu; G3 nối tiếp để chatbot dùng kế hoạch đã lưu. G4 giúp dự báo nghĩa vụ đầy đủ hơn; nối dữ liệu nghĩa vụ vào engine G2 thay vì xây engine thứ hai.
4. **Đợt sau:** G5/G6 theo lỗi và nhu cầu dùng thật. Chỉ xét G7 sau khi ghi chép, số dư, kế hoạch và khôi phục dữ liệu đáng tin cậy.

Các nhóm G0–G6 cộng khoảng 24–41 ngày công; đây là phạm vi đầy đủ tham khảo cho một người, không phải yêu cầu hoàn tất trước bảo vệ. Bản tối thiểu nên lấy G0 thiết yếu + G1 + lát G2 lưu/theo dõi một kế hoạch + G3 xem/chỉnh phương án; cắt import, đồng bộ ghi offline và cộng tác nếu không đủ thời gian.

## 8. Các việc có thể bắt đầu ngay

- [ ] P0: tách ảnh hóa đơn khỏi static public, bổ sung test quyền truy cập và đường ảnh mobile.
- [ ] P0: readiness DB + diễn tập backup/restore ở vùng thử, ghi lại bằng chứng.
- [ ] P0: giới hạn endpoint công khai/tốn tài nguyên; rà nội dung file upload.
- [ ] P0: idempotency cho tạo giao dịch, sau đó chuyển ví/góp tiết kiệm/trả nợ.
- [ ] P0: timezone và lịch quét bù thông báo; test restart và không trùng.
- [ ] P1: dựng component Chip/Field/Button thống nhất, kiểm “di chuyển” trên điện thoại vào buổi thử.
- [ ] P1: kế hoạch v1 có nghĩa vụ, snapshot, lưu và thực tế theo tuần.
- [ ] P1: chatbot trả thẻ kế hoạch từ cùng engine, duyệt trước khi áp dụng.

Theo dõi lỗi và phần đã sửa tại [APP_OPTIMIZATION_PLAN.md](APP_OPTIMIZATION_PLAN.md). Không đánh dấu checkbox chỉ vì viết xong code: cần đạt tiêu chí nghiệm thu tương ứng và ghi rõ những phần chưa kiểm được trên thiết bị/server thật.
