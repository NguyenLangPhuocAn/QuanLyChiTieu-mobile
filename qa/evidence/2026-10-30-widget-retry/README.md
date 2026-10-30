# Widget retry và lỗi đóng sau lưu — 30/10/2026

## Sửa gì

Thu/Chi trước đây sinh key mới mỗi lần xem trước. Khi đã ghi nhưng client lỗi cache/queue, Sửa lại và xác nhận có thể gửi yêu cầu mới. Giờ giữ cùng key suốt popup. Backend giữ kiểm tra xung đột nội dung. Sau SAVED/PENDING, khóa gửi kể cả handler cũ; bỏ sửa/xác nhận. Native đóng lỗi chỉ còn Đóng hoặc Back, truyền lại đúng kết quả.

## Tự động

5ca panel mới: Chi/Thu retry qua Sửa lại giữ nguyên payload/key; SAVED/PENDING ThuChi và SAVED VayNợ đóng lỗi không được POST lại (gồm gọi handler cũ). Trước sửa5ca này thất bại, thêm1ca Vay cũ timeout khởi tạo5s khi máy tải; không gọi timeout là lỗi nghiệp vụ. Lượt sau sửa còn1timeout. Lượt cuối timeout15s:16/16 test panel, thêm2ca hàng chờ, toàn13suite114/114 đạt111,453s. TypeScript/ESLint đạt. Các log thất bại giữ lại đúng nhãn. Không có native build hoặc backend test suite mới, backend helper chỉ node --check.

## Android source và database thật

Pixel3a API33 com.mobile.dev, API3302/MySQL QA8/wallet8. Chỉ Metro cấu hình qa/metro.widget-retry.cjs tại8083 mới thay native adapter bằng qa/homeWidget.close-once.ts; adapter từ chối lần đóng đầu sau SAVED/PENDING, không sửa POST hoặc kết quả server. Release config không nhập adapter này.

00–05 chuyển host8082→8083, khôi phục cùng phiên/cache. 06–13 nhập1250, chọn đủ danh mục Khác và Ví tiền mặt, ghi Widget retry QA. 14 xem trước −1.250 VND, chưa ghi. sql-before có tx27/28/29 và ví1025000. 15 bấm Xác nhận một lần: server tạo tx30, native close reject có chủ ý; UI hiện Đã lưu, không còn Sửa lại/Xác nhận. sql-accepted có đúng1tx mới1250, ví1023750. 16 bấm Đóng về launcher, sql-final giống accepted. Đây là QA lỗi được chèn có kiểm soát; không tuyên bố OEM tự phát sinh lỗi này.

17 là menu launcher mở nhầm bởi KEYCODE_MENU sau khi panel đã đóng, không tính là Dev Menu. 18 bỏ menu, 19 mở lại panel (frame loading),20 Dev Menu. Các frame sau trả về Metro8082 bình thường; cuối mở/hủy form không ghi thêm khoản. WiFi/data không đổi. Server3000/.env và QA3301/8081/3302/8082 giữ nguyên, không build/ký/phát hành APK/deploy/web.

## Giới hạn

Native chèn lỗi chỉ thử trực tiếp SAVED cho ThuChi; PENDING và VayNợ kiểm ở Jest. Chưa thử máy thật/OEM, AI OCR/giọng nói, VayNợ offline/trả nợ hoặc C2b. Ảnh là dữ liệu QA, không có JWT/mật khẩu/nonce. Log, SQL và SHA256SUMS kèm theo.


Bổ sung cùng đợt chống lặp30/10: Hàng chờ offline so sánh toàn bộ nội dung cùng mã (không phụ thuộc thứ tự khóa JSON). Nội dung khác báo409/OFFLINE_DRAFT_CONFLICT và giữ nguyên bản cũ; áp dụng giao dịch nhập tay và thông báo ngân hàng, gồm thay đổi món hóa đơn. Hai ca mới xác nhận không ghi đè hoặc gửi API.
