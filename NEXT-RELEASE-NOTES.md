# Ghi chú thay đổi — bản kế tiếp (nháp)

Sau [bản 1.2.9](RELEASE-1.2.9.md):

- Gọn trang Tài khoản → Dữ liệu: bỏ bốn khối Widget, Bản dữ liệu trên máy, Đồng bộ lịch giữa thiết bị và Sao lưu/khôi phục lịch; các thao tác giao dịch chờ, Backup cá nhân, nhập/xuất Excel vẫn ở trang này. Bỏ nền màu quanh nút quay lại và ô màu trống đối diện trên các header liên quan. Đã chụp [ảnh Android QA local](qa/evidence/2026-11-14-account-cleanup/README.md); chưa phát hành APK.
- Giao dịch Thu/Chi có thể sửa và xóa từ Lịch sử khi mất kết nối; app giữ thay đổi trên máy và chưa đổi số dư server cho tới lúc xác nhận đồng bộ.
- Khi có mạng lại, app hiển thị từng giao dịch trên máy cạnh bản máy chủ. Người dùng chọn ghi bản máy, giữ bản máy chủ hoặc để sau; bỏ bản máy cần xác nhận lần hai. Máy chủ chặn ghi đè nếu giao dịch đã thay đổi trong lúc offline; có bước so sánh và xử lý xung đột tại Dữ liệu và xuất nhập.
- Kiểm tra trên Android QA local: sửa, xóa, giữ bản máy chủ và xung đột đều đạt; [biên bản và ảnh](qa/evidence/2026-11-13-offline-transactions/README.md). Đã thử tạo khoản Chi 6.000 đ khi mất API, xem trước sau nối lại và chọn bản máy; QA server chỉ ghi một giao dịch, ví trừ đúng 6.000 đ ([ảnh và số liệu](qa/evidence/2026-11-13-offline-create-qa/README.md)). Sửa câu báo “tự đồng bộ” thành yêu cầu xem lại/xác nhận; trang Dữ liệu nhận thay đổi hàng chờ ngay khi đồng bộ xong. Chưa thử mạng di động thật hoặc cold start khi offline; chưa phát hành APK hoặc thay backend production.
- Chạm danh mục trên widget màn hình chính mở bộ chọn cùng kiểu với form trong app: danh sách có icon và ô tìm theo tên. Tìm kiếm chấp nhận cả cách gõ không dấu.
- Danh mục Chi và Thu được chọn, ghi nhớ riêng trên widget. Chọn xong quay về launcher và hiện tên ngay; vẫn có lựa chọn Chưa phân loại. Việc chọn danh mục không ghi giao dịch.
- Bộ chọn dùng danh mục đã lưu trên máy khi backend tạm ngắt. Trên giả lập QA đã thử lọc `Di`, chọn `Di chuyển`/`Lương`, rồi tắt riêng backend QA và chọn `Thưởng`; widget cập nhật đúng, không mất danh mục Chi. [Ảnh và bước thử](qa/evidence/2026-11-12-widget-category/README.md).
- Android QA local build thành công; 101 bộ kiểm thử, 661/661 ca đạt; TypeScript và ESLint đạt. Chưa phát hành APK mới hoặc thay trang web tải APK trong đợt này.

Cần thử thêm trên điện thoại thật: tốc độ mở bộ chọn khi app chưa chạy và icon danh mục chưa từng tải lúc mất mạng.
