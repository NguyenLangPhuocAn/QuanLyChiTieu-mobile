# Xem trước Thu/Chi trước khi lưu — Android giả lập 25/11/2026

## Môi trường

- Android API 33, app debug local `com.mobile.dev` cài từ source mới. Backend QA và database loopback tách riêng; không đổi backend production.
- Tắt Wi-Fi, dữ liệu di động và `adb reverse`; force-stop/mở lại app khi vẫn offline. Dữ liệu thử: Chi 7.000đ, ghi chú `Nuoc cam`.

## Các bước và kết quả

1. Mở form, nhập số tiền/ghi chú. Bấm `Lưu giao dịch` chỉ hiện [hộp kiểm tra](15-review.png) với số tiền, ví, danh mục, ngày, ghi chú. Database QA vẫn có 0 giao dịch `Nuoc cam`, ví 9.593.912đ.
2. Bấm `Sửa lại`: [form vẫn giữ ghi chú](16-cancel-review.png), chưa ghi tiền. Bấm lưu lần nữa rồi xác nhận: [bản nháp offline được giữ](18-saved-offline.png); database vẫn 0 giao dịch, ví vẫn 9.593.912đ.
3. Force-stop và mở lại khi radio tắt: [app mở offline](20-offline-loaded.png), bản nháp chưa bị gửi.
4. Nối lại API: [màn so sánh](21-reconnect.png) hiện Chi 7.000đ và lựa chọn bản máy/bản chủ/để sau. Chọn dùng bản trên máy: [thông báo thành công](22-sync-confirm.png). Database QA có đúng một giao dịch id 67, số tiền -7.000đ, ví còn 9.586.912đ, giảm đúng một lần.

## Giới hạn

- Ca này dùng giao dịch không đính ảnh. Ca ảnh hóa đơn và đồng bộ nằm ở [biên bản riêng](../2026-11-25-offline-receipt-standalone/README.md). Kết hợp với kiểm thử mã cho trường hợp có ảnh; chưa lặp cả hai trong một ca Android sau bản sửa.
- Chưa thử trên điện thoại thật, đổi tài khoản hoặc xung đột do thiết bị khác cập nhật trong lượt này.
