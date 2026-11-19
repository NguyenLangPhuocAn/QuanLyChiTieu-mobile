# QA Android: mất phản hồi sau khi máy chủ ghi giao dịch — 20/11/2026

## Môi trường và phạm vi

- Emulator `emulator-5554`, app QA `com.mobile.dev` chạy mã mobile local qua Metro. API và MySQL QA tách biệt trên cổng 3303; production không được thay đổi.
- Một proxy QA trên cổng 3304 chủ động ngắt kết nối **sau khi** API trả `201` cho `POST /transactions` đầu tiên. Thiết bị đi qua ADB reverse. Đây là mô phỏng mất phản hồi, không phải sự cố mạng ngẫu nhiên.
- Bản debug cần Metro. Ca này chưa chứng minh mở app độc lập khi tắt cả Wi-Fi và dữ liệu di động trên điện thoại thật.

## Các bước và kết quả

1. Nạp tài khoản QA, ví và danh mục khi API còn hoạt động: [trang chủ](01-home.png), [form](02-form.png).
2. Tháo ADB reverse API, tạo khoản **Chi 2.863 đ** trên form. App báo đã giữ bản nháp; số dư chưa đổi: [ảnh](06-saved-offline.png).
3. Nối API qua proxy. Khi app đang mở, màn xem từng thay đổi tự hiện; chưa ghi tiền cho đến khi chọn bản máy: [ảnh](07-choice-before-drop.png).
4. Chọn dùng thay đổi trên máy. API QA ghi giao dịch và trả `201`, proxy bỏ phản hồi về điện thoại. App giữ khoản chờ, không coi lần gửi này là hoàn tất: [ảnh](08-after-dropped-ack.png). Log proxy ghi `DROPPED_TRANSACTION_ACK_AFTER_201`.
5. Nối thẳng lại API. Màn lựa chọn xuất hiện lần nữa: [ảnh](09-retry-choice.png). Chọn bản máy lần nữa. [Trang chủ sau gửi lại](10-after-retry.png) vẫn có Tổng chi tháng **29.154 đ**, không tăng lần thứ hai. Truy vấn đọc DB QA có đúng **một** dòng giao dịch ID 60, số tiền `-2863`, ngày 20/11/2026; ví QA ID 1 là **9.650.846 đ**. Trước ca này, Tổng chi tháng là 26.291 đ.
6. Thử lựa chọn còn lại với bản nháp **Chi 1.247 đ**: lưu khi API ngắt [ảnh](11-offline-saved-for-server-choice.png), nối API và thấy câu mô tả chính xác hơn “Chưa xác định đã nhận khoản này” [ảnh](12-review-updated-copy.png). Chọn giữ dữ liệu máy chủ, app hỏi xác nhận bỏ bản nháp [ảnh](13-discard-confirmation.png). Sau xác nhận, về trang chủ [ảnh](14-after-discard.png). DB QA **không** có giao dịch `-1247`; ví vẫn **9.650.846 đ**, Tổng chi tháng vẫn **29.154 đ**.

## Kiểm tra API chống trùng riêng

Gửi một khoản Chi **3.149 đ** với cùng `client_request_id` hai lần tới API QA: cả hai phản hồi là `201` và cùng ID 59; DB QA có một dòng và ví chỉ giảm một lần. Gửi cùng mã với số tiền 3.150 đ bị từ chối `409`. Ca này kiểm tra hàng rào backend riêng; không tính là ảnh Android.

## Giới hạn còn lại

- Chưa lặp bài thử trên điện thoại thật, bản standalone không có Metro, hoặc khi thiết bị tắt cả Wi-Fi/4G.
- Chưa thử giao dịch có ảnh hóa đơn trong ca mất phản hồi. Hiện ảnh bị chặn khi lưu offline để tránh hiểu nhầm đã lưu.
- Chưa lặp sửa/xóa và widget trong cùng kịch bản rớt phản hồi; bằng chứng các luồng khác nằm ở các biên bản QA trước.

## SHA-256 ảnh gốc

```text
01-home.png C6E7ED4FB78CE6039FA4F122907C6140E71499E2EBFF82E319A11318962333C8
02-form.png 9EF1DA12D17A2DE536B60E95AA22CD98485B0B80417A1A510B113E5E10735E91
06-saved-offline.png B4BFEA9A8CBF252CC62EC4D3064A3B61192ED1A9B8F6984376581A460D99252D
07-choice-before-drop.png 4B38A3B7FB3E02BD30EE888C448A640181FA683E72AB51757B6764FFFD02580C
08-after-dropped-ack.png D708D15558C1AD8D6172C2EBB40B10BBDDA6812F79E06A33103C78B0450D4C92
09-retry-choice.png E00434AB943E130AC8310B8323F741D098647CA2461ED470DF8AB973693A8FAA
10-after-retry.png 68FF3483B69C6C38B2C5EABB120E814A4DF6F715A0994FA7BC1A7AD867463CEA
11-offline-saved-for-server-choice.png F52A59D14BBC7177509A05DD9CB46B78C714B56208B06ABD2E98B0B7A054E2F6
12-review-updated-copy.png AD07AC49D6227F968670418E5A5A0B0B55F85D7AF2224861960EF315A88421B8
13-discard-confirmation.png 92956F53A7D7023AE971E485DD10B47048087179F8A092CD06A96FF61B499C94
14-after-discard.png ED5C66ACFAC22EC89D34FE914C5250857A58B48E5EF2E07DC655FF3BB47F2485
```
