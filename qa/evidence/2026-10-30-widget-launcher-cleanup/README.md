# Dọn widget thử trên launcher — 30/10/2026

Người dùng thấy hai khung Nova đầy đủ sau buổi test. Đây là hai widget QA đã ghim từ các lượt thử trước, mini nằm ở trang launcher khác. Việc thêm provider mini không tự thay widget đầy đủ mà launcher đã lưu. Lượt này dọn bố cục emulator, không đổi mã ứng dụng, APK hoặc backend.

- 00: trạng thái người dùng phản ánh, hai widget đầy đủ trên trang launcher.
- Dùng thao tác giữ/kéo tới Remove của launcher để xóa hai widget thử. Lượt motionevent rời đầu tiên chỉ mở chế độ resize, chưa xóa; sau đó dùng gesture draganddrop chuẩn và launcher báo Item removed cho từng widget.
- 08: Home về trang mặc định, còn icon N+ của Nova Mini1×1. Các ảnh trung gian/thao tác vuốt sang Discover được giữ local, không đưa vào Git vì không phải dữ liệu QA của ứng dụng.
- 09: chạm mini sau khi xóa các bản đầy đủ vẫn mở đúng khung nhập, không tự lưu giao dịch.10: Hủy trở về trang chỉ có mini.

Không chạy lại bộ101test vì không đổi source. Không phát hành APK/web, không sửa dữ liệu tiền hoặc restart server. Bản Mini vẫn có thể chọn từ danh sách widget hoặc trong Dữ liệu và xuất nhập; người dùng tự thêm bản đầy đủ nếu cần.
