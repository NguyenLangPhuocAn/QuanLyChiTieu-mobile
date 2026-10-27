# Đối chiếu liên kết thanh toán — 28/10/2026

Đợt B phần2 có source và QA local. Tài khoản → Hóa đơn định kỳ → Đã xử lý → Kiểm tra liên kết. Không đánh dấu toàn P3/plan hoàn tất và chưa có trong APK phát hành.

## Hành vi

- Đổi nhãn lịch sử thành Đã liên kết, hiện thông tin đã lưu và trạng thái chưa đối chiếu. Không gọi API tự động lúc mở màn. Bấm Kiểm tra liên kết đọc đúng ID đã lưu, mỗi lượt tối đa100ID, không quét toàn bộ lịch sử hoặc gọi từng ID riêng.
- Phân biệt khớp, thay đổi tiền/ngày/nội dung, không còn truy cập được nguồn, hoặc không còn là khoản chi thông thường cùng tiền tệ trong31ngày trước/sau kỳ. Không truy cập được không chứng minh chắc chắn đã xóa: ví/khả năng truy cập cũng có thể đổi.
- Lỗi mạng, endpoint chưa triển khai (404), phản hồi thiếu/sai/trùng ID đều là chưa đối chiếu được. Không biến lỗi thành kết luận đã xóa hoặc tự bỏ liên kết. Một lượt lỗi không công bố kết quả từng phần như thể đã kiểm tra đủ.
- Kết quả chỉ trong RAM cho lần xem. Dừng/chuyển tab/rời màn/đổi tài khoản hoặc ra nền bỏ kết quả/xác nhận cũ và ngừng tải batch tiếp. Không abort vật lý HTTP đang bay; vẫn bỏ phản hồi muộn. Token refresh cùng tài khoản không tự tải thêm.
- Cập nhật liên kết hiển thị giá trị cũ/mới và cần xác nhận. Trước ghi, đọc lại đúng giao dịch, bắt nguồn thay đổi thêm/biến mất/không phù hợp. Ghi local tuần tự, so snapshot kỳ hiện tại để không ghi đè một lần cập nhật/mở lại khác. Giữ cùng ID, kỳ, khóa chống dùng trùng và lịch; không đổi số tiền dự kiến của lịch hoặc giao dịch trong backend.
- Nguồn lỗi/đổi/xóa vẫn giữ liên kết và trạng thái xử lý; không tự nhắc lại hoặc ghi nợ mới. Người dùng Mở lại kỳ và xác nhận mới gỡ trạng thái/reservation. Hộp thoại nêu rõ kỳ chưa trả có thể được nhắc lại theo cài đặt. Mở lại PAID kiểm snapshot cũ, chống callback gỡ nhầm liên kết đã đổi. Dữ liệu book schema1 cũ không phải migrate.
- Tên/ví/danh mục thông thường không nằm trong snapshot tiền/ngày/nội dung nên không được báo là mọi thay đổi đều bị phát hiện. Đổi loại/tiền tệ/nhóm dòng tiền không phù hợp được báo cần kiểm tra. Không tự suy khoản chưa trả khi source không còn.

## API backend mới

`GET /transactions/linked-payments?ids=12,13`, yêu cầu JWT. Từ1đến100ID nguyên dương khác nhau trong miền SQL Int, không nhận biểu thức hoặc ID trùng. Trả requestedIds, data và missingIds, đầy đủ cho đúng danh sách đã hỏi.

Một truy vấn SQL tham số hóa join ví theo user_id lấy đúng ID. Không lọc Chi/tiền tệ/ngày để vẫn trả nguồn đã đổi sang Thu/ngoại tệ/vay nợ. ID không thuộc tài khoản và ID không còn cùng trả missing; không lộ dữ liệu tài khoản khác. Payload chỉ có trường cần đối chiếu, không ảnh hóa đơn, tag, quy đổi/tỷ giá hoặc dữ liệu ngân hàng. Không cần migration.

Endpoint chỉ được chạy trong Nest QA local trong đợt này, chưa deploy hoặc restart server ổn định. Mobile gặp server cũ báo chưa kiểm tra được, giữ nguyên dữ liệu.

## Kiểm thử

- Mobile Jest109/109 qua13bộ, gồm13ca mới (7domain/service,6UI flow) và96hồi quy. Có phân loại,101ID chia100+1, phản hồi thiếu/trùng/sai, hủy muộn, nguồn đổi trước xác nhận, race với mở lại, lỗi lưu, xem trước/hủy/xác nhận/double tap, API cũ/lỗi mạng, đổi tài khoản và ra nền. API/native trong Jest là mock.
- Backend23/23 qua2bộ:4ca mới controller/ID/query/thiếu quyền truy cập và19hồi quy TransactionsService. Kiểm truy vấn có điều kiện chủ sở hữu, trả nguồn đã đổi loại/nhóm, không trả ảnh/tags. SQL không thay bằng mock để khẳng định quyền thật; có HTTP/MySQL QA riêng bên dưới.
- TypeScript và ESLint file đổi cả hai repo đạt; MetroQA3/3, syntax QA helpers đạt. Không chạy toàn bộ test repo backend. Không đổi native nên không build/cài lại Android hôm nay; dùng com.mobile.dev đã cài27/10 và tải source Metro mới. JVM11/11/build debug ngày27/10 là mốc cũ, không tính là chạy lại28/10.
- Android13/API33/Nest/MySQL thật: đăng nhập tài khoản QA mới, tạo lịch và liên kết qua UI. Đối chiếu310k khớp, sửa nguồn330k/nội dung mới → cảnh báo; hủy giữ cũ, xác nhận đổi snapshot. Ra nền/mở lại bỏ kết quả cũ. Dừng đúng QA server → báo chưa đối chiếu/giữ snapshot, bật lại và thử lại khớp. Xóa nguồn → báo không truy cập, hủy mở lại vẫn handled1, xác nhận mới handled0/Chưa trả. Có64PNG gốc/XML và chứng cứ SQL/native/HTTP trong [biên bản](evidence/2026-10-28-payment-links/README.md).
- SQL tài khoản QA mới: ban đầu1giao dịch310k/ví690k; sửa nguồn330k → ví670k; kiểm tra/cập nhật liên kết giữ1giao dịch/ví670k. Xóa nguồn →0giao dịch/ví1triệu; mở lại giữ0/ví1triệu. Hai fixture QA trước vẫn9giao dịch/8.848.000đ và2giao dịch/6.590.000đ. Mọi mutation trong lượt thử chỉ tác động fixture mới, không dùng dữ liệu cá nhân.

## Còn lại

- C: tăng giá/nghi trùng kỳ/tổng hợp các khoản nhỏ, backup/sync book và nối lịch tiền/chi an toàn. Chu kỳ quý/thiếu kỳ/gói không rõ định danh vẫn nhập tay.
- Endpoint chưa triển khai production; chưa nghiệm thu máy vật lý/nhiều batch trên Android/mạng4G/OEM. Ngân hàng/Gemini/mic/OCR không nằm trong batch này. Chưa hỗ trợ trả nhiều lần hoặc một giao dịch trả nhiều kỳ.
- Không tự theo dõi thay đổi nguồn ở nền. Muốn đối chiếu mới phải bấm kiểm tra; không coi kết quả phiên trước là xác minh hiện tại.
- Không khóa giao dịch backend qua bước xác nhận local hoặc tạo giao dịch xuyên hai nơi. Nguồn vẫn có thể thay đổi ngay sau phản hồi đọc cuối; lần đối chiếu tiếp theo mới phát hiện thay đổi đó.
