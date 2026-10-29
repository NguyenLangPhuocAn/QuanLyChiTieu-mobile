# Widget và ngoại tuyến — 29/10/2026

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
