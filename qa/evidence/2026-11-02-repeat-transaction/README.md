# Kiểm tra nhập lại giao dịch — 02/11/2026

## Môi trường và dữ liệu
- Android13 Pixel3a API33, com.mobile.dev từ source local/Metro8081, API QA3303 và MySQL schema QA riêng. Không dùng APK production để nghiệm thu source.
- QA8, ví8. Nguồn thử tx31: Chi79.000đ, Ăn uống, ghi chú Ca phe nhap lai QA, hashtag qa; món Bac xiu (2)94.000đ. Đây là dữ liệu tổng hợp, không phải lượt OCR/model thật.
- Tạo fixture bằng API với khóa riêng; giữ baseline cũ. Không ghi tiền lên database production.

## Các bước và kết quả
1. 00–13: ảnh khởi động/chẩn đoán sau máy reset. Metro chưa sẵn sàng, có lượt login lỗi mạng và màn trắng/chuyển màn. Không tính các ảnh này là đạt. Khởi động lại Metro với2workers, chờ bundle; đã bỏ toàn bộ log chẩn đoán tạm khỏi source.
2. 14–18: Welcome → đăng nhập QA → Tổng quan tải đúng. 19–21 mở/đóng form Sửa từ Lịch sử, không lưu.
3. 22–26: Tổng quan → Giao dịch mới nhất → Chi tiết. Nút Nhập lại và tùy chọn kèm món hiện đúng; mặc định không kèm món.
4. 27–33: bật Kèm chi tiết món, Nhập lại. 28 là frame chuyển màn,29 mới là form sẵn sàng. Ngày02/11,79.000đ, Ăn uống, ví tiền mặt944.750đ được chọn, ghi chú/qa và món94.000 đúng. Ảnh hóa đơn trống, không mang ảnh/mã nguồn cũ. Số món và chênh lệch15.000 hiển thị.
5. 34–37: Lưu mở kiểm tra tiền/ví/danh mục/ngày/note/1món. Sửa lại quay về form, chưa ghi tiền. sql-preview.json giống sql-before.json. Nút native sau dismiss vẫn có content-desc busy dù enabled=true; thao tác chạm theo vị trí đã quan sát mở lại xác nhận được, không phải request còn chạy.
6. 38 là trạng thái đang lưu;39 mới là kết quả cập nhật Tổng quan:2khoản79.000đ. SQL xác nhận chỉ thêm tx32, balance944.750→865.750đ; nguồn31 và toàn bộ hàng cũ giữ nguyên. Món được kèm, receipt_image=null.
7. Hai replay API song song cùng khóa/nội dung trả lại32, không tạo thêm hoặc đổi số dư (replay.json). Lượt đầu helper replay dùng hashtag QA khác qa do client đã chuẩn hóa nên server trả409; sửa helper cho đúng payload và đạt, không nới quy tắc chống trùng.

## Kiểm thử tự động
- Mobile624/624 qua99bộ; TypeScript noEmit và ESLint file đổi đạt. Bao gồm mặc định bỏ món/opt-in, scope tài khoản/backend, loại ví/danh mục/currency, loại trừ vay-tiết kiệm, kiểm tra trước ghi, retry/click lặp, offline cùng khóa và hủy xác nhận sau nền/đóng/đổi phiên.
- Backend377/377 qua52bộ trước triển khai; source nghiệp vụ backend của đợt C2b đã kiểm ở biên bản31/10. Helper repeat dùng API/MySQL thật, không mock tiền.
- Lệnh helper final chạy quá sớm lần đầu chưa có dữ liệu; sau API hoàn tất và sửa đúng hashtag replay đạt. Không coi lần thất bại là pass.

## Giới hạn
Chưa nghiệm thu điện thoại vật lý/OEM/4G, model đọc ảnh hoặc nhận tiếng Việt thật trong đợt này. Backup/Excel mẫu và nhớ bộ lọc xuất chưa được làm thêm. Ảnh/XML gốc được giữ; SHA256SUMS kiểm nội dung và bản Git stage. Nội dung chỉ là tài khoản QA giả.
