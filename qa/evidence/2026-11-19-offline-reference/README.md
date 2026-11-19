# QA Thu/Chi khi ngắt API — 19/11/2026

## Môi trường

- Android emulator `emulator-5554`, app QA `com.mobile.dev`, mã JS local từ Metro `qa/metro.local.cjs` ở cổng 8081. API và cơ sở dữ liệu QA riêng ở cổng 3303; không dùng tài khoản hoặc dữ liệu cá nhân.
- Tạo tình huống mất kết nối bằng cách tháo `adb reverse tcp:3303`, rồi `am force-stop` và mở lại app. Metro vẫn chạy, vì bản debug không phải APK độc lập. Nối lại bằng `adb reverse tcp:3303 tcp:3303`.

## Bước thử và kết quả

1. Đăng nhập tài khoản QA khi API hoạt động ([03](03-login-result.png)). Tháo reverse API, force-stop/mở app: Tổng quan hiện “Chế độ trên máy” và giữ tài khoản cũ ([04](04-offline-reopen.png)). Form Thu/Chi vẫn có danh mục Chi `Chi offline QA` và `Ví QA local` đã tải ([05](05-offline-form.png)); nhập Chi 4.157 đ ([07](07-save-ready.png)).
2. Bấm lưu khi API không tới được: app báo **bản nháp chưa làm thay đổi số dư** ([11](11-preview.png)). Force-stop/mở lại khi vẫn ngắt API, trang Dữ liệu còn khoản chờ −4.157 đ ([18](18-pending-draft.png)). Lịch sử chỉ hiện giao dịch đã tải và cảnh báo phạm vi cache; bản nháp được xem/sửa/xóa tại trang Dữ liệu.
3. Nối API QA và bấm nút đồng bộ trước khi sửa mã: hộp cũ chỉ báo tổng số giao dịch ([19](19-sync-confirm.png)); sau xác nhận, hàng chờ trống và báo ghi 1 ([20](20-sync-review.png)). Tổng chi tăng từ 13.123 đ lên 17.280 đ ([21](21-prep-review-test.png)). Đây là lỗi bỏ qua bước xem từng khoản ở nút đồng bộ thủ công.
4. Sửa nút thủ công dùng màn xem từng giao dịch, có ba lựa chọn. Ngắt API, tạo Chi 2.391 đ không ghi chú ([26](26-corrected-amount.png), [28](28-second-draft.png)), force-stop/mở lại, trang Dữ liệu còn khoản chờ ([31](31-second-pending.png)). Nối API và bấm đồng bộ: màn so sánh hiển thị đúng Chi −2.391 đ cùng trạng thái máy chủ chưa có ([32](32-manual-review.png)). Chọn “Để sau” giữ khoản chờ ([33](33-defer.png)); mở lại và chọn “Dùng thay đổi trên máy” thì hàng chờ trống.
5. Trong lần đồng bộ thủ công đó, hộp đối chiếu tự động bật lại với dữ liệu cũ dù hàng chờ đã trống ([34](34-manual-sync-result.png)). Đã sửa phiên tự động để bỏ qua khoản đang `SYNCING` và đọc lại hàng chờ trước khi hiện hộp. Ca tự động mô phỏng hàng chờ bị xóa giữa hai lần đọc đạt. Mở lại app với hàng chờ trống không còn hộp cũ ([35](35-reopen-no-stale-review.png)); tình huống tranh chấp trong đúng thời điểm ghi chưa được lặp lại bằng thao tác Android sau sửa.
6. Truy vấn **chỉ đọc** cơ sở dữ liệu QA sau hai lần ghi: đúng một giao dịch −4.157 đ (ID 56, ghi chú `QA_offline_19_Nov`) và một giao dịch −2.391 đ (ID 57); ví QA từ 9.666.877 đ còn 9.660.329 đ, đúng mức giảm 6.548 đ. Tổng chi tháng trong app là 19.671 đ ([35](35-reopen-no-stale-review.png)).

## Kiểm tra mã và giới hạn

- `DataManagementOfflineReview`, `OfflineSessionSync`, `MainScreenDrafts`: 47/47 ca đạt; TypeScript `--noEmit`, ESLint file sửa và Prettier đạt.
- Chưa kiểm cold start khi tắt cả Wi-Fi/dữ liệu trên bản APK độc lập hoặc điện thoại thật, vì chưa chốt bản cập nhật. Chưa lặp sửa/xóa, widget, ảnh hóa đơn và đổi tài khoản trong lượt QA này; xem biên bản 13/11 và 16/11 cho bằng chứng trước đó.
- Chỉ giao dịch Thu/Chi có hàng chờ ghi. Tài khoản đã đăng nhập, ví, danh mục và quy tắc thông minh dùng bản đã tải để hỗ trợ nhập; không tự tạo các mục này khi offline.

## SHA-256 ảnh gốc

| Ảnh | SHA-256 |
| --- | --- |
| 03-login-result.png | `9e523ddd23a5e726cc50cc170031d686ac22e1b9cbd82ea493a56b3e1ebfd39e` |
| 04-offline-reopen.png | `2e3ec3d2ccde4c12a13c2f9dacf865a14f278542dbf88f1c23d586157d95f320` |
| 05-offline-form.png | `5382b1a3e54553717f2b3f4a101b7d8f2ffad49b05ff3a833a84af7e62a7e18a` |
| 07-save-ready.png | `03b21dfbb079a8b191be7c7826268bfa2a4d25b2d43f55ee11cf088c02501d7b` |
| 11-preview.png | `0e635522160eac38c18624e2ac85b34082afb8d2d0e9fe558510055e89065ed1` |
| 18-pending-draft.png | `4746462fd47707904711d344ba6bb6ab365318a2aef15350e0365d35c96bc18b` |
| 19-sync-confirm.png | `0b002a40d557409da136da3938ff226b60f72f4ca7a80a31f1b98661428ec53f` |
| 20-sync-review.png | `1dcc39c0371f7f852ed57fa8895915699f3188901e0afd8283cdea211adb606c` |
| 21-prep-review-test.png | `550d78e134e74d4cb9af77b41fb705ba902089cbd33de9271340bd9dbef42719` |
| 26-corrected-amount.png | `d59afed04414495a27a90eeadefef99855d00deb2fcf1f95b627b84a22cdef4b` |
| 28-second-draft.png | `defa52234ed0c9ab72837d204b6b5d4baa754d834baf852f4b48bfa318ccc12c` |
| 31-second-pending.png | `3505246cff59c926d27f33ae83c88cb69c0c81d0f7f08548f2ac047022f11d5d` |
| 32-manual-review.png | `46377c4bca752a5eefbfc36d4411f6c34bc94cd4ae01c958fa71526cb19f15e3` |
| 33-defer.png | `08733bf99bdaaeacacbedfb7cf5a7098fbfea0d8d8c90365bd81ec52fa2e07a5` |
| 34-manual-sync-result.png | `698bb11703ce0fb7e6aa996b5aa56eb0a49cc58d8ca688a6a32b6041e14011a9` |
| 35-reopen-no-stale-review.png | `f0cec0528c6a2acf9f5990128a6f21a97e7d8a0fe92e89dc57c2876e99f23287` |
