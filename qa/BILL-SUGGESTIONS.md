# Gợi ý khoản chi lặp — 27/10/2026

Đợt B, phần phát hiện/gợi ý trong Tài khoản → Hóa đơn định kỳ. Đây là lịch dự kiến do người dùng xác nhận, không phải kết luận dịch vụ đang tự gia hạn hoặc còn nợ. Không thay detector cũ của dự báo/FinancialCenter; chưa hoàn thành phần kiểm lại liên kết thanh toán và tích hợp backup/dự báo.

## Hành vi đã triển khai

- Chỉ đọc lịch sử khi bấm Kiểm tra. GET khoản chi thông thường trong1.096ngày gần nhất,100dòng/trang, tối đa20trang. Ghi rõ số đã tải/tổng; vượt giới hạn hiện cảnh báo chưa đầy đủ. Lỗi giữa chừng không giả làm kết quả đầy đủ. Tổng thay đổi hoặc ID lặp giữa các trang buộc kiểm tra lại.
- Ít nhất3lần chi ở ngày khác nhau, chu kỳ tuần/tháng/năm liên tiếp. Dùng ngày lịch, xử lý ngày31/tháng ngắn và29/2. Sai số lịch tối đa1ngày với tuần,3ngày với tháng/năm; cả chuỗi phải khớp ngày gốc. Khoản quá cũ hoặc tương lai không làm bằng chứng.
- Nhóm theo tên dịch vụ đã chuẩn hóa và tiền tệ; giữ số gói, không gộp theo danh mục/bậc10.000 hoặc ví. Số tiền được giữ nguyên, hiển thị min–max nếu biến thiên. Không trộn VND/USD; VND cần nguyên đồng, tiền có tối đa2chữ số thập phân.
- Chỉ bỏ mã tham chiếu có nhãn và tháng/kỳ ở cuối nội dung, không xóa bừa số gói. Tên quá chung, chuyển ví, hoàn tiền, thu/vay/nợ/tiết kiệm bị loại. Nhiều khoản cùng ngày hoặc cùng tháng không đủ để tự phân biệt nhiều gói nên không suy ra lịch.
- Xem từng bằng chứng: ngày, số tiền, ID và nội dung gốc. Mặc định thu gọn; mở thêm6dòng/lần. Chỉ hiện5gợi ý/lượt, có xem thêm. Không dùng AI hoặc gửi lịch sử sang dịch vụ khác.
- Theo dõi mở form có thể sửa; Save mở xác nhận có tên, tiền, chu kỳ và ngày theo dõi. Hủy form/hộp thoại không tạo lịch. Không tạo/sửa/xóa giao dịch, không chọn ví hoặc đánh dấu các khoản cũ đã trả.
- Ngày gốc giữ nhịp lịch; startDate bắt đầu từ kỳ dự kiến hôm nay hoặc sắp tới. Không thêm lại các kỳ cũ thành quá hạn. JS/native đều loại due date trước startDate; lịch cũ không có trường này giữ hành vi cũ.
- Tạo lịch và trạng thái TRACKED lưu trong cùng một lần ghi book, hàng đợi theo tài khoản/backend. Cùng một gợi ý xác nhận lại chỉ có một lịch. Lựa chọn còn giữ theo khóa nguồn khi người dùng sửa tên lịch.
- Không định kỳ lưu IGNORED; Để sau ẩn7ngày. Có Đã ẩn/Hiện lại để đổi ý. Không tự tạo lịch khi hết thời hạn ẩn. Lịch đã theo dõi không được đề xuất lại chỉ vì mở màn hình/tìm lại.
- Sau khi lưu một lịch, phần kết quả thu gọn để lịch vừa tạo dễ thấy; mở lại kết quả đã tải không gọi thêm API. Hủy form vẫn giữ kết quả/bằng chứng đang xem. Bấm Kiểm tra liên tiếp không phát hai lượt tìm; Dừng/rời màn/đổi tài khoản bỏ kết quả muộn và không tải trang tiếp. Request HTTP đang bay chưa có abort vật lý.
- Book schema1 có thêm trường tùy chọn startDate/suggestions, không thay dữ liệu cũ. Dữ liệu lựa chọn hỏng được giữ nguyên, khóa ghi và báo lỗi; không tự xóa để có giao diện rỗng. Native mirror vẫn không chứa tên/tiền/nội dung giao dịch.

## Kiểm thử

- Jest96/96 qua11bộ, gồm24ca mới (15domain/storage,4history loader,5UI flow) và72hồi quy. Có ngày31, năm nhuận bắt đầu bằng tháng ngắn, tuần, ngoại tệ/biến thiên, cùng nhà cung cấp khác gói, ID lặp, giao dịch không phù hợp, stale pattern, startDate, đồng thời/lỗi lưu/corrupt data, xem bằng chứng/hủy/xác nhận, lựa chọn lưu bền và callback muộn. Native/API trong Jest dùng mock.
- JVM planner11/11, thêm ca không nhắc các kỳ trước startDate nhưng vẫn nhắc trước3ngày của kỳ đầu tiên. Debug riêng com.mobile.dev build/install đạt2phút47giây/284tasks; không ký/phát hành production. MetroQA3/3, TypeScript/ESLint file đổi đạt; kết quả cuối ghi trong evidence.
- Nest/MySQL QA thật: tạo thêm tài khoản/ví QA riêng trong schema thử đã có,9khoản chi giả của Internet/Video/Music, số dư8.848.000đ. Không thay2giao dịch/ví QA cũ hoặc database production. Script prepare chỉ cho schema localhost có tiền tố QA, không migrate/reset hoặc seed tài khoản đang dùng.
- Đã thử đăng xuất tài khoản QA cũ, native bỏ owner/mirror/alarm; đăng nhập tài khoản QA mới chỉ thấy book rỗng, không thấy lịch cũ. Đọc đủ9/9giao dịch, gợi ý đúng3nhóm; xem3bằng chứng Internet, tiền240.000–260.000đ, kỳ tới31/10.
- Hủy form và hủy xác nhận giữ native billCount0. Bỏ qua Video và để sau Music vẫn giữ sau khi đưa app về nền, dừng tiến trình cached và mở lại. Khôi phục Video rồi xác nhận tạo lịch thứ hai: native có2lịch/2startDate, handled0, không tạo giao dịch. Kết quả thu gọn sau lưu; mở lại xem được kết quả cũ. Các kỳ chỉ bắt đầu từ31/10 và05/11, không thêm kỳ quá hạn của tháng7–9.
- Bật nhắc trong QA: Android đặt alarm thật, màn hình hiện lần tới20:00 ngày28/10 (trước3ngày của Internet31/10). Đây là kiểm tra đặt lịch, không phải chờ đến28/10 để chứng minh giao thông báo. Cuối buổi đã tắt nhắc, alarmfalse. SQL cuối giữ9khoản chi/số dư8.848.000đ và2khoản chi/số dư6.590.000đ của tài khoản QA cũ. Có75PNG gốc, XML và chứng cứ an toàn trong README của đợt QA.

Ảnh gốc/XML, bằng chứng native/SQL/HTTP và SHA-256 nằm trong `qa/evidence/2026-10-27-bill-suggestions/`. Không coi ảnh chờ, lỗi dump hoặc Fast Refresh của debug là ca chức năng đạt.

## Còn phải làm

- Kiểm lại liên kết khi giao dịch thanh toán gốc sửa/xóa (đợt B phần2); hiện PAID vẫn là snapshot local.
- Chu kỳ quý, kỳ bị thiếu, tự gộp tên dịch vụ biến đổi và nhiều gói không có định danh chưa được hỗ trợ. Không suy kỳ quý thành tháng hoặc khẳng định chi thói quen là nghĩa vụ. Các trường hợp này dùng nhập lịch thủ công.
- Cảnh báo tăng giá/nghi trùng kỳ/tổng hợp thuê bao, backup/sync book và nối lịch tiền/chi an toàn còn thuộc đợt C. Detector và quyết định cũ của dự báo chưa được di chuyển sang book mới.
- Chưa nghiệm thu máy vật lý, lịch sử lớn/nhiều trang và ngoại tệ trên thiết bị, reboot/OEM dài ngày hoặc Gemini/ngân hàng/mic/OCR/4G trong batch này. Không lấy QA local hoặc test mock thay bằng chứng các phần đó.
