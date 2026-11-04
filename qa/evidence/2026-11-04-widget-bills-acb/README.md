# Android QA — widget và lịch hóa đơn, 04/11/2026

Thiết bị: Android emulator API 33, ứng dụng `com.mobile.dev` build từ source local với `-PQA_ISOLATED_APP=true`, Metro 8081 và tài khoản/database QA riêng. Ảnh gốc bên dưới chỉ có dữ liệu thử. Bản production, web tải APK và server đang phục vụ người dùng không được thay đổi trong lượt này.

## Các bước và kết quả

1. Tài khoản QA BASIC có một ví `QAWallet` và không có danh mục. Widget đầy đủ trên launcher hiển thị **Chưa phân loại** thay vì ô chọn rỗng. Chọn Thu, nhập 12.000 đ; mở bản xem trước `01-widget-income-preview.png`. Trước khi xác nhận, API QA chưa có giao dịch.
2. Xác nhận lưu: API QA có đúng một giao dịch `INCOME`, 12.000 đ, `category_id=null`. Chọn Chi, nhập 2.000 đ; bản xem trước `02-widget-expense-preview.png`. Xác nhận lưu: API QA có đúng hai giao dịch, thêm một `EXPENSE` 2.000 đ `category_id=null`. Widget sau làm mới `03-widget-final.png` hiện Đã thu 12.000 đ và Đã chi 2.000 đ. Không có lần ghi tiền tự động trước khi bấm xác nhận.
3. Trong Hóa đơn định kỳ, mở Lịch mới. Trường danh mục chỉ ghi **Danh mục**, tài khoản không có danh mục được thông báo lịch sẽ để chưa phân loại (`04-bill-editor-category.png`). Tạo lịch thử `QAInternet`, hằng tháng 15.000 đ. Lịch xuất hiện ở Chưa trả (`05-bill-created.png`); tạo lịch không tạo giao dịch thu/chi.

## ACB và giới hạn

- Backend dùng mẫu ACB ONE đã ẩn danh từ ảnh người dùng: `(VND) + 752,790` trước câu số dư. Kiểm thử bộ lọc xác nhận chỉ giữ khoản Thu 752.790 đ, loại số tài khoản, số dư, thời gian và mã giao dịch. Gemini thật trên backend local ban đầu trả `evidence: "+ 752,790"`; bước kiểm tra cũ từ chối. Sau sửa, hai lượt Gemini thật (mẫu có và không có dấu tiếng Việt) đều trả `READY/INCOME/752790/VND`, chỉ là bản nháp, không ghi tiền. Test có Gemini mock xác nhận cả trường hợp đảo vị trí VND và chặn bằng chứng có thêm chữ số.
- Tài khoản QA này không có danh mục nên chưa thể chụp danh sách chọn danh mục có dữ liệu trên emulator. Bộ chọn có danh mục đã được kiểm bằng Jest. Đây chưa phải thử thông báo ACB thật trên điện thoại; quyền Android và luồng qua server production cần kiểm sau khi gộp bản cập nhật backend/app.

## SHA-256 ảnh gốc

```text
C0E0849049AA3C227C76470B321601CD5B98BA68948D845877317CE26EC5C0E4  01-widget-income-preview.png
F4F079EA0AF0331DE94449740325557F015CADA1D41309EB621EB3616780917E  02-widget-expense-preview.png
2FC3FEA8A897E080261F6F5060B006853B4FB7E36BF25E51CF5D329B77A5A15D  03-widget-final.png
2ACD8E47582757595EDD19790CAB6DBA5993D9F3FB0B8E6D643FD44B9B560F5C  04-bill-editor-category.png
F80B5D2FF69A76F7CF935FB78A26E7C31228B88C27A39837A955BD4CE1BFBC3C  05-bill-created.png
```
