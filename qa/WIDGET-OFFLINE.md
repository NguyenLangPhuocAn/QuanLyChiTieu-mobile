# Widget và ngoại tuyến — 29/10/2026

## Luồng sử dụng

Đăng nhập online một lần và tải ví/danh mục. Sau đó mất mạng vẫn mở được hồ sơ trên máy và ghi thu/chi thường vào hàng chờ. Không phải đăng nhập mới bằng mật khẩu offline và không cấp quyền API bằng hồ sơ local. Khi có mạng/app mở lại, xác thực server rồi POST cùng client_request_id (hoặc source_ref ngân hàng), server idempotency xử lý trùng và cập nhật DB/số dư; chỉ sau xác nhận mới xóa bản nháp.

Android: Tài khoản → Dữ liệu và xuất nhập → Thêm widget Nova. Hoặc nhấn giữ launcher → Widget → Nova · Thu chi nhanh. Thu/Chi mở form, không tự ghi tiền; form có ví mặc định để kiểm tra/chọn lại, khi đang có form chưa lưu sẽ giữ form cũ và báo. Widget hiển thị thu/chi thường của hôm nay trong dữ liệu đã tải, theo tiền tệ tài khoản, không phải số dư ngân hàng. Bấm Hiện tiền để bỏ che; đăng xuất/đổi tài khoản xóa dữ liệu hiển thị của widget. Snapshot quá ngày báo chưa cập nhật.

## Quy tắc dữ liệu

- Hồ sơ có backend và tài khoản của lần đăng nhập đã xác nhận, chỉ dùng để vào giao diện/cache. Đăng nhập lần đầu, Google, hồ sơ cần hoàn thiện/đổi mật khẩu vẫn cần mạng. Khi API xác nhận401/403 thì đóng phiên; lỗi mạng/5xx giữ hồ sơ. Không lưu mật khẩu đăng nhập vào cache.
- Bản nháp lưu trước khi đóng form. Lỗi lưu máy giữ form, không báo thành công. Không đổi số dư theo dự đoán; widget ghi riêng số bản chờ. API lỗi mạng hoặc xác thực dừng lượt gửi đầu tiên để tránh lặp hàng loạt.400cần người dùng sửa. Phiên/account/backend đổi không gửi tiếp bản nháp cũ.
- Draft cũ thiếu backend phải kiểm tra/thử lại trong Dữ liệu và xuất nhập. Hàng chờ hỏng được giữ nguyên, chặn ghi đè. Snapshot/cache cũ thiếu backend không được dùng như dữ liệu của server mới.
- Đồng bộ khi có mạng trong app hoặc khi trở lại app. Không có Android WorkManager/headless sync sau force-stop. Không phát biểu là luôn đồng bộ dù app bị tắt.
- Vay/nợ/tạo ví/danh mục/AI/OCR/Google vẫn cần mạng. Ảnh hóa đơn ngoại tuyến chưa được sao chép bền/xếp lịch upload; form báo thêm lại ảnh sau. Sao lưu vẫn là file thường theo yêu cầu.

## Thiết kế native

RemoteViews/AppWidgetProvider và PendingIntent bất biến, chỉ mở MainActivity tường minh. Snapshot native chỉ có tổng tiền và số chờ, không chứa token/tên/ghi chú. Widget xử lý toggle khi appJS không chạy; nhận mạng từ ConnectivityManager, không polling. Scope/account xác thực trước khi chuyển URL sang form; URL không mang số tiền hoặc wallet.

Nguồn kỹ thuật: [Android app widgets](https://developer.android.com/develop/ui/views/appwidgets), [cập nhật widget](https://developer.android.com/develop/ui/views/appwidgets/advanced). Tham khảo chức năng nhập nhanh từ [Money Lover](https://moneylover.zendesk.com/hc/en-us/sections/34632713589401-New-features); giao diện dùng theme Nova hiện có.

## Kiểm thử

Trạng thái thực tế và PNG/XML nằm trong evidence/2026-10-29-widget-offline/README.md. Chỉ đếm kiểm thử đã chạy. ServerQA3301/schema/tài khoản riêng; server ổn định3000 không đổi, không chạy workflow release/web.
