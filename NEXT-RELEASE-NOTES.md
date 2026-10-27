# Bản kế tiếp — bản nháp, chưa phát hành

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
