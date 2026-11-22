# QA Ví offline — 22/11/2026

## Môi trường

- Android emulator `emulator-5554`, ứng dụng tách riêng `com.mobile.dev`, mã nguồn local qua Metro.
- API và MySQL QA riêng tại `127.0.0.1:3304`; mô phỏng mất kết nối bằng cách dừng API QA trong khi Metro vẫn chạy. Không dùng hoặc thay backend production.
- Tài khoản QA và Ví QA local, không dùng dữ liệu người dùng thật. Bản debug cần Metro nên **chưa kiểm thử khởi động lạnh khi tắt cả Wi-Fi và dữ liệu di động trên APK standalone**.

## Bước thử và kết quả

1. Khi API QA chạy, mở màn Ví và tải một ví hiện có: [01](01-online-wallets.png).
2. Dừng API QA, mở lại màn Ví từ cache, nhập `QAOfflineWallet22`, số dư 0; xem trước trước khi lưu: [04](04-create-preview.png). Ví mới xuất hiện trên máy [06](06-local-wallet.png).
3. Force-stop rồi mở lại `com.mobile.dev` khi API vẫn tắt. Ví mới và Ví QA local còn trong danh sách: [08](08-restart-wallets.png).
4. Khởi động lại API QA. App hiện bản trên máy và trạng thái máy chủ chưa xác định; chọn bản máy [09](09-reconnect-review.png). Chỉ sau phản hồi thành công app báo đã sao lưu [10](10-sync-result.png). Mở lại màn Ví với API chạy thấy ví QA mới [11](11-server-wallet.png). Truy vấn QA xác nhận đúng một ví ID 16, có mã yêu cầu chống trùng.
5. Dừng API QA, đổi tên ví QA mới thành `QAOfflineRenamed22` sau bước kiểm tra [13](13-update-preview.png). Nối API, màn đối chiếu hiện tên cũ trên server và tên mới trên máy [15](15-update-review.png); chọn bản máy, app báo thành công [16](16-update-sync.png). DB QA xác nhận ID 16 có tên mới.
6. Dừng API QA, bấm xóa ví và xác nhận [18](18-delete-preview.png). Nối API, màn đối chiếu ghi rõ xóa ví [20](20-delete-review.png); chọn bản máy, app báo thành công [21](21-delete-sync.png). DB QA xác nhận ID 16 `is_active=false`, có `deleted_at`; Ví QA local và các giao dịch cũ không bị xóa. Vì ví QA mới đã được xóa mềm, tài khoản thử còn trạng thái một ví hoạt động.

## Kiểm tra mã và API

- Mobile: Jest 32/32 ca qua ba bộ hàng chờ Ví/giao dịch; TypeScript `--noEmit` và ESLint các file sửa đạt.
- Backend trong worktree QA: 10/10 ca Ví và TypeScript đạt. HTTP QA: tạo rồi gửi lại cùng mã trả cùng ID; cùng mã với số dư khác trả 409; sửa/xóa với bản gốc cũ trả 409; gửi lại sau khi số dư đổi vẫn không tạo ví thứ hai. Bài HTTP tự dọn bản ghi của nó; QA Android chỉ tạo một ví thử rồi xóa mềm.
- Migration Ví chỉ áp dụng trên schema QA. Backend production và APK phát hành không được cập nhật trong đợt này.

## Giới hạn cần thử tiếp

- Chưa chạy Android UI cho nhánh xung đột Ví hoặc phản hồi bị mất ngay sau khi server đã ghi; hai nhánh đã có kiểm tra HTTP/Jest.
- Chưa kiểm đổi tài khoản trong lúc Ví chờ; khóa lưu theo API và user ID đã có ca Jest.
- Chưa kiểm sửa số dư offline; UI chủ động chặn vì backend tạo giao dịch điều chỉnh tiền. Chuyển tiền giữa các ví vẫn cần mạng.
- API outage trên emulator không tương đương tắt cả Wi-Fi và dữ liệu di động trên điện thoại thật. Bản debug phải giữ Metro.

## SHA-256 ảnh gốc

```text
01-online-wallets.png 9c6b5e497ad007c86efc78ea1681fdd7de353cc27b4f9e643742471586c61b93
04-create-preview.png 8166b33f04e9b999314ae9f0f6d06f453e18fe4c22f917f21efb9
06-local-wallet.png 2c9d9cce739ad65c9d148931a2606ce5e1d1512761f3a80494fe382fea320644
08-restart-wallets.png f8b1db5c1becf6aa14f0f129005423d3fc878c137b53ce946e035a3254cd0183
09-reconnect-review.png b4f4d7a471e89d56b243294e2a80277bb84142b1f031ec20ac8b92cc213336c5
10-sync-result.png 5665dea7ec263e9952a763ac9d9eb254dd57d1d6414f5eedf4315ac1898bc530
11-server-wallet.png fc61b9978ab0f4104ad98c6912fa75efe3d672b88792230d6792d85d64f0c3de
13-update-preview.png f952519cfe39d2e33f5d62263f59e2d7d275d6f664930b5ceae6c9f2534b5bf6
15-update-review.png 29a5ce420be4e0ad4cd986d63e2b498cada1343a0bc3ca2532f72d128a56cd61
16-update-sync.png 6644752408c6b74d03c63bc7d53d2833fa5a151735837f1577068f355654d0f4
18-delete-preview.png d550561dc899ac0527b7e2460fd592e35a2a2396a45cf53c40cf012a23eb561b
20-delete-review.png 73a3d3bef28cdb32660bfc276c9dbddb95bcbbe2681c10ade92104e28753cff0
21-delete-sync.png dec6a95972d3352f6a8c0948abd90dcc7aa41911bd7c8f2dad0755d036b960cb
```
