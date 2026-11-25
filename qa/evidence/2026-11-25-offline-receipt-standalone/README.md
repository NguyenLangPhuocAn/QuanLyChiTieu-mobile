# Ảnh hóa đơn khi Thu/Chi offline — Android giả lập 25/11/2026

## Môi trường

- Android API 33, app debug local `com.mobile.dev` có JS bundle tại source đang kiểm tra; backend QA `127.0.0.1:3303` và database loopback tách riêng. Không dùng backend production hay APK phát hành.
- Tắt Wi-Fi, dữ liệu di động và `adb reverse` trước khi mở form. Ảnh hóa đơn là ảnh tự tạo `Tiệm bánh Hoa Mai`, tổng 18.000đ; không dùng chứng từ người thật.

## Các bước và kết quả

1. Chọn Chi 18.000đ, ghi chú `Banh mi sang`, chọn ảnh trong thư viện. [Ảnh trên form](18-image-selected-below.png), [menu chọn nguồn](14-pick-source.png).
2. Phiên bản đầu buổi thử lưu ngay khi bấm `Lưu giao dịch`, không hỏi xác nhận. Đây là lỗi được phát hiện trong ca này. Ảnh được chép vào `files/pending-receipts/1/` (PNG, 17.062 byte); database QA chưa có giao dịch, ví ở mức 9.611.912đ.
3. Force-stop và mở lại khi radio vẫn tắt: bản nháp/ảnh còn trên máy. [Màn offline sau mở lại](22-offline-restart.png).
4. Bật mạng và nối lại backend QA: màn đối chiếu hiện khoản Chi 18.000đ và ghi rõ ảnh ở máy. [Xem trước khi đồng bộ](24-reconnect-review.png). Chọn dùng bản trên máy: database có đúng một giao dịch id 66, ví còn 9.593.912đ. Ảnh trên server là PNG 17.062 byte, HTTP 200; ảnh chờ trên máy được dọn sau xác nhận. [Ảnh trong giao dịch đã đồng bộ](30-synced-receipt-visible.png).

## Giới hạn

- Bước xác nhận trước **lần lưu đầu tiên** được thêm sau khi phát hiện lỗi; ca ảnh này chạy với mã cũ trước sửa. Ca Android độc lập với mã mới nằm ở [biên bản xem trước](../2026-11-25-offline-preview-standalone/README.md); kiểm thử mã cũng kiểm tra hộp xem trước khi giao dịch có ảnh.
- Đây là giả lập, chưa xác nhận trên điện thoại thật hoặc mạng di động của người dùng. Không thử OCR offline; ảnh được chọn thủ công.
