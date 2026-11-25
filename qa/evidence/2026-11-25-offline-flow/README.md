# Kiểm thử Thu/Chi khi mất mạng — Android giả lập, 25/11/2026

## Môi trường

- Android API 33, AVD `NovaOffline33`, ứng dụng phát triển tách riêng `com.mobile.dev` với JS bundle nhúng để mở lạnh khi mất mạng. Đây không phải APK phát hành hay điện thoại thật.
- API ở cổng local 3303 và database QA riêng `nova_qa_bills_20261026_1792991677270`; không đổi backend production. Khi thử offline, tắt Wi-Fi và dữ liệu di động bằng `svc`, đồng thời bỏ `adb reverse tcp:3303`.
- Ảnh PNG là ảnh chụp gốc từ giả lập; XML cùng tên là cây giao diện tại lúc chụp. Tài khoản và ví dùng dữ liệu giả của database QA có từ trước.

## Các bước và kết quả

| Bước | Bằng chứng | Kết quả |
| --- | --- | --- |
| Tắt mạng, force-stop rồi mở lại | `04-offline-cold-start.png` | App mở từ bundle nhúng, hiển thị dữ liệu đã tải và trạng thái trên máy. |
| Thêm khoản Chi 12.000đ, “Ca phe sang” | `05-offline-entry.png`, `06-expense-preview.png`, `07-pending-offline.png` | Xem trước và lưu nháp trên máy; chưa trừ số dư server. |
| Force-stop/mở lại khi vẫn mất mạng | `08-pending-after-restart.png` | Khoản Chi vẫn còn trong hàng chờ. |
| Nối mạng, chọn bản trên máy | `10-sync-review.png`, `12-history-after-sync.png` | Có hộp đối chiếu. Database QA có đúng một giao dịch 12.000đ, số dư từ 9.624.912đ xuống 9.612.912đ. |
| Tạo khoản Thu 5.000đ “Ban sach cu”; sau đó chọn giữ server | `13-income-entry.png`, `14-income-pending.png`, `15-income-reconnect.png`, `16-server-choice-confirm.png`, `18-no-pending.png` | Phát hiện và sửa lỗi nhảy từ Thu về Chi khi cache chỉ có danh mục Chi. Hộp đối chiếu tự mở khi có mạng; xác nhận bỏ bản máy. Database QA không có giao dịch Thu này, số dư giữ nguyên. |
| Mất mạng giữa phiên sau khi đã tải lịch sử | `19-edit-preview.png`, `27-offline-edit-review.png`, `29-edit-stored.png` | Trước sửa mã, nút Lưu thử API rồi báo lỗi. Sau sửa, nút Lưu nhận biết mất kết nối, hỏi trước khi giữ bản sửa 13.000đ trên máy. Database QA lúc đó vẫn là 12.000đ. |
| Nối mạng và chọn bản sửa trên máy | `30-reconnected-edit.png`, `31-edit-local-choice.png`, `32-history-after-edit-sync.png` | Đối chiếu 13.000đ trên máy với 12.000đ máy chủ. Database QA còn đúng một giao dịch id 65, -13.000đ; số dư 9.611.912đ, giảm đúng 1.000đ. |
| Mất mạng giữa phiên rồi xóa giao dịch, force-stop/mở lại | `36-delete-review.png`, `38-delete-hidden.png`, `41-delete-cold-start.png`, `42-delete-persisted.png` | Có xác nhận xóa trên máy; giao dịch ẩn khỏi lịch sử cache, thay đổi vẫn chờ sau khởi động lạnh. |
| Nối mạng và chọn giữ server | `44-delete-review-reconnect.png`, `45-keep-server-confirm.png`, `47-server-kept-final.png` | Đối chiếu bản đã xóa trên máy với bản máy chủ; xác nhận bỏ thay đổi. Database QA vẫn có đúng một giao dịch -13.000đ, số dư 9.611.912đ. |

## Giới hạn cần thử tiếp

- Chưa thử trên điện thoại thật, widget với ảnh hóa đơn, đổi tài khoản khi còn hàng chờ, hoặc xung đột do thiết bị khác sửa cùng giao dịch.
- Nếu mạng đứt sau khi yêu cầu đã gửi, kết quả server có thể chưa xác định; ca này không được chuyển âm thầm thành bản nháp mới. Cần thử mất phản hồi đúng thời điểm server ghi và kiểm tra đối chiếu trước khi gửi lại.
- Các màn khác trong ma trận offline có kiểm thử riêng; lượt này chỉ xác nhận Thu/Chi trên giả lập.
