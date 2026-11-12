# Ghi chú thay đổi — bản kế tiếp (nháp)

Sau [bản 1.2.9](RELEASE-1.2.9.md):

- Chạm danh mục trên widget màn hình chính mở bộ chọn cùng kiểu với form trong app: danh sách có icon và ô tìm theo tên. Tìm kiếm chấp nhận cả cách gõ không dấu.
- Danh mục Chi và Thu được chọn, ghi nhớ riêng trên widget. Chọn xong quay về launcher và hiện tên ngay; vẫn có lựa chọn Chưa phân loại. Việc chọn danh mục không ghi giao dịch.
- Bộ chọn dùng danh mục đã lưu trên máy khi backend tạm ngắt. Trên giả lập QA đã thử lọc `Di`, chọn `Di chuyển`/`Lương`, rồi tắt riêng backend QA và chọn `Thưởng`; widget cập nhật đúng, không mất danh mục Chi. [Ảnh và bước thử](qa/evidence/2026-11-12-widget-category/README.md).
- Android QA local build thành công; 101 bộ kiểm thử, 661/661 ca đạt; TypeScript và ESLint đạt. Chưa phát hành APK mới hoặc thay trang web tải APK trong đợt này.

Cần thử thêm trên điện thoại thật: tốc độ mở bộ chọn khi app chưa chạy và icon danh mục chưa từng tải lúc mất mạng.
