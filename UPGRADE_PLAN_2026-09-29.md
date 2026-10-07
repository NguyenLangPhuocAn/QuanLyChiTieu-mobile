# Kế hoạch nâng cấp 7 hạng mục — lập 29/09, cập nhật 07/10/2026

## Cách tiếp tục công việc

Đây là kế hoạch đang áp dụng theo yêu cầu mới nhất của người dùng. Làm từng đợt, kiểm tra xong mới chuyển đợt; không sửa hàng loạt để chạy theo thời gian. Đọc tài liệu này khi người dùng nói “tiếp tục”. Các tài liệu ngày 21–28/09 là lịch sử, không thay thế quyết định mới bên dưới.

Trạng thái: ĐÃ LẬP KẾ HOẠCH, CHƯA TRIỂN KHAI bảy hạng mục mới. Chưa kiểm tra PC chính, chưa chạy lại app, chưa dùng camera/micro, chưa tạo project Firebase, chưa xuất/gửi báo cáo mới và chưa cấp quyền đọc thông báo ngân hàng.

Đường dẫn làm việc đã xác minh trên laptop: `C:/Users/Admin/Documents/QuanLyChiTieu` (đường dẫn E: trong ngữ cảnh không tồn tại). Ba repository độc lập: `backend`, `mobile`, `web_admin`. Kế hoạch này được đặt trong repo mobile để có thể đồng bộ qua Git, không nằm riêng trong thư mục releases ngoài Git.

Mỗi buổi bắt đầu:

1. Đọc kế hoạch và nhật ký cuối tài liệu; kiểm tra Git status trước mọi cập nhật.
2. Xác định đợt đang làm và chọn một đầu việc đủ nhỏ để hoàn tất/kiểm chứng.
3. Giữ nguyên dữ liệu, thay đổi chưa commit, phiên đăng nhập và cấu hình người dùng.
4. Ghi kết quả ĐẠT / LỖI / CHƯA THỬ cùng bằng chứng; không dùng test mock để khẳng định phần cứng hoặc PC từ xa đã đạt.
5. Cập nhật mục tiếp theo, file đã sửa, commit/APK/API tương ứng. Chỉ đưa bản được kiểm tra cho người dùng; không phát hành tự động mọi lần push.

## Các yêu cầu đã ghi nhận

| ID | Yêu cầu | Trạng thái | Điều kiện bắt đầu |
|---|---|---|---|
| P1 | PC chính không thấy vòng xoay khi chọn/tải ảnh, laptop có | Chưa xác định nguyên nhân | Đối chiếu bản cài, code và API hai máy |
| P2 | OCR nhận dạng cả thành phần hóa đơn | Chưa triển khai | P1 ổn, thống nhất hợp đồng dữ liệu |
| P3 | Làm UI và backend mượt, ít chờ, lưu chắc chắn | Chưa đo baseline | Đo từ P1; hoàn thiện sau P2 |
| P4 | Firebase báo và hỗ trợ cập nhật app | Chưa cấu hình | Phiên bản/chữ ký rõ, có project Firebase và tester |
| P5 | Báo cáo hóa đơn đầy đủ theo tháng/quý/năm/kỳ tùy chọn | Chưa thiết kế bản mới | Dữ liệu P2 ổn và quy tắc tổng hợp được kiểm chứng |
| P6 | Tối ưu UI toàn bộ theo từng màn | Chưa nghiệm thu | Làm cùng từng đợt; rà toàn bộ sau P5 |
| P7 | Đọc thông báo ngân hàng và tự thêm thu/chi | Chưa triển khai | P3 có idempotency bền vững; có mẫu thông báo đã che dữ liệu nhạy cảm |

Thứ tự chính: P1 → P2 → P3 → P7 → P4 → P5 → P6. P7 được đặt sau P3 vì giao dịch tự động bắt buộc có chống ghi trùng và hàng đợi tin cậy. P6 được áp dụng ngay trong các màn đang sửa; không chờ đến cuối mới chỉnh khả năng sử dụng. Chuẩn bị phiên bản và đo hiệu năng có thể làm trong P1; chưa triển khai đồng loạt các chức năng khác.

Quyết định cần giữ:

- Yêu cầu OCR từng món ngày 29/09 **thay thế** yêu cầu cũ “chỉ thông tin tổng quát, receipt_items rỗng”. Giao diện vẫn mặc định gọn, chi tiết mở khi cần.
- Giữ theme cam, nền ấm, nút `?` mở giải thích; khung chat rộng, gợi ý ngắn theo hàng ngang.
- So sánh 1–4 tháng nằm phía trên dự báo thu–chi. Quản lý mục tiêu tiết kiệm là màn riêng. Không thêm lại nhãn “khả năng góp sau nghĩa vụ”.
- OCR/giọng nói chỉ đi đến bản nháp; chỉ bấm Lưu mới tạo giao dịch. Câu hỏi không được tự ghi thu–chi.
- Ưu tiên miễn phí và laptop server; không mua dịch vụ, không đưa lên CH Play trong kế hoạch này.
- Không gỡ app, xóa dữ liệu, reset DB hay đẩy secrets/khóa ký lên GitHub.
- Báo cáo email: xem nội dung và file trước; hỏi địa chỉ nhận và đợi đồng ý trước khi gửi thật.
- Phạm vi báo cáo tạm chọn: thu–chi + hóa đơn + từng món, cho người dùng bật/tắt phần cần xuất. Đã hỏi lại phạm vi; cập nhật nếu người dùng chọn chỉ hóa đơn.
- Đọc thông báo ngân hàng chỉ hoạt động khi người dùng chủ động cấp quyền Android và chọn đúng ứng dụng ngân hàng/ví đích. Chế độ tự lưu là tùy chọn theo từng tài khoản; thông báo mơ hồ luôn chuyển thành bản nháp để kiểm tra.
- Không đọc SMS, OTP, nội dung clipboard hoặc thông báo từ ứng dụng ngoài danh sách người dùng bật. Không log nguyên văn thông báo tài chính hoặc gửi nội dung đó sang AI.

## Hiện trạng có bằng chứng từ mã nguồn

Baseline Git lúc rà: mobile `8e316ab`, backend `86787ca`, web_admin `ed0a61f`; cả ba working tree sạch trước khi viết kế hoạch. Kết quả kiểm tra từ buổi trước: mobile 223 test, backend 268 test, web admin 2 test đạt. Đây không phải kết quả chạy lại ngày 29/09.

| Phần | Hiện trạng | Ý nghĩa |
|---|---|---|
| Spinner | `src/screens/home/MainScreen.tsx`: overlay khi `isOcrLoading && !isModalVisible`; form có trạng thái tải riêng | Đã có trên laptop; chưa chứng minh PC chạy cùng bundle hoặc cùng luồng |
| OCR backend | `../backend/src/transactions/receipt-ocr.service.ts` yêu cầu không trích từng món và trả `receipt_items: []` | Phải sửa hợp đồng, validation, UI và lưu dữ liệu, không chỉ đổi prompt |
| Dữ liệu món | Prisma có `receipt_items Json?`; normalizer chỉ giữ `{name, amount}`, tối đa 100 món | Có nền sẵn; thêm quantity/unit_price/tax cần tương thích dữ liệu cũ |
| Form mobile | Type ReceiptItem chỉ có name/amount; luồng tạo hiện tại không gửi receipt_items | Cần nối đầy đủ OCR → sửa nháp → API → DB → lịch sử → báo cáo |
| Lưu ảnh | Tạo giao dịch trước rồi upload ảnh; báo riêng nếu upload thất bại | Retry ảnh phải gắn giao dịch đã có, không tạo thêm giao dịch |
| Báo cáo | `reports.service.ts`: Excel 5 sheet, PDF tổng quan + giao dịch; query chưa lấy receipt_items/receipt_image | Có thể mở rộng; hiện chưa có phụ lục từng món/ảnh |
| Kỳ báo cáo | Backend có ngày/tuần/tháng/quý/năm/tùy chọn/tất cả; mobile gọi qua `src/services/statistics.ts` | Cần rà chọn tháng/năm quá khứ và ranh giới kỳ, không xây lại từ đầu |
| Quyền báo cáo | Backend giới hạn PREMIUM/ADMIN | Dùng tài khoản thử đúng quyền; không tự bỏ phân quyền hoặc yêu cầu mua gói |
| PDF | Font hiện trỏ `C:/Windows/Fonts/arial*.ttf` | Cần font tiếng Việt đi kèm hợp lệ khi chuyển máy/server |
| Phát hành | `android/app/build.gradle`: versionCode 1, versionName 1.0, release ký debug; chưa thấy tích hợp App Distribution trong cấu hình đã rà | Không đủ để vận hành chuỗi cập nhật lâu dài |
| Thông báo ngân hàng | Manifest chưa có `NotificationListenerService`/quyền bind listener; chưa có parser, cấu hình ánh xạ hay nguồn giao dịch ngân hàng | P7 là chức năng Android native mới, không thể coi thông báo app hiện tại là dữ liệu ngân hàng |

## P1 — Đồng nhất hai máy và sửa trạng thái xử lý ảnh

Mục tiêu: cùng phiên bản và cùng thao tác phải có trạng thái dễ hiểu trên cả PC chính và laptop/điện thoại.

- [ ] P1.1 Ghi bảng đối chiếu mỗi môi trường: commit, package, versionCode/versionName, chế độ debug/release, SHA-256 APK, fingerprint chứng chỉ, API URL, phiên bản Android, nơi mở ảnh (chatbot/form/lịch sử).
- [ ] P1.2 Phân biệt PC chỉ build/cài APK hay đang chạy UI web. Không mặc định UI PC là Android. Không thể kiểm tra PC từ laptop nếu chưa có quyền truy cập hoặc bằng chứng bên PC.
- [ ] P1.3 Nếu lệch commit/bundle: đồng bộ an toàn, build đúng bản và cài đè bằng cùng chữ ký. Không reset/clean/xóa dữ liệu để thử mò.
- [ ] P1.4 Nếu cùng bản vẫn lệch: tái hiện với cùng ảnh, đo thời điểm chọn ảnh, đóng picker, bắt đầu request, kết thúc OCR; kiểm tra overlay bị modal/bàn phím che, z-index/elevation, state reset sớm, response cũ và JS thread bị chặn.
- [ ] P1.5 Chuẩn hóa trạng thái: chọn ảnh → chuẩn bị → đang đọc → cần kiểm tra → đang lưu → hoàn tất hoặc lỗi. Chỉ hiển thị tiến độ upload thật nếu đo được; không giả phần trăm OCR.
- [ ] P1.6 Chặn bấm lặp; hủy bỏ qua response muộn; ảnh mới không giữ dữ liệu ảnh cũ. Không cố kéo dài request chỉ để thấy spinner.
- [ ] P1.7 Thêm thông tin phiên bản/API trong màn Giới thiệu hoặc chẩn đoán để người dùng đối chiếu mà không cần đọc code.

Kiểm tra: ảnh hợp lệ, sai ảnh, hủy picker, từ chối quyền, ảnh lớn, mạng chậm, timeout, đổi tab và chọn hai ảnh liên tiếp. Mô phỏng độ trễ có kiểm soát khi test spinner; không sửa độ trễ production.

Đạt khi: xác định được nguyên nhân có bằng chứng; spinner/trạng thái hiển thị trong thời gian chờ, tự tắt mọi nhánh; không tự tạo bản nháp khi hủy/sai ảnh; có ảnh/video hai môi trường hoặc ghi rõ môi trường còn chưa thử. Lưu riêng bằng chứng trước/sau và bảng phiên bản.

## P2 — OCR và bản nháp hóa đơn có từng món

### Hợp đồng dữ liệu trước khi viết UI

- [ ] P2.1 Chốt cấu trúc có phiên bản: thông tin cửa hàng, số hóa đơn/ngày nếu nhìn thấy, tiền tệ, tạm tính, giảm giá, thuế, phí và tổng phải trả. Tiền khách đưa/tiền thối là trường riêng, tuyệt đối không dùng làm tổng chi.
- [ ] P2.2 Mỗi dòng: tên, số lượng, đơn vị, đơn giá, thành tiền; giảm giá/thuế dòng chỉ có khi đọc rõ. Trường thiếu để null, không tự bịa hoặc coi null là 0. Đánh dấu “Cần kiểm tra” theo validation/sự không chắc chắn; không trình bày điểm OCR giả như xác suất đã kiểm chứng.
- [ ] P2.3 Giữ khả năng đọc `{name, amount}` cũ, không xóa thông tin cũ khi APK cũ chỉnh ghi chú. Chốt lưu JSON có version hay bổ sung bảng/cột sau khi đánh giá truy vấn báo cáo; migration chỉ thêm, có backup và cách khôi phục trên DB thử.
- [ ] P2.4 Định nghĩa amount dòng là trước/sau giảm giá và cách cộng thuế/phí để tránh cộng hai lần. Tính tiền bằng decimal/đơn vị nhỏ nhất theo tiền tệ; quantity cho phép số lẻ. Giới hạn số dòng/kích thước và thông báo rõ nếu hóa đơn vượt khả năng xử lý, không cắt âm thầm.

### Nhận dạng, chỉnh và lưu

- [ ] P2.5 Sửa schema/prompt OCR, parser và DTO/normalizer; kiểm tra ảnh không phải hóa đơn, số mơ hồ, sai ngày, VND/USD và dữ liệu OCR không hợp lệ. Không thực thi hướng dẫn nằm trong ảnh hóa đơn.
- [ ] P2.6 Bản nháp gọn: ảnh + cửa hàng/ngày + tổng tiền/ví/danh mục, mục “Chi tiết hóa đơn” mở rộng để thêm/sửa/xóa dòng. Bảng đối chiếu giải thích khoản lệch, không ép sửa dòng cho khớp bằng số bịa.
- [ ] P2.7 Nếu thiếu tổng: thông báo yêu cầu nhập/xác nhận thủ công qua hành động rõ; không tự mở bản nháp chatbot chỉ vì đã chọn ảnh. Nếu có tổng rõ nhưng thiếu dòng: cho lưu tổng sau xác nhận và đánh dấu chi tiết chưa đầy đủ.
- [ ] P2.8 Lưu chi tiết được xác nhận trong cùng giao dịch DB với bút toán; ảnh liên kết đúng transaction ID. Lỗi ảnh chỉ thử lại phần ảnh. Một hóa đơn mặc định là một giao dịch; các món là chi tiết, không cộng lại vào tổng thu–chi.
- [ ] P2.9 Hiển thị và chỉnh chi tiết ở lịch sử; OCR lại không tự ghi đè dữ liệu người dùng đã sửa. Xóa/đổi ảnh dọn đúng liên kết.

Kiểm tra: hóa đơn 1/nhiều món, số lượng lẻ, khuyến mãi, VAT đã gồm/chưa gồm, phí dịch vụ, tiền thối, ảnh nghiêng/mờ/cắt cạnh, ảnh không phải hóa đơn, ngoại tệ, dữ liệu legacy. Đối chiếu thủ công với ảnh gốc có đáp án; test mock dùng kiểm tra logic, không thay cho OCR thật.

Đạt khi: bản nháp/lịch sử/DB trùng giá trị sau xác nhận; tổng giao dịch và số dư đúng một lần; từng món không bị mất; thiếu thông tin được thể hiện rõ. Đến bước OCR thật mới nhờ người dùng chụp/chọn bộ hóa đơn thực tế và ghi lại sai số.

## P3 — UI/backend mượt và lưu ổn định

- [ ] P3.1 Đo trước: thời gian UI phản hồi, API nhận upload, OCR, ghi DB và refresh lịch sử; phân biệt mạng/tunnel/AI/DB. Ghi p50/p95 khi đủ mẫu; không đưa vài request lẻ thành cam kết hiệu năng.
- [ ] P3.2 Đo bằng cùng thiết bị, cùng ảnh và bộ dữ liệu. Log request ID và timing, không ghi token/nội dung hóa đơn; không làm nóng server bằng test tải không kiểm soát.
- [ ] P3.3 Giảm kích thước ảnh hợp lý có so sánh độ chính xác OCR; sửa xoay ảnh theo metadata nếu cần. Kiểm tra memory/UI jank khi xử lý ảnh lớn.
- [ ] P3.4 Rà request trùng khi focus/đổi tab, state cập nhật quá rộng, render danh sách dài; chỉ dùng memo/cache/phân trang khi đo chứng minh lợi ích. Cache tách tài khoản/ví, làm mới sau ghi.
- [ ] P3.5 Rà timeout/hủy, rate limit OCR, lỗi nhà cung cấp; không tự retry thao tác ghi tiền. Nếu request OCR dài thực tế gây timeout, đánh giá job nền có giới hạn thay vì đưa thêm hạ tầng ngay.
- [ ] P3.6 Thêm idempotency bền vững theo user + thao tác + key cho lưu giao dịch; payload khác cùng key bị từ chối, retry sau restart trả cùng kết quả. Khóa nút chỉ là lớp UI.
- [ ] P3.7 Tối ưu query/index dựa trên truy vấn đo được; bảo toàn transaction số dư và quyền sở hữu ví/ảnh. Thử lỗi sau commit nhưng trước response, upload ảnh lỗi và restart backend.

Đạt khi: UI phản hồi ngay bằng trạng thái phù hợp, không treo vòng quay; test hai lần Lưu, mất response và khởi động lại không nhân đôi giao dịch; có số đo trước/sau. Mục tiêu phản hồi thao tác dưới khoảng 200 ms trên thiết bị thử là mục tiêu đo, không phải khẳng định đã đạt; thời gian OCR báo riêng.

## P7 — Đọc thông báo ngân hàng và tự thêm thu/chi

Mục tiêu: trên Android, khi ngân hàng gửi thông báo biến động số dư, app nhận biết tiền vào/ra, ánh xạ đúng ví và tạo giao dịch một lần. Chức năng không được tự bật. Mặc định lần đầu là **xem lại trước khi lưu**; người dùng có thể bật **tự lưu** riêng cho từng ngân hàng/tài khoản sau khi các mẫu đã nhận đúng.

### Quyền, riêng tư và phạm vi

- [x] P7.1 Tạo `NotificationListenerService` native Android và cầu nối React Native. Màn cài đặt giải thích dữ liệu cần đọc trước khi mở trang Android “Quyền truy cập thông báo”; app không thể tự cấp quyền hoặc giả rằng người dùng đã cấp.
- [x] P7.2 Chỉ nhận package ngân hàng/ví điện tử nằm trong danh sách người dùng bật. Loại ngay thông báo của chính app, OTP, quảng cáo, ưu đãi, tin đăng nhập và nội dung không phải biến động tiền.
- [ ] P7.3 Phân tích trên thiết bị. Không gửi nguyên văn thông báo sang AI, analytics hoặc log; log chẩn đoán chỉ có mã parser/kết quả đã che. Chỉ lưu phần đã chuẩn hóa cần cho giao dịch và fingerprint chống trùng; cho phép tạm dừng, thu hồi quyền và xóa hộp thư chờ.
- [ ] P7.4 Ghi rõ giới hạn: chỉ xử lý thông báo phát sinh sau khi cấp quyền; không hứa lấy đầy đủ lịch sử cũ. Android/OEM có thể dừng dịch vụ nền, vì vậy màn cài đặt phải hiện trạng thái quyền và lần nhận gần nhất thay vì khẳng định luôn chạy.

### Parser và ánh xạ giao dịch

- [ ] P7.5 Xây registry parser theo `packageName + ngân hàng + phiên bản mẫu`, không dùng một regex chung cho mọi ngân hàng. Mỗi parser trả: thu/chi, số tiền, tiền tệ, thời gian, số tài khoản đã che, số dư sau giao dịch nếu có, nội dung/đối tác đã làm sạch và mã tham chiếu nếu có.
- [ ] P7.6 Dùng mẫu thông báo thật đã che tên, số tài khoản, số dư và mã giao dịch để tạo fixture có đáp án. Không đưa tài khoản/OTP thật vào Git. Mẫu không khớp phiên bản parser hoặc có nhiều số tiền mơ hồ phải thành “Cần kiểm tra”, không tự chọn số lớn nhất.
- [ ] P7.7 Cho người dùng ánh xạ mỗi tài khoản ngân hàng đã che → một ví trong app có cùng tiền tệ; chọn danh mục mặc định riêng cho tiền vào/ra. Nếu chưa ánh xạ, có nhiều ví phù hợp hoặc tiền tệ khác thì chỉ tạo bản nháp.
- [ ] P7.8 Phân biệt giao dịch mua hàng, chuyển khoản đi/đến, hoàn tiền, phí ngân hàng, lãi, rút/nộp tiền và giao dịch thẻ tín dụng. Không coi chuyển giữa hai ví của cùng người dùng là thu/chi hai lần; giai đoạn đầu đưa ca chuyển nội bộ/hoàn tiền mơ hồ vào hàng chờ.
- [ ] P7.9 Gợi ý danh mục bằng quy tắc người dùng đã duyệt theo mô tả/đối tác. Không tự đổi danh mục chỉ vì tên gần giống. Cho sửa ví, loại, danh mục, ghi chú và ngày trước khi lưu.

### Chống trùng, offline và tự lưu

- [ ] P7.10 Thêm nguồn giao dịch `BANK_NOTIFICATION`, trạng thái nhận tự động và fingerprint có version. Ưu tiên mã tham chiếu ngân hàng; nếu không có, dùng hash ổn định của package + tài khoản che + loại + tiền + tiền tệ + thời gian chuẩn hóa + nội dung đã làm sạch. Không dùng riêng số tiền/thời gian vì dễ trùng hợp lệ.
- [x] P7.11 Backend nhận idempotency key duy nhất theo user/nguồn. Cùng key và cùng payload trả lại giao dịch cũ; cùng key nhưng payload khác báo xung đột. Ràng buộc phải tồn tại trong DB để còn hiệu lực sau restart/server nhiều tiến trình.
- [ ] P7.12 Hộp thư cục bộ có các trạng thái: chờ phân tích, cần kiểm tra, chờ đồng bộ, đã lưu, bỏ qua, lỗi. Khi laptop/server mất mạng, giữ mục chờ và đồng bộ lại có giới hạn; không tạo giao dịch lần hai nếu client mất response.
- [x] P7.13 Chế độ `Xem lại`: thông báo tạo bản nháp và hiện số tiền/ví/danh mục rõ ràng. Chế độ `Tự lưu`: chỉ chạy khi parser được hỗ trợ, tài khoản ánh xạ duy nhất, tiền tệ khớp và tất cả trường bắt buộc chắc chắn; nếu không đạt bất kỳ điều kiện nào thì hạ xuống bản nháp.
- [ ] P7.14 Sau tự lưu, hiển thị thông báo “Đã thêm khoản thu/chi …” kèm Xem và Hoàn tác trong thời gian hợp lý. Hoàn tác gọi nghiệp vụ xóa/đảo đúng một lần và để lại dấu vết nguồn; không chỉ trừ/cộng số dư ở UI.
- [ ] P7.15 Chống vòng lặp: thông báo do app phát ra, thông báo cập nhật/sync và thông báo trùng do ngân hàng thay nội dung không được tạo giao dịch mới. Khởi động lại máy, bật/tắt quyền, app bị kill và service reconnect vẫn không phát lại mục đã xử lý.

### UI và kiểm thử

- [ ] P7.16 Thêm màn “Giao dịch từ ngân hàng”: trạng thái quyền, ngân hàng được bật, ánh xạ ví, lựa chọn Xem lại/Tự lưu, lần nhận gần nhất, hàng chờ và lý do không tự lưu. Giải thích dài đặt sau nút `?`; không hiển thị toàn bộ nội dung nhạy cảm ở màn khóa/thông báo của app.
- [ ] P7.17 Kiểm tra unit parser bằng fixture cho từng ngân hàng; integration service → hàng chờ → API → DB; E2E với notification giả lập không chứa dữ liệu thật. Sau đó thử trên điện thoại thật với một giao dịch nhỏ do người dùng chủ động thực hiện và đối chiếu app ngân hàng, lịch sử, DB, số dư.
- [ ] P7.18 Các ca bắt buộc: cùng thông báo đến hai lần, ngân hàng cập nhật notification cũ, hai giao dịch cùng số tiền, không có mã tham chiếu, nhiều tiền tệ, mất mạng, backend restart, đổi tài khoản app, đổi ví ánh xạ, thu hồi quyền, OTP/quảng cáo và thông báo từ app giả mạo tên ngân hàng.
- [ ] P7.19 Báo cáo P5 cho phép lọc/nhìn nguồn `Ngân hàng tự động`; tổng tiền không cộng thêm so với giao dịch đã tạo. Người dùng có thể tìm các giao dịch cần kiểm tra và biết trường nào được lấy từ thông báo.

Đạt khi: với bộ ngân hàng được công bố hỗ trợ, thông báo tiền vào/ra tạo đúng **một** giao dịch vào đúng ví, kể cả mất response hoặc restart; thông báo mơ hồ không tự lưu; thu hồi quyền dừng nhận; không lưu/log OTP hoặc nội dung nguyên văn. Chưa kiểm tra điện thoại thật thì phải ghi CHƯA THỬ, không suy ra từ fixture.

## P4 — Firebase App Distribution và cập nhật trong app

Phạm vi: kênh thử nghiệm miễn phí bằng APK. App Distribution không phải OTA thay JavaScript và không phải kho phát hành công khai. “Tự động cập nhật” ở đây là tự kiểm tra bản mới, báo và hỗ trợ tải/cài; người dùng vẫn xác nhận cập nhật/cài đặt. Không hứa cài ngầm.

- [ ] P4.1 Kiểm tra Firebase project hiện có và tài khoản sở hữu; nếu chưa có, cấu hình Spark và Android app đúng package. Thông tin cần đến bước đó: project được chọn và nhóm tester; người dùng tự đăng nhập khi cần.
- [ ] P4.2 Chốt nhận diện app và chữ ký. App đang ký debug: không tự đổi khóa rồi yêu cầu gỡ app. Giai đoạn thử hiện tại phải giữ đúng chứng chỉ để cập nhật; trước phát hành thực tế chuẩn bị khóa release riêng và kế hoạch chuyển kênh/khôi phục dữ liệu rõ ràng. Không công khai khóa ký, không coi debug key là khóa production.
- [ ] P4.3 Tăng versionCode duy nhất cho mỗi bản phát hành, versionName dễ đọc. Lưu manifest gồm commit, API, build time, APK hash, fingerprint và ghi chú thay đổi. Hai PC không phát hành hai APK khác nội dung cùng versionCode.
- [ ] P4.4 Kiểm tra SDK App Distribution tương thích React Native/Android hiện tại; làm cầu nối native tối thiểu cho kiểm tra và cài update. Chỉ bật SDK thử nghiệm trên kênh tester.
- [ ] P4.5 Khi mở app/foreground, kiểm tra có giới hạn tần suất; nút “Kiểm tra cập nhật” trong Giới thiệu. Có “Để sau”, trạng thái mạng lỗi và tải lại; không cắt ngang bản nháp hoặc thao tác Lưu. Tài khoản tester Firebase tách khỏi tài khoản tài chính.
- [ ] P4.6 Script kiểm tra → build APK → verify chữ ký/hash → upload → phát hành vào nhóm tester đã được chỉ định. Mặc định bắt đầu bằng quy trình chủ động trên laptop; chỉ tự động pipeline khi đã chạy đúng. Chưa gửi email mời ai khi chưa có danh sách và yêu cầu gửi của người dùng.
- [ ] P4.7 Thử nâng từ bản A sang B qua Firebase trên điện thoại thật: hiện thông báo đúng, dữ liệu/đăng nhập/bản nháp giữ nguyên; mất mạng, từ chối cập nhật, không có bản mới và chưa có quyền tester được xử lý rõ.
- [ ] P4.8 Khôi phục bản lỗi bằng bản sửa có versionCode cao hơn; không dựa vào cài APK versionCode thấp hoặc gỡ app. API phải tương thích phiên bản mobile trước đó trong thời gian người dùng chưa cập nhật.

Đạt khi: hai bản liên tiếp được phát hành thử có manifest; tester nhận bản mới và cài đè được, dữ liệu không mất; có hướng dẫn ngắn và người dùng hiểu bước xác nhận vẫn cần. Bản app hiện tại cần cài một APK có tích hợp cập nhật lần đầu.

Nguồn chính thức kiểm tra 29/09/2026:

- Miễn phí App Distribution: https://firebase.google.com/pricing
- APK qua console: https://firebase.google.com/docs/app-distribution/android/distribute-console
- Thông báo trong app: https://firebase.google.com/docs/app-distribution/set-up-alerts?platform=android
- Hành vi tải/cài và xác nhận: https://firebase.google.com/docs/reference/android/com/google/firebase/appdistribution/FirebaseAppDistribution
- Giới hạn: https://firebase.google.com/docs/app-distribution/troubleshooting?platform=android (500 tester/project, 200/group, release 150 ngày; kiểm tra lại lúc triển khai).

## P5 — Báo cáo đầy đủ, đọc được và đối chiếu được

### Bộ chọn và quy tắc số liệu

- [ ] P5.1 Tháng chọn được tháng + năm bất kỳ; quý chọn quý + năm; năm chọn năm; tùy chọn có từ ngày–đến ngày. Giữ ngày/tuần nếu đang có. Hiện khoảng ngày cụ thể trước khi xuất; từ chối kỳ đảo ngược.
- [ ] P5.2 Chọn ví/tất cả ví, tiền tệ hiển thị, loại thu/chi và phạm vi có hóa đơn/tất cả nếu cần. Bật/tắt phụ lục từng món và ảnh để file không quá nặng.
- [ ] P5.3 Đồng nhất bộ lọc giữa màn preview, PDF, Excel và email. Ngày giao dịch và thời điểm tạo tách biệt; kiểm tra múi giờ Việt Nam, cuối tháng, tháng 2 nhuận, quý IV và giao năm. Quy ước khoảng lọc đầu gồm/cuối loại trừ ở backend, UI vẫn hiển thị ngày cuối được chọn.
- [ ] P5.4 Một nguồn tổng hợp dữ liệu cho mọi định dạng; dùng Decimal, quy tắc làm tròn thống nhất. Giữ tiền gốc/tiền tệ và tỷ giá quy đổi/nguồn/thời điểm; không cộng tiền khác đơn vị rồi gọi là VND.
- [ ] P5.5 Tổng thu–chi thường tách chuyển ví, góp tiết kiệm, vay/nợ; nếu xuất các nhóm này phải thành phần riêng và giải thích. Chênh lệch thu–chi không phải số dư cuối kỳ. Không hiển thị đầu/cuối kỳ nếu chưa có sổ cái đủ để tính đúng.
- [ ] P5.6 Tổng chi tiết món là diễn giải hóa đơn, không cộng thêm vào chi. Hóa đơn không khớp hoặc chưa đầy đủ có nhãn rõ; báo cáo đọc dữ liệu đã xác nhận, không tự OCR/bịa lại khi xuất.

### Nội dung sản phẩm

1. **Trang tổng quan:** tiêu đề, chủ báo cáo, kỳ và bộ lọc, thời điểm tạo, tiền tệ, tổng thu, tổng chi, chênh lệch, số giao dịch/hóa đơn; diễn giải ngắn có số liệu kiểm chứng.
2. **Biến động:** thu–chi theo ngày/tháng phù hợp với kỳ, phân bổ danh mục/ví, khoản lớn; so kỳ trước có cùng phạm vi và nêu trường hợp thiếu dữ liệu. Biểu đồ phục vụ giải thích, không thay bảng số.
3. **Giao dịch:** mã đối chiếu, ngày, thu/chi, ví, danh mục, ghi chú, hashtag, tiền gốc/quy đổi, liên kết mã hóa đơn. Tất cả dòng trong kỳ, không chỉ trang đang xem.
4. **Danh sách hóa đơn:** mã giao dịch/hóa đơn, cửa hàng, ngày, số món đã đọc, tạm tính, giảm giá, thuế/phí, tổng phải trả, tiền tệ và trạng thái đã kiểm tra/thiếu dữ liệu.
5. **Chi tiết hóa đơn:** từng dòng tên–số lượng–đơn vị–đơn giá–thành tiền, điều chỉnh và đối chiếu tổng; không diễn giải dữ liệu không có trong ảnh thành sự thật.
6. **Phụ lục ảnh tùy chọn:** ảnh vừa trang, đúng tỷ lệ, chú thích mã; lỗi/thiếu ảnh được ghi rõ. Không tạo URL ảnh tài chính công khai chỉ để nhúng vào báo cáo.
7. **Cách đọc:** phạm vi loại trừ, quy đổi/làm tròn, dữ liệu còn thiếu, phân biệt số dư hiện tại và số dư tại kỳ; tổng kiểm tra giúp người dùng đối chiếu.

- [ ] P5.7 Excel: Tổng quan, Giao dịch, Hóa đơn, Chi tiết hóa đơn, Danh mục, Thu–chi theo kỳ, Ví, Giải thích. Ô tiền là số, ngày đúng kiểu, header/filter/freeze, định dạng theo tiền tệ, chiều rộng và vùng in hợp lý. Chuỗi từ OCR không bị thực thi thành công thức.
- [ ] P5.8 PDF: font tiếng Việt có quyền phân phối, nhúng font; A4, đánh số trang, lặp header bảng, xuống trang không cắt dòng/tổng; ghi chú dài không tràn; biểu đồ và màu in đen trắng vẫn đọc được. Render từng trang để kiểm tra, không chỉ kiểm file tồn tại.
- [ ] P5.9 File nhiều hóa đơn/ảnh: xác định giới hạn dung lượng thực tế, phân trang/chunk dữ liệu; nếu cần job xuất file nền thì có trạng thái và tải có xác thực. Không cắt dữ liệu âm thầm để giảm kích thước.
- [ ] P5.10 Email: preview tiêu đề, kỳ, người nhận, tóm tắt và file; chống gửi lặp, timeout nói rõ chưa biết kết quả. Chỉ gửi thật sau người dùng đồng ý; không coi SMTP accepted là đã vào inbox.

Kiểm tra bắt buộc: kỳ rỗng, một giao dịch, nhiều trang, nhiều tiền tệ, hóa đơn thiếu dòng, VAT/giảm giá, giao dịch sửa/xóa, ví lưu trữ, ranh giới kỳ và dữ liệu lớn. Tài khoản A không xuất được ví/ảnh của B. Kiểm tra quyền Premium/Admin hiện tại bằng tài khoản thử, không âm thầm bỏ phân quyền.

Đạt khi: cùng bộ lọc thì DB, preview, Excel, PDF và email trùng số liệu; không mất dòng hoặc đếm hai lần; người đọc biết kỳ nào, chi gì, vì sao tổng như vậy và chỗ nào cần kiểm tra. Có file mẫu tháng, quý, năm, kỳ tùy chọn kèm bảng đối chiếu tính độc lập.

## P6 — Hoàn thiện UI theo hệ thống

- [ ] P6.1 Rà từng màn theo luồng: tổng quan → chatbot/ảnh/voice → bản nháp → lịch sử → kế hoạch → tiết kiệm → báo cáo → cập nhật. Chụp hiện trạng trước khi sửa.
- [ ] P6.2 Thống nhất màu cam, font/cỡ chữ, khoảng cách, nút chính/phụ, ô nhập, chip danh mục/hashtag, loading/empty/error. Ưu tiên nút chạm tối thiểu 48 dp, chữ đủ tương phản, không dùng màu làm tín hiệu duy nhất.
- [ ] P6.3 Tiền VND có phân cách hàng nghìn khi nhập/xem, ngoại tệ giữ phần lẻ; parser và giá trị lưu không đổi theo hình thức trình bày. Kiểm tra số dài, số âm, font lớn và màn nhỏ.
- [ ] P6.4 Chatbot: khung chat rộng, ô nhập/bàn phím không che tin cuối, gợi ý ngắn nằm ngang; xử lý câu hỏi/voice/nhiều ý qua bản nháp và câu trả lời phù hợp. Tránh thêm lời “hỗ trợ AI” không cần thiết.
- [ ] P6.5 Hóa đơn: tổng tiền và việc cần làm dễ thấy; chi tiết mở rộng khi cần. Báo cáo: chọn kỳ → preview → tải/gửi; giải thích dài để ở `?`.
- [ ] P6.6 Kiểm tra tag “Di chuyển” không trũng nền, scroll ngang/dọc, bàn phím, trạng thái bấm/loading và TalkBack. Không đổi theme hoặc vị trí kế hoạch 1–4 tháng ngoài quyết định đã chốt.

Đạt khi: mỗi màn có ảnh trước/sau ở cùng kích thước, kiểm tra thao tác và font lớn, không che nội dung hoặc tăng bước nhập không cần thiết. Người dùng xem từng nhóm màn nhỏ, tránh thay toàn bộ giao diện một lần.

## Các buổi triển khai đề xuất

| Đợt | Phạm vi | Đầu ra trước khi chuyển tiếp |
|---|---|---|
| A | P1 đối chiếu phiên bản + spinner | Nguyên nhân hoặc bằng chứng còn thiếu, bản sửa nhỏ, ảnh/video |
| B | P2 schema/parser/validation | Hợp đồng dữ liệu, fixture có đáp án, kế hoạch migration nếu cần |
| C | P2 bản nháp/lưu/lịch sử | OCR thật → chỉnh → lưu → DB/số dư khớp |
| D | P3 đo và sửa điểm chậm/lưu trùng | Số đo trước/sau, retry/restart không trùng |
| E | P7 listener/parser + hàng chờ | Mẫu đã che → bản nháp đúng; quyền và riêng tư rõ |
| F | P7 tự lưu + backend idempotency | Thông báo lặp/restart/mất mạng vẫn chỉ một giao dịch |
| G | P4 phiên bản/chữ ký/Firebase | Nâng A → B trên điện thoại thật, hướng dẫn cập nhật |
| H | P5 dữ liệu/kỳ/preview | Bộ lọc và tổng hợp được đối chiếu độc lập |
| I | P5 Excel/PDF/email | File mẫu đã render/kiểm tra, chưa gửi thật khi chưa đồng ý |
| J | P6 rà toàn bộ + hồi quy | Bộ ảnh, checklist, APK có manifest và ghi chú phát hành |

Không ấn định mỗi đợt phải xong trong một ngày. Nếu còn lỗi số tiền, lưu trùng, mất dữ liệu hoặc chưa rõ chữ ký thì xử lý trước khi phát hành. Đợt nào cần điện thoại/PC/hóa đơn/tài khoản mới yêu cầu đúng thao tác ở thời điểm đó.

## Nhật ký và việc tiếp theo

### 29/09/2026 — Lập kế hoạch

- Đạt: rà nguồn spinner, OCR/items, lưu giao dịch/ảnh, báo cáo/kỳ, phiên bản/chữ ký; kiểm tra tài liệu Firebase chính thức.
- Chưa thử: PC chính; APK/hardware/4G hôm nay; OCR từng món; Firebase update; báo cáo mới. Không thay đổi mã nguồn chức năng hoặc database trong lượt lập kế hoạch.
- Đã nhận thay đổi phạm vi: hóa đơn cần từng món; giữ theme và cấu trúc kế hoạch đã được duyệt.
- Việc tiếp theo duy nhất: **P1.1 đối chiếu bản chạy PC chính với laptop**, sau đó tái hiện cùng ảnh/cùng luồng. Nếu PC không truy cập được, chuẩn bị bảng chẩn đoán và tái hiện laptop, ghi PC là CHƯA THỬ.

### 07/10/2026 — Bổ sung giao dịch từ thông báo ngân hàng

- Đạt: ghi thêm P7 gồm quyền Android, parser theo ngân hàng, ánh xạ ví, chế độ xem lại/tự lưu, hàng chờ offline, nguồn giao dịch, idempotency DB, hoàn tác, riêng tư và kiểm thử.
- Phát hiện mã nguồn: manifest hiện chưa có `NotificationListenerService`; chưa có parser hoặc dữ liệu cấu hình ngân hàng. Đây là hạng mục mới, chưa được coi là đã triển khai.
- Quyết định: tự lưu chỉ bật theo từng tài khoản sau khi người dùng chọn ví; ca mơ hồ luôn thành bản nháp. Không đọc SMS/OTP và không gửi nguyên văn thông báo sang AI.
- Thứ tự được cập nhật: làm P7 sau nền P3, trước Firebase/báo cáo; việc triển khai gần nhất vẫn là P1 để xử lý khác biệt hai máy trước.

### 07/10/2026 — Triển khai nền P7 trên Android

- Đạt: thêm `NotificationListenerService`, cầu nối React Native, bộ lọc package do người dùng chọn, loại OTP/quảng cáo, hàng chờ cục bộ giới hạn 100 mục và tách hàng chờ theo tài khoản đăng nhập. Đăng xuất sẽ tắt bộ đọc.
- Đạt: thêm màn “Giao dịch từ ngân hàng”, tìm app ngân hàng, chọn ví, danh mục tiền vào/ra và chế độ Duyệt trước/Tự động. Tự động chỉ lưu khi parser rõ, cấu hình đủ và tiền tệ khớp; còn lại giữ chờ kiểm tra.
- Đạt: backend chống ghi trùng bằng khóa duy nhất `(user_id, dedupe_key)` đã có trong DB; cùng fingerprint/payload trả giao dịch cũ, payload khác báo xung đột. Không cần reset DB hoặc quyền `ALTER TABLE`.
- Bằng chứng: TypeScript đạt; parser 5/5 ca; Kotlin release compile đạt; backend 44 suite/270 test đạt; APK release build đạt và cài đè giữ dữ liệu. API local và `https://api.quanlychitieucanhan.lol/health` đều HTTP 200.
- APK: `android/app/build/outputs/apk/release/app-release.apk`, đóng gói API `https://api.quanlychitieucanhan.lol`.
- Chưa thử: cấp quyền Notification Access và notification ngân hàng thật trên điện thoại; emulator sau khi cài phản hồi rất chậm và ADB offline trong lúc kiểm tra UI. Chưa có parser riêng từng ngân hàng/tài khoản che, trạng thái hàng chờ đầy đủ, hoàn tác, lần nhận gần nhất và báo cáo lọc nguồn.
- Việc tiếp: thử điện thoại thật với chế độ Duyệt trước, một thông báo tiền vào và một thông báo tiền ra đã che; đối chiếu bản nháp rồi mới bật Tự động.

Mẫu cập nhật mỗi buổi:

| Ngày/đợt | File/commit/APK | Đã làm | Test/bằng chứng | Đạt/lỗi/chưa thử | Việc tiếp |
|---|---|---|---|---|---|
| … | … | … | … | … | … |
