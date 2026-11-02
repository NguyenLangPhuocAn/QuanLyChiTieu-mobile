# Bỏ bước hỏi AI riêng — Android local, 02–03/11/2026

- `01-form.png` và XML gốc: form thêm giao dịch không còn dòng Quyền dùng AI; gợi ý bấm chuông/lắc để AI đọc thông báo ngân hàng mới nhất.
- Người dùng chủ động bấm chuông/lắc; Android vẫn yêu cầu quyền truy cập thông báo lần đầu. App gửi chữ thông báo liên quan qua máy chủ/Gemini, chỉ điền bản nháp Thu/Chi/số tiền/nội dung để người dùng kiểm tra và chọn ví trước khi lưu.
- Jest kiểm tra gọi AI trực tiếp khi có thông báo hợp lệ, không hiện hộp hỏi riêng, không gửi số dư, không tự ghi giao dịch. Luồng Gemini/thông báo thật trên điện thoại vật lý chưa được thử trong đợt này.
- `qa/evidence/2026-11-02-remove-ai-caption/` là trạng thái trung gian trước yêu cầu mới của người dùng và đã được thay thế; mục đặt lại quyền trong Cài đặt thông báo không còn ở mã hiện tại.
