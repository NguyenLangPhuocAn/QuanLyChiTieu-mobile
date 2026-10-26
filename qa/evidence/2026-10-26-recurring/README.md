# Kiểm thử Android local — 26/10/2026

## Môi trường và phạm vi

Đã thao tác trên **Android emulator**, không phải điện thoại vật lý: Pixel 3a API33, 1080×2220, mật độ 440dpi. App `com.mobile.dev` 1.2.3-dev/code8 chạy source qua Metro riêng `qa/metro.local.cjs`. App release `com.mobile` 1.2.3/code8 vẫn giữ nguyên.

Đăng nhập thật qua UI vào backend Nest local/MySQL **QA riêng**. Schema `nova_qa_bills_20261026_1792991677270` mới, tài khoản/ví/giao dịch đều là fixture. Không dùng mock HTTP trong luồng Android này. Không thay .env, DNS, tunnel, production DB hoặc server ổn định. AI/cổng thanh toán/email tắt trong tiến trình QA.

Trọng tâm buổi này là hóa đơn định kỳ và smoke đăng nhập/tổng quan/ẩn hiện số dư. **Chưa nghiệm thu toàn app**, chưa thử Gemini/ngân hàng thật/OCR ảnh cafe/mic/4G ở buổi này. P3 còn nhắc hạn, đồng bộ/backup và tích hợp dự báo.

## Kết quả từng luồng

| Luồng | Kết quả quan sát | Ảnh gốc |
|---|---|---|
| Đăng nhập và ví | Đăng nhập bằng form, số dư QA hiện 6.590.000đ | [11](11-login-result.png), [12](12-dashboard-balance.png) |
| Lối vào hóa đơn | Tài khoản → Hóa đơn định kỳ, ban đầu rỗng | [14](14-account-menu.png), [15](15-bills-empty.png) |
| Lịch cố định | Tạo tiền nhà 3.000.000đ ngày 31/10; tháng ngắn về 30/11, tháng 12 trở lại 31 | [25](25-form-review.png), [27](27-month-end-periods.png), [28](28-december-restored-31.png) |
| Xem trước và hủy | Khoản thực tế 3.100.000đ khác dự kiến có cảnh báo; hủy vẫn chưa trả | [30](30-payment-confirmation.png), [32](32-cancel-keeps-pending.png) |
| Xác nhận thanh toán | Chỉ sau xác nhận mới chuyển sang Đã xử lý | [34](34-payment-preview.png), [36](36-paid-period.png) |
| Tạm dừng/tiếp tục | Tạm dừng ẩn kỳ chưa trả; bật lại hiện các kỳ cũ | [38](38-paused.png), [39](39-paused-hides-pending.png), [42](42-resumed-pending.png) |
| Bỏ qua/mở lại | Chỉ tác động kỳ chọn, không làm lệch các kỳ tiếp theo | [43](43-skip-preview.png), [45](45-skipped-history.png), [47](47-period-reopened.png) |
| Lịch biến thiên | Tạo tiền điện 250.000–400.000đ, chọn khoản đã ghi 310.000đ | [55](55-variable-review.png), [57](57-variable-due-today.png), [65](65-variable-payment-preview.png), [66](66-variable-linked.png) |
| Chống dùng trùng | Chọn lại giao dịch tiền nhà cho kỳ điện bị chặn, picker còn dùng được | [62](62-duplicate-payment-preview.png), [63](63-duplicate-blocked.png), [64](64-picker-after-block.png) |
| Xóa lịch | Lịch bị archive nhưng liên kết đã trả vẫn có trong lịch sử | [68](68-archive-preview.png), [70](70-archive-keeps-history.png) |
| Mở lại app | Force-stop/mở lại giữ phiên đăng nhập, lịch và hai kỳ đã trả | [72](72-restored-session.png), [75](75-bills-restored.png), [76](76-history-survives-relaunch.png) |
| Cỡ chữ lớn | Hệ thống 1,3: màn lịch và picker đọc được, nút truy cập được; sau thử đã trả 1,0 | [82](82-bills-large-font.png), [84](84-large-font-picker-loaded.png) |
| Refresh token | Trước sửa picker tự đóng; sau sửa vẫn mở và tải xong. SQL ghi nhận 4 rotation trong buổi | [58 trước](58-variable-payment-picker.png), [59 lỗi](59-payment-load-result.png), [61 sau](61-payment-picker-fixed.png), [84 sau](84-large-font-picker-loaded.png) |
| Mất mạng và phục hồi | Dừng đúng QA server: hiện lỗi và thử lại; bật lại rồi bấm thử, trả đủ hai giao dịch | [93 lỗi đúng](93-offline-before-retry.png), [94 đang tải](94-retry-after-reconnect.png), [95 đã phục hồi](95-retry-restored-payments.png) |
| Số dư và dữ liệu | Hai ID/khoản tiền/nội dung và số dư không đổi sau liên kết/hủy/chặn trùng/xóa lịch | [SQL trước](database-before.json), [SQL sau](database-after.json) |

## Lỗi tìm thấy và đã sửa

1. **Picker/form mất khi token được refresh:** React key có token nên remount nội dung. Đổi key theo tài khoản/backend; vẫn reset khi đổi tài khoản. Hai hồi quy mới thất bại trước sửa và đạt sau sửa, đã kiểm lại với API thật.
2. **Nút đóng editor nhỏ, dính cạnh tiêu đề:** tăng vùng chạm 44dp, đẩy sang phải. [Trước](16-create-bill-form.png) / [sau](49-create-variable-bill.png).
3. **Lỗi mạng hiện kèm lời báo không có giao dịch:** chỉ hiển thị trạng thái rỗng khi không có lỗi. [Trước](87-network-error-retry.png) / [sau](93-offline-before-retry.png), thử lại thực tế [đạt](95-retry-restored-payments.png).

## Kiểm tra tự động và build

- Jest **50/50, 4 bộ**, 21,771 giây: 31 domain/storage + 11 UI + 8 App/financialPlanning. Provider trong Jest là mock; không coi đây là kiểm thử Gemini/mạng thật.
- Node test Metro **2/2**; TypeScript `--noEmit`, ESLint source/test đổi `--max-warnings 0`, `node --check` các script QA đạt.
- Gradle `:app:installDebug -PQA_ISOLATED_APP=true`: **BUILD SUCCESSFUL, 4 phút 14 giây**, 277 tasks, cài bản debug riêng. Đây không phải bản phát hành production.
- [HTTP thật](api-preflight.json): health200, login201, profile200, wallets200, transactions200. SQL trước/sau đúng 2 giao dịch, ví 6.590.000đ; không ghi thêm tiền.
- Build native lần đầu thiếu RAM; giới hạn worker/heap và chạy native build 2 luồng rồi hoàn tất. Metro cold compilation rất chậm trên máy này; các ảnh màn trắng ban đầu là bằng chứng quá trình chờ, không phải luồng đã đạt. Không suy ra thời gian mở APK release/4G từ debug Metro.

## Bộ ảnh và cách tái hiện

**97 PNG gốc** chụp bằng ADB screencap, mỗi ảnh có XML UI tương ứng; không chỉnh ảnh, không dùng ảnh AI/mô phỏng. [Mở danh sách từng ảnh](SCREENSHOTS.md). Manifest SHA-256 ghi trong [screenshots.json](screenshots.json).

- 00–05: khởi động/Metro đang biên dịch; 10: đang đăng nhập, mật khẩu được che. Không coi các ảnh chờ là kết quả thành công.
- 58/59: lỗi picker trước sửa; 87: lỗi thông báo mạng trước sửa. Giữ các ảnh này để đối chiếu với ảnh sau sửa.
- 71/78: khởi động lại chưa tải xong; 77: hệ thống đổi cỡ chữ đưa app về launcher. Phiên sau đó đã phục hồi ở 72/79.
- 48/60/88/91 là trạng thái Fast Refresh sau sửa source; không dùng làm chứng cứ giữ form qua reload source. Kiểm tra giữ picker qua **refresh token** riêng ở 61/84.

Tái hiện theo [hướng dẫn local](../../LOCAL-ANDROID.md) và `backend/scripts/RECURRING-BILLS-QA.md`. Không đưa session.json, mật khẩu, JWT, .env hoặc tài khoản cá nhân vào Git. Cần thử tiếp trên điện thoại thật: quyền/OEM/ngân hàng, AI, mic/OCR, offline nhiều trang, đổi tài khoản khi đang tải và hiệu năng Wi-Fi/4G.

Kết thúc buổi: đã dừng đúng backend QA và cây tiến trình Metro QA do buổi này tạo, force-stop riêng com.mobile.dev và trả font hệ thống về1,0. Giữ schema QA và session riêng bị ignore để tái hiện; không xóa dữ liệu hoặc dừng server khác. Muốn thử lại local cần khởi động runner/Metro theo hướng dẫn.
