# Kế hoạch tối ưu ứng dụng quản lý chi tiêu

Cập nhật: 22/09/2026. Ưu tiên đồ án, dùng laptop làm server, thử nghiệm chi phí thấp. Không bật Android/giả lập trong đợt này. Đây là kế hoạch triển khai; các mục chưa hoàn tất không được xem là đã có trong app.

Rà soát chức năng toàn hệ thống, đối chiếu Sổ Thu Chi MISA/Money Lover và backlog nâng cấp theo từng phần: [SYSTEM_UPGRADE_ROADMAP.md](SYSTEM_UPGRADE_ROADMAP.md). Tài liệu mới phân biệt chức năng đã có, phát hiện từ mã nguồn, việc đề xuất và điều kiện nghiệm thu; chưa áp dụng migration hay bật dịch vụ.

Ưu tiên hiện tại: thử APK kết nối server laptop qua mạng di động vào thứ Sáu 25/09/2026 lúc 19:00 (UTC+7), theo `APK_REMOTE_TEST_PLAN.md`. Chưa phát hành CH Play. Đã tách cấu hình local/remote; chế độ remote bắt buộc HTTPS và không gọi dự phòng sang IP nội bộ. Chưa đặt URL từ xa thực tế, chưa chạy tunnel và chưa build APK trong đợt này.

### Bổ sung ngày 22/09

Đợt triển khai theo ưu tiên UI → kế hoạch → chatbot và nâng cấp email:

- Thêm `HashtagChip` dùng chung ở nhập giao dịch/lịch sử, nền và chữ cùng container; `FormControls` dùng chung cho ô nhập/nút trong phần kế hoạch và gửi báo cáo. Chưa thay toàn bộ UI; lỗi nền tag còn cần nhìn trên điện thoại thật.
- Thêm phần chỉnh nghĩa vụ và lưu phương án 1–4 tháng theo tài khoản + server + tiền tệ **trên thiết bị**. Nhập trả nợ, sàn chi thiết yếu và tiền giữ thêm mỗi tháng; trừ lịch góp các mục tiêu một lần. Chưa tự đọc lịch trả nợ, chưa lưu phương án lên server.
- Bản lưu giữ snapshot và so thu–chi với tháng đã hoàn tất; theo dõi thay đổi ròng số tiền mục tiêu từ lúc lưu (có cả góp/rút), không coi đó là tổng tiền đã góp. Mất dữ liệu ứng dụng có thể mất bản lưu. Khoản định kỳ/import/outbox offline vẫn hoãn theo roadmap.
- Chatbot có ba phương án tính từ dữ liệu: giữ mức chi, giảm nhẹ, theo gợi ý; chuyển sang màn kế hoạch với kỳ và mức giảm đã chọn để chỉnh/lưu. Đây là kịch bản thay thế nhau, không cộng gộp mức tiết kiệm. Dữ liệu được tải khi mở bảng so sánh.
- Email báo cáo giữ bộ lọc ví/kỳ, có xác thực địa chỉ, khóa gửi trên mobile và khóa đồng thời theo user trong một tiến trình backend. Chưa phải idempotency bền vững giữa các lần khởi động/nhiều server.
- Thiếu SMTP trả lỗi rõ, không log nội dung tài chính hoặc báo gửi thành công. Kiểm tra SMTP accepted/rejected, timeout và thông báo kết quả chưa xác định; SMTP tiếp nhận không đồng nghĩa email đã vào hộp thư. Không gửi email thật trong đợt kiểm tra.
- Excel có 5 sheet: tổng quan, đầy đủ giao dịch, chi theo danh mục, thu chi theo tháng, ví với số dư hiện tại. Header cố định/bộ lọc; email có top 5 danh mục và giải thích cách tính. Đổi “Số dư kỳ” thành “Chênh lệch thu – chi”. PDF không còn cắt ở 28 dòng đầu. Có nút tải Excel nếu không dùng email.
- Kiểm tra sau thay đổi: mobile toàn bộ 49 bộ/202 test đạt, thêm 2 test thẻ phương án chatbot chạy riêng đạt; backend 43 bộ/248 test đạt. TypeScript mobile, build backend và lint các file sửa đạt. Chưa gửi SMTP thật, xem PDF trên thiết bị hoặc kiểm tra APK.

- Hồ sơ gửi `null` khi người dùng xóa ngày sinh, số điện thoại, địa chỉ hoặc họ tên tùy chọn, để server thực sự xóa giá trị cũ. Khóa chung lưu hồ sơ, chọn/tải avatar và đổi mật khẩu để tránh gửi trùng. Lỗi lưu giữ lại nội dung để thử lại.
- Backend từ chối ngày sinh không tồn tại, chấp nhận ngày nhuận hợp lệ và việc xóa thông tin tùy chọn.
- Biểu mẫu vay/nợ có lỗi tải và nút thử lại, giữ phần lẻ tiền gốc, xóa được ghi chú cũ. Không cho sửa tiền gốc/ví khi bút toán mở đầu đã bị khóa.
- Trạng thái mục tiêu tiết kiệm dùng cùng dữ liệu với lộ trình góp; mục tiêu đến hạn hôm nay hoặc đã đủ tiền không bị gắn quá hạn sai.
- JWT hết hạn/sai trả 401; lỗi truy cập cơ sở dữ liệu trả 503, tránh coi lỗi server là mất phiên đăng nhập. Kiểm tra trạng thái tài khoản và vai trò hiện tại từ DB.
- Đăng nhập Google kiểm tra client ID được cấu hình và email đã xác minh, có thời gian chờ. Hiện vẫn dùng tokeninfo; chưa coi là hoàn thiện xác thực Google cho phát hành chính thức.
- Lỗi ghi nhật ký hoạt động không làm thao tác hồ sơ/đổi mật khẩu đã thành công bị báo thất bại. Lỗi của thao tác chính vẫn được trả về.
- Kiểm tra ngày 22/09: mobile 45 bộ/193 test và backend 41 bộ/240 test đạt; build backend, TypeScript mobile và lint các file hồ sơ/DTO đạt. Chưa thử Android, MySQL đồng thời hoặc mạng 4G thật.

### Bổ sung ngày 21/09

- Lịch sử giao dịch giữ số lẻ khi sửa, khóa lưu/xóa liên tiếp, giữ biểu mẫu trong lúc lưu. Phân biệt thông tin giao dịch đã lưu với lỗi tải ảnh/làm mới; không báo toàn bộ giao dịch thất bại nếu chỉ phần sau lỗi.
- Lịch sử có nút thử lại, bỏ phản hồi tải cũ và điều chỉnh trang khi số trang giảm. Mặc định danh sách ví/danh mục ổn định, tránh tải lặp khi màn được mở mà không truyền props.
- Avatar và hóa đơn dùng server vừa trả lời API; hóa đơn nhận cả tên file và đường dẫn `/uploads/receipts/...`, không ghép lặp thư mục.
- Chatbot chặn gửi hai lần trong cùng lượt bấm, không cho lịch sử cũ ghi đè cuộc trò chuyện vừa chọn/tạo. Khi chưa tải được lịch sử, hiện nút thử lại thay vì âm thầm coi như cuộc trò chuyện trống.
- Chuyển tiền giữ ví đã chọn khi làm mới. Nếu ví biến mất hoặc không còn cùng tiền tệ, cần chọn lại; không tự thay bằng ví khác. Có trạng thái lỗi tải và thử lại.
- Danh sách vay/nợ bỏ phản hồi của bộ lọc cũ, có nút thử lại. Chọn “Đã thanh toán” tự bỏ phạm vi “Chưa tất toán” đang mâu thuẫn; chọn “Chưa tất toán” bỏ trạng thái đã thanh toán.
- Có `scripts/check-api.cjs` kiểm tra health marker, HTTP và phản hồi HTML của tunnel mà không gửi thông tin đăng nhập hay ghi dữ liệu.
- Kiểm tra: toàn bộ mobile 42 bộ/183 test đạt; thêm 3 test danh sách vay/nợ chạy riêng đạt sau đó. Backend toàn bộ 38 bộ/202 test đạt. Hai script cấu hình/kiểm tra API có 6 test Node đạt; TypeScript mobile đạt. Chưa coi test mock là xác nhận trên Android, MySQL đồng thời hoặc mạng 4G thật.

Việc còn lại trước buổi thử: URL tunnel và tài khoản thử, sao lưu/phục hồi DB + uploads, kiểm tra công cụ build APK, chạy/cài APK thật và xác minh qua 4G. Hướng dẫn chi tiết ở `APK_REMOTE_TEST_PLAN.md` và `backend/LAPTOP_SERVER.md`.

## Phần đã sửa trong đợt này

- Hashtag nhiều từ như `di chuyển`: cùng chuẩn Unicode NFC, bỏ dấu # đầu tên, gộp khoảng trắng, giữ dấu tiếng Việt trên mobile và backend.
- Nhập `di chuyển, #ăn uống, học tập` giữ đủ ba hashtag. Trước đây các phần không có # có thể bị bỏ mất.
- Bộ lọc hashtag tìm ký tự `%` và `_` như ký tự thường, không coi chúng là mẫu tìm SQL.
- Gộp hashtag không xóa tag nguồn nếu database nhận diện tên đích là chính tag đó (ví dụ so sánh tên có dấu/không dấu).
- Icon danh mục tương đối thử các địa chỉ API dự phòng, thay vì chỉ địa chỉ đầu tiên. Đường dẫn `/public/...` và `/uploads/...` được xử lý đúng.
- Tìm giao dịch chờ 250 ms sau thay đổi bộ lọc; phản hồi cũ không ghi đè bộ lọc mới, không cập nhật sau khi rời màn hình.
- Nhãn tổng tiền trên màn tìm kiếm nêu rõ chỉ tính trang đang hiển thị; ô tìm ghi chú không còn hứa tìm cả hashtag. Hashtag có bộ lọc riêng.
- Màn hashtag phân biệt chưa có dữ liệu và không tìm thấy tên phù hợp.

Danh mục “Di chuyển” đã được kiểm tra đọc trong database: nhóm NORMAL, icon `categories/icons/expense_transport.png`, file tồn tại. Chưa xác nhận biểu hiện trên thiết bị; chưa sửa/xóa/gộp dữ liệu cũ tự động.

## Thứ tự thực hiện tiếp

### Tiến độ bảo vệ dữ liệu và thao tác lưu

- Đã tách trạng thái FinanceContext theo tài khoản và bỏ kết quả/token thuộc phiên cũ. Khôi phục phiên khi lỗi mạng giữ thông tin đăng nhập và có nút thử lại.
- Đã khóa thao tác bấm lưu liên tiếp cho giao dịch, chuyển ví và mục tiêu/góp tiết kiệm.
- Đã ngừng tự gửi lại request ghi và refresh token sang server khác khi mất phản hồi; app báo kết quả chưa xác định và yêu cầu kiểm tra lịch sử trước khi thử lại. Chưa có idempotency phía server cho lần thử lại thủ công.
- Đã thêm GET /health để nhận diện backend trước khi gửi thao tác ghi. Endpoint này chỉ xác nhận ứng dụng đang trả lời, chưa kiểm tra kết nối database. Cần cập nhật backend cùng bản mobile này.
- Lỗi tạo thông báo ngân sách sau khi lưu giao dịch không còn làm API trả lỗi lưu.
- Đã bảo vệ ví nhận khi chuyển tiền và kiểm tra lại số dư bằng 0 trước khi xóa mục tiêu; các cập nhật liên quan nằm trong cùng transaction.
- Sửa/xóa giao dịch khóa bản ghi và từ chối nếu số tiền, ví hoặc danh mục đã thay đổi trong lúc chờ.
- Chỉnh ví kiểm tra lại trạng thái/số dư/tiền tệ dưới khóa; ví có lịch sử chuyển tiền không được đổi tiền tệ. Còn cần rà mọi luồng ghi tiền để đối chiếu trạng thái và tiền tệ ví tại thời điểm commit.
- Đã đối chiếu tiền tệ/trạng thái/quyền sở hữu trong cập nhật số dư của giao dịch thường, chuyển ví và vay/nợ. Hoàn bút toán vay/nợ vẫn cho phép điều chỉnh ví đã lưu trữ, nhưng kiểm tra chủ sở hữu và tiền tệ.
- Vay/nợ khóa bản ghi chung trước thanh toán/sửa/xóa và đọc lại tổng đã trả; chặn trả vượt số còn lại, đổi tiền gốc sau thanh toán và hoàn tiền hai lần cho lần thanh toán đã xóa. Cần kiểm tra cạnh tranh trên MySQL thử nghiệm để xác nhận hành vi khóa thực tế.
- Không cho sửa/xóa bút toán liên kết khoản vay/nợ qua API giao dịch thường; phải qua chức năng vay/nợ để giữ sổ phụ khớp. Ngày vay/nợ được chuẩn hóa UTC và từ chối ngày không tồn tại. Ví mục tiêu không dùng trực tiếp để vay/cho vay.
- Màn kế hoạch và mục tiêu bỏ phản hồi tải đã cũ, tránh ghi đè dữ liệu sau khi làm mới.
- Màn ngân sách giữ số lẻ khi sửa hạn mức ngoại tệ, nhận dấu phẩy hoặc chấm thập phân và từ chối chuỗi có phân cách hàng nghìn mơ hồ. Chặn bấm lưu/xóa/tạo kỳ mới liên tiếp bằng cùng một khóa thao tác.
- Tìm ngân sách chờ 250 ms sau khi nhập; phản hồi cũ bị bỏ, trang vượt phạm vi được điều chỉnh lại. Phân biệt không có ngân sách, không có kết quả theo bộ lọc và lỗi tải có nút thử lại. Thanh tiến độ hiển thị 0% khi chưa chi.
- Từng danh mục trong kế hoạch mở được bản nháp ngân sách với hạn mức đã chọn. Chỉ hiển thị ví cùng tiền tệ; nếu có nhiều ví phải chọn ví áp dụng. Mức kế hoạch tổng hợp nhiều ví được giải thích trong bản nháp; chỉ tạo ngân sách sau khi bấm Lưu.
- Đã giữ phần lẻ trong nhập số dư ví, chuyển tiền, tiền gốc vay/nợ và thanh toán. Nút trả hết giữ đúng khoản còn lại; đổi tên ví không gửi điều chỉnh số dư nếu số tiền không thay đổi, kể cả ví âm.
- Luồng lưu/xóa ví, lưu vay/nợ, trả nợ và xóa lần thanh toán có khóa bấm liên tiếp. Lỗi xóa vay/nợ được hiển thị thay vì để promise thất bại không được xử lý. Đây chưa phải idempotency phía server.
- Nhập giao dịch và mục tiêu/góp tiết kiệm giữ phần lẻ, từ chối số có phân cách hàng nghìn mơ hồ. Chi tiết vay/nợ có nút thử tải lại khi lỗi mạng, bỏ phản hồi cũ sau khi rời màn hình.
- Backend đã hỗ trợ PORT/HOST và đóng Prisma khi dừng có kiểm soát; hướng dẫn chạy laptop ở `backend/LAPTOP_SERVER.md`. Chưa đổi cấu hình mạng hoặc chạy server.
- Đã bỏ Content-Type JSON áp lên mọi phản hồi để ảnh tĩnh được phục vụ đúng loại nội dung.
- Chi tiết mục tiêu có bản xem trước so sánh 1–4 tháng, số tiền bình quân cần góp và chênh lệch với tốc độ gần đây; không thay đổi lịch đang lưu. Đã thêm lựa chọn giữ nguyên, giảm nhẹ hoặc theo mức gợi ý cho danh mục có thể giảm; giới hạn chi và tổng phương án cập nhật theo lựa chọn. Chưa lưu các mức thử thành ngân sách.
- Định dạng tiền giữ phần thập phân theo tiền tệ (ví dụ 0,50 USD); chặn chuyển 0, ngày không tồn tại và tên ví trống sau khi bỏ khoảng trắng.
- Các khóa và điều kiện trên đã có kiểm thử mock; chưa thực hiện thử cạnh tranh trên MySQL thật. Không coi đây là bằng chứng đã xử lý hết mọi trường hợp đồng thời.

Ưu tiên tiếp: idempotency phía server; kiểm tra ví đồng nhất giữa giao dịch, chuyển ví và vay/nợ; cấu hình môi trường server laptop và quy trình sao lưu/phục hồi.

### Bổ sung sau khi rà tìm kiếm

- Đã sửa khoảng tuần cuối tháng, chọn tuần khi đổi năm và mặc định quý hiện tại.
- Đã thêm trạng thái lỗi mạng với nút thử lại; không giữ kết quả cũ dưới bộ lọc mới.
- Đã sửa chuyển nhóm Thu/Chi để bỏ danh mục không tương thích; bộ lọc vay/nợ từ màn trước không khóa các lựa chọn Thu/Chi mới.
- Hai ô từ khóa và ghi chú được áp dụng đồng thời, thay vì một ô âm thầm ghi đè ô còn lại.
- API kiểm tra mã ví, mã danh mục, trang và số kết quả là số nguyên dương; từ chối loại giao dịch/nhóm dòng tiền không hợp lệ.
- Các sửa hiển thị hashtag đã tách nền màu ra khung riêng và ngăn giãn dọc trong hàng cuộn; còn cần kiểm tra trực quan trên điện thoại.

Ước lượng dưới đây là ngày làm việc cho một người sau khi chốt phạm vi, không gồm thời gian duyệt Google Play.

| Đợt | Việc cần làm | Điều kiện hoàn tất | Ước lượng |
|---|---|---|---|
| P0 — Dữ liệu và phiên đăng nhập | Đã sửa và kiểm thử logic; còn kiểm tra luồng đổi tài khoản trên thiết bị thật | Không lóe dữ liệu người trước, không nhận token hoặc kết quả cũ sau khi đổi tài khoản | Còn kiểm tra thiết bị |
| P0 — Ghi giao dịch | Chống lưu hai lần, idempotency cho tạo giao dịch/chuyển ví/góp tiết kiệm; không tự gửi lại thao tác ghi khi timeout chưa rõ kết quả | Một lần bấm hoặc gửi lại cùng mã chỉ tạo một bút toán; số dư hai ví và lịch sử khớp | 2–3 ngày |
| P0 — Laptop làm server | Cấu hình API URL theo môi trường, PORT/HOST backend; endpoint kiểm tra sức khỏe; hướng dẫn khởi động và phục hồi | Điện thoại kết nối được theo môi trường đã chọn, lỗi server có thông báo rõ, không để secret trong app | 1–2 ngày |
| P0 — Sao lưu | Sao lưu MySQL và ảnh ra nơi khác; kiểm tra phục hồi trên database thử nghiệm | Phục hồi đủ giao dịch, tag, ví, ảnh và mục tiêu; ghi thời điểm bản sao lưu cuối | 1 ngày |
| P1 — Tag và danh mục | Rà tên tag cũ có khoảng trắng/Unicode khác nhau; lập báo cáo trùng trước khi gộp; cập nhật dữ liệu dùng chung sau đổi tên/xóa | Không mất liên kết giao dịch; tổng số liên kết trước/sau đối soát được | 1–2 ngày |
| P1 — Tìm kiếm và báo cáo | Thống nhất tổng toàn bộ kết quả với tổng trang; kiểm tra quy đổi theo tiền tệ; tối ưu truy vấn thống kê đang tải toàn bộ giao dịch | Tổng khớp dữ liệu kiểm chứng, không cộng lẫn tiền tệ, phân trang không đổi tổng toàn bộ | 2–3 ngày |
| P1 — Ngân sách | Tách khoản cố định và linh hoạt, số tiền còn có thể chi trong tuần, cảnh báo theo ngưỡng; rà chu kỳ tháng/ngày cuối tháng | Chi ẩn/vay nợ/chuyển ví không bị tính nhầm; hết tháng chuyển kỳ đúng | 2 ngày |
| P1 — Kế hoạch tiết kiệm | Cho chỉnh mức giảm từng danh mục; so sánh 1/2/3/4 tháng; nhập khoản nợ và mức tiền muốn giữ lại; chỉ lưu kế hoạch sau khi người dùng chọn | Có việc làm tuần này, giới hạn chi, lịch góp và cảnh báo thiếu tiền từng tháng; không tự chuyển tiền | 2–3 ngày |
| P1 — Chatbot | Tái sử dụng dữ liệu kế hoạch đã tính, giảm gọi AI cho câu hỏi mẫu; lưu lựa chọn thời hạn; chỉnh mục tiêu qua bản xem trước | Số tiền dẫn được về dữ liệu, không tạo kế hoạch/giao dịch ngầm, câu hỏi tùy ý vẫn được xử lý đúng | 2 ngày |
| P1 — UI chung | Thống nhất màu, khoảng cách, chữ và trạng thái tải/lỗi/rỗng; ưu tiên màn giao dịch, ví, hashtag, ngân sách | Chữ lớn không che số tiền; nút chạm đủ rộng; thao tác lưu có trạng thái và thử lại rõ | 2–3 ngày |
| P2 — Giọng nói/OCR | Kiểm tra quyền bị từ chối, rời màn khi đang nghe, lỗi nhận dạng; OCR chỉ giữ thông tin tổng hóa đơn | Nhập tay luôn dùng được; không tự gửi transcript; người dùng duyệt số tiền trước khi lưu | 1–2 ngày + thiết bị thật |
| P2 — Phát hành | Hoàn thành các điểm còn thiếu trong GOOGLE_PLAY_PLAN.md; thử APK nhóm nhỏ trước | Có bản ký release, chính sách dữ liệu, quy trình xóa tài khoản, kiểm tra bản cài thật | Theo checklist phát hành |

## Các khả năng nên thêm sau khi phần nền ổn định

1. Giao dịch định kỳ: nhắc tiền nhà/học phí/gói thuê bao, mặc định yêu cầu xác nhận ghi sổ.
2. Dự tính chi lớn: so sánh mua ngay với tiết kiệm trong vài tháng, hiển thị tháng thiếu tiền.
3. Kiểm tra cuối tuần: ba danh mục vượt kế hoạch, số tiền còn có thể chi và một hành động cụ thể.
4. Xuất dữ liệu cá nhân: CSV theo thời gian, tiền tệ và bộ lọc; số liệu phải đối chiếu được với màn hình.
5. Chế độ ghi nháp khi mất mạng: lưu nháp cục bộ, chỉ đồng bộ sau khi có idempotency và quy tắc xử lý xung đột.

Không ưu tiên thêm đầu tư, liên kết ngân hàng hoặc thanh toán thật trước khi tính đúng số tiền và phục hồi dữ liệu tin cậy.

## Kiểm tra và giới hạn

- Mốc kiểm tra toàn bộ gần nhất trước đợt ngân sách: mobile 34 suites / 136 tests và backend 38 suites / 199 tests đều qua. Các thay đổi sau mốc này được kiểm tra theo phạm vi tương ứng; không coi số đếm này là kết quả của phiên bản cuối cùng.
- TypeScript mobile, build backend và lint các file thay đổi đều qua; sau thay đổi cuối tiếp tục kiểm tra kiểu backend theo tsconfig.build.json.
- Test tự động không thay thế kiểm tra mạng LAN/tunnel, ảnh thật, bàn phím, micro và bản cài trên điện thoại.
- Chưa mở Android, chạy giả lập, thay cấu hình mạng máy, bật tunnel, triển khai server hoặc phát hành CH Play.
- Không yêu cầu mua dịch vụ để thực hiện các bước sửa code trong kế hoạch này.
