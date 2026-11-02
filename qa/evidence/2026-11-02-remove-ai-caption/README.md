# Bỏ dòng “Quyền dùng AI” khỏi form — Android QA, 02/11/2026

- Mở app QA `com.mobile.dev` từ source local/Metro, bấm **Thêm giao dịch**. `01-add-transaction.png` và XML gốc xác nhận dòng “Quyền dùng AI” cùng nút vô hình tương ứng không còn trong form. Hướng dẫn bấm chuông/lắc và các loại giao dịch vẫn hiển thị.
- Mở **Thông báo → Cài đặt thông báo**, cuộn xuống. `02-settings.png`/XML xác nhận có lối đặt lại quyền đọc thông báo bằng AI ở phần cài đặt. Bấm vào cho hộp xác nhận `03-confirm.png`/XML; Hủy, không đặt lại lựa chọn QA.
- Không nhập hoặc lưu giao dịch, không bấm đọc thông báo ngân hàng và không đổi quyền AI trong demo.
- Jest: 34/34 ca qua MainScreenDrafts, bankAiConsent và NotificationSettingsAiConsent; TypeScript noEmit, ESLint hai màn và test đạt. Riêng lượt trước khi chuyển nút: MainScreenDrafts/useLatestBankNotification 46/46 đạt. Chưa build/phát hành APK, đổi backend hoặc website.
