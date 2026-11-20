# QA Android: bản nháp đã thử gửi nhưng chưa rõ kết quả — 20/11/2026

## Cách thử và kết quả

- App QA `com.mobile.dev` chạy mã local qua Metro trên `emulator-5554`; API/MySQL QA riêng trên cổng 3303. Tháo ADB reverse API để tạo bản nháp **Chi 1.749 đ** trong khi mất kết nối.
- Nối API để hiện màn chọn dữ liệu, sau đó tháo reverse **trước khi** chọn dùng bản trên máy. Lần gửi không được xác nhận và bản nháp còn trong hàng chờ. [Trạng thái bản nháp](08-draft-state.png) ghi “Đã thử gửi · cần đối chiếu máy chủ”.
- Bấm [Sửa](09-edit-blocked.png) hoặc [Xóa](10-delete-blocked.png) đều hiện lý do phải đối chiếu trước; không mở form sửa hoặc xóa hàng chờ. Máy chủ có thể đã nhận một yêu cầu mà điện thoại không nhận được phản hồi.
- Nối API lại, [xem từng khoản](11-review.png), chọn giữ dữ liệu máy chủ và [xác nhận bỏ bản nháp](12-discard-confirmation.png). DB QA không có giao dịch `-1749`; ví QA vẫn **9.650.846 đ**.
- Trong lượt này còn tái hiện một lỗi giao diện: sau khi xóa bản nháp qua trang Dữ liệu, **màn chọn tự động cũ vẫn nổi** dù danh sách phía sau đã trống: [ảnh trước sửa](13-after-discard.png). Mã đã sửa để màn tự động theo dõi thay đổi của hàng chờ và đóng lựa chọn cũ. Ca Jest xác nhận màn đang mở đóng khi màn khác xóa bản nháp. Sau force-stop và mở lại app, [trang chủ không còn màn cũ](14-after-relaunch.png). **Chưa lặp trực tiếp trên Android đúng thời điểm hai màn chọn cùng mở sau bản sửa**; đây là giới hạn của bằng chứng UI.

## Kiểm tra mã

- Hàng chờ lưu trạng thái máy chủ từ chối rõ ràng riêng với kết quả chưa xác định. Khoản đã thử gửi với kết quả chưa rõ không được sửa nội dung hoặc xóa bản nháp; gửi lại vẫn dùng nguyên mã chống trùng. Khoản bị máy chủ từ chối xác định (ví dụ lỗi dữ liệu 400) vẫn sửa được.
- Nếu app bị tắt khi bản nháp ghi `SYNCING`, lần mở sau vẫn hiện bước xem lại; chỉ trạng thái đang gửi **thực sự trong phiên hiện tại** mới trì hoãn màn hỏi. Ca này được kiểm bằng Jest, chưa bằng Android force-stop đúng thời điểm gửi.
- 33/33 ca tập trung của hàng chờ, màn Dữ liệu và tự đối chiếu đạt; TypeScript, ESLint và Prettier đạt.

## Giới hạn

- Đây là Android emulator với mã debug/Metro, không phải điện thoại thật hoặc bản APK standalone tắt cả Wi-Fi/4G.
- Ca này ngắt API trước lúc bấm gửi; bài thử máy chủ đã ghi nhưng điện thoại mất phản hồi nằm trong [QA trước](../2026-11-20-offline-lost-ack/README.md). Cả hai trường hợp được bảo vệ theo cùng nguyên tắc: kết quả không rõ thì không cho sửa/xóa bản nháp trước khi đối chiếu.
- Backend production và APK phát hành không được thay đổi.

## SHA-256 ảnh gốc

```text
08-draft-state.png 920C362934F30C15FB31C1DCC6CA4908AF3F6C2ECD02BFEC340A1F990B0FE2C3
09-edit-blocked.png 26EEFEA0EA6CFACD86833AF165C2A3033450D9453837015FF3CC5A7E4224DB28
10-delete-blocked.png 86CF00F697B0021BFB89E57BD62F6D5E3AEDEF7A2F4AA83D4AB47F39BBDF6719
11-review.png 7A299EA831C49A05D11EF03C029A9867B0A0C4E985186F42701CA5A4B7CD1E1C
12-discard-confirmation.png 6E572542C0A073C9F15A7166E32D74EDA833C3B4094090C815F26307B70FDE09
13-after-discard.png D3B646E48060EA5EAB028E42BC6DBC645FBD146EA98CA3D1BB8DEC8314C6F71E
14-after-relaunch.png 55B18CB9BAE6D0F90087FBE21CC066A4230ED5B05D564DE1F6D1FFB79AC1D329
```
