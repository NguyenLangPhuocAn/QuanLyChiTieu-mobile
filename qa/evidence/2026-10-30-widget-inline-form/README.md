# Form widget: lịch Android và danh sách ví — 30/10/2026

## Thay đổi

- Ngày giao dịch/ngày hẹn trả mở lịch Android. Hiển thị ngày/tháng/năm, chọn ngày theo múi giờ local; Hủy lịch giữ nguyên ngày. Ngày hẹn trả có nút xóa nhỏ cùng hàng.
- Danh sách ví hiện sẵn hai cột, chọn trực tiếp, có loại ví/tiền tệ và trạng thái chọn. Không tự chọn ví đầu tiên, không gán ví từ widget URL. Giữ lọc ví tiết kiệm trong Vay/Nợ.
- Giữ danh mục, mic, camera và xem trước/xác nhận/chống trùng hiện có. Nhiều ví dùng cuộn dọc chung của form, không thêm màn Chọn ví.

## Bằng chứng Android local

- com.mobile.dev / Metro8081 (source QA) / Nest3302 / MySQL QA8 riêng. Không dùng APK production cũ.
- 00–02: launcher và form một ví sau tải source mới.
- 03–07: mở lịch, chọn31/10, mở lại rồi Hủy giữ31/10.
- 08–14: đóng form/mở app làm mới cache. 11 chỉ là launcher sau Back, không tính là Main đã tải; 13 xác nhận4ví.
- 15 là Fast Refresh/loading, không tính là trạng thái sẵn sàng. 16–20:4ví hiện sẵn, tên dài hai dòng, chọn Ngân hàng QA, nhập25k và cuộn tới ngày.
- 21–25: lịch sang tháng11, chọn1/11, preview đúng Ngân hàng QA/Làm đẹp/−25k/2026-11-01. Không bấm Xác nhận lưu.
- 26–32: sửa lại/giữ dữ liệu, chuyển Vay/Nợ, chọn hẹn trả30/11 rồi bỏ ngày hẹn.
- 33–34: Hủy trở về launcher, mở form rỗng với4ví để bàn giao local.
- PNG/XML là ảnh/chứng cứ gốc. SQL trước/sau giữ ví8=1.023.750đ,tx27–30,loan1–2. Helper chỉ thêm3ví QA số dư0 vào tài khoản thử, không thay dữ liệu hoặc tiền hiện có.

## Kiểm thử và giới hạn

- Jest49/49 qua4bộ, gồm3ca mới về chọn ví/ngày/Hủy/ngày hẹn trả và hồi quy lưu/chống trùng/đóng/auth/OCR. Jest mock API/native; bằng chứng UI thật tách riêng ở trên.
- TypeScript noEmit và ESLint exit0. Backend chỉ node--check và helper QA thật, không đếm lại bộ21kiểm thử đợt trước.
- initial-test-assertion.txt lưu lần đầu19đạt/1sai do test mong undefined trong khi contract ngày hẹn trống là null; đã sửa assertion, không sửa contract.
- Không đổi native/dependency, không build/cài APK mới hoặc phát hành/ký, không web/deploy/.env/restart server ổn định. Chưa nghiệm thu điện thoại thật/OEM/font lớn hoặc OCR/mic thật trong đợt này.
