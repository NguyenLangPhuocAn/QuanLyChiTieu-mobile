# Sổ Thu Chi Nova 1.2.0

**Trạng thái:** Đã phát hành ngày 18/10/2026

**Cập nhật nội dung:** 18/10/2026

**Phiên bản:** 1.2.0 (`versionCode 5`)

**Tải APK:** https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/download/v1.2.0/QuanLyChiTieu-1.2.0.apk

**SHA-256:** `205FCDF1BB4162D564A5E91751C6B3AC1545843FDCA5F387B80BD195C2776129`

**Dung lượng:** 49.543.898 byte (khoảng 47,3 MB)

Bản cập nhật này tập trung vào việc thu nhận giao dịch an toàn, dự báo dòng tiền và giúp người dùng hiểu rõ tình hình tài chính. Mọi thao tác có thể làm thay đổi số dư đều yêu cầu xem trước hoặc xác nhận; dữ liệu nghi trùng không được tự động ghi hay tự động gộp.

## 12 chức năng chính

### Dữ liệu và sao lưu

1. **Backup cá nhân mã hóa**
   - Tạo file `.stcn-backup` được mã hóa AES-256-GCM bằng mật khẩu của người dùng.
   - File có phiên bản, ngày tạo và danh sách loại dữ liệu.
   - Khi khôi phục, ứng dụng kiểm tra mật khẩu, phát hiện dòng trùng và cho chọn từng giao dịch.
   - Không chọn sẵn giao dịch; nút chọn tất cả chỉ áp dụng cho các dòng hợp lệ đang hiển thị.
   - File lớn được mở thêm theo từng nhóm 200 dòng để tránh khôi phục dữ liệu chưa xem.
   - Khôi phục chỉ thêm giao dịch đã chọn, không ghi đè số dư hoặc dữ liệu đang có.

2. **Bản nháp ngoại tuyến**
   - Khi mất mạng, giao dịch được giữ thành bản nháp và chưa ảnh hưởng số dư.
   - Mỗi bản nháp có khóa chống gửi trùng khi đồng bộ lại.
   - Có thể sửa số tiền, ví, danh mục và ghi chú của bản nháp bị từ chối.
   - Các thao tác được xử lý tuần tự theo tài khoản để không mất bản nháp khi đồng bộ và nhập mới cùng lúc.

3. **Nhập Excel có xem trước và hoàn tác**
   - Phân loại từng dòng thành mới, nghi trùng, lỗi hoặc không hỗ trợ.
   - Người dùng chọn riêng các dòng muốn nhập trước khi xác nhận.
   - Mỗi lần nhập có mã lô; có thể hoàn tác đúng các giao dịch thuộc lô vừa nhập.

### Thu nhận và kiểm tra giao dịch

4. **Hộp thư tài chính**
   - Gom bản nháp từ OCR hóa đơn, giọng nói, Excel, giao dịch ngoại tuyến và thông báo ngân hàng.
   - Lọc theo nguồn và trạng thái; mở đúng màn sửa, chọn dòng, ghép hoặc xác nhận.
   - OCR, giọng nói và Excel hoàn tất cùng lúc vẫn được lưu đủ bằng hàng đợi riêng theo tài khoản.
   - Nội dung chưa duyệt không làm thay đổi số dư.

5. **Ghép thông báo ngân hàng với ảnh hóa đơn**
   - Đề xuất giao dịch phù hợp dựa trên số tiền, thời gian và người bán.
   - Hiển thị lý do cùng độ tin cậy trước khi ghép.
   - Chỉ ghép sau khi xác nhận; giữ nguyên ảnh, chi tiết món và nội dung ngân hàng trong cùng giao dịch.
   - Không tạo thêm giao dịch thứ hai khi đã ghép.

6. **Trung tâm chất lượng dữ liệu**
   - Phát hiện giao dịch nghi trùng, thiếu danh mục, lệch tổng hóa đơn và thiếu tỷ giá.
   - Mỗi cảnh báo có lý do, độ tin cậy, số giao dịch liên quan và hành động sửa.
   - Nhóm nghi trùng được so sánh trước khi người dùng chọn bản ghi cần xử lý.
   - Ứng dụng không tự xóa hoặc tự gộp giao dịch.

### Kế hoạch tài chính

7. **Lịch tiền sắp tới**
   - Hiển thị lương, tiền nhà, thuê bao, khoản nợ và các khoản dự kiến theo ngày.
   - Tính số dư dự kiến sau từng ngày.
   - Cảnh báo ngày đầu tiên có nguy cơ âm tiền và mức số dư thấp nhất.
   - Phân biệt rõ giao dịch đã ghi với khoản dự kiến; khoản dự kiến không tự đổi số dư.

8. **Phát hiện thuê bao và khoản định kỳ**
   - Nhận diện khoản lặp theo người bán, chu kỳ và biên độ số tiền.
   - Người dùng xác nhận hoặc bỏ qua từng đề xuất.
   - Khoản đã xác nhận được nhắc trước 7 ngày và có thể bỏ theo dõi.
   - Ứng dụng không tự tạo giao dịch thật.

9. **Chế độ thu nhập không đều**
   - Chọn lịch sử 3, 6 hoặc 12 tháng.
   - Hiển thị số tháng có dữ liệu, trung vị thu, trung vị chi và mức chi thận trọng.
   - Dùng trung vị để giảm ảnh hưởng của các tháng có thu nhập bất thường.

10. **Chế độ quỹ khẩn cấp**
    - Hiển thị tiền sẵn có, chi thiết yếu và số tháng quỹ có thể duy trì.
    - Mô phỏng thu nhập giảm 25%, 50% hoặc 100%.
    - Nêu phần thiếu mỗi tháng và thời gian quỹ có thể bù.

11. **Chi an toàn hôm nay**
    - Loại ví tiết kiệm khỏi nguồn tiền có thể chi.
    - Giữ lại tiền cho khoản định kỳ, lịch nhập tay, mục tiêu tiết kiệm và quỹ an toàn 0/1/3 tháng.
    - Chia số còn lại theo số ngày phù hợp và công khai toàn bộ công thức.
    - Kết quả không âm; khi thiếu tiền, ứng dụng nêu rõ phần thiếu và dữ liệu còn thiếu.

### Tra cứu

12. **Tìm kiếm giao dịch bằng câu tiếng Việt**
    - Hiểu loại thu/chi, ví, danh mục, khoảng tiền và thời gian.
    - Hỗ trợ hôm qua, 7 ngày qua, tuần trước, quý này, quý trước, năm trước và khoảng ngày cụ thể.
    - Hiểu các cách nói như `ít nhất`, `không quá`, `trên 200 nghìn` và `hoàn tiền`.
    - Chuyển câu tìm kiếm thành bộ lọc nhìn thấy được và sửa được; xử lý cục bộ trên thiết bị.

## Thông báo ngân hàng và nhắc tài chính

- Đọc thông báo từ các ứng dụng ngân hàng đã chọn và nhận biết tiền vào hoặc tiền ra.
- Không dùng số dư, số tiền khả dụng hoặc OTP làm số tiền giao dịch.
- Có nút **Đọc thông báo mới** và tùy chọn lắc hai nhịp khi ứng dụng đang mở.
- Mọi thông báo đều vào hàng chờ để người dùng xem lại số tiền, loại, ngày và ghi chú trước khi ghi.
- Cấu hình tự động cũ cũng được chuyển về chế độ chờ duyệt.
- Thêm nhắc tài chính ngoài ứng dụng theo ngày, Chủ nhật hằng tuần hoặc ngày 25 mỗi tháng, vào 08:00, 12:00 hoặc 20:00.
- Lịch nhắc được khôi phục sau khi khởi động lại máy, cập nhật ứng dụng hoặc đổi giờ; nội dung mặc định không hiện số tiền trên màn hình khóa.

## Điểm sức khỏe và trợ lý

- Điểm sức khỏe tài chính sử dụng ba nhóm: dòng tiền 40 điểm, quỹ dự phòng 30 điểm và ngân sách 30 điểm.
- Màn chi tiết nêu dữ liệu đầu vào, cách tính và hành động cần thực hiện cùng số tiền cần bổ sung.
- Trợ lý được giới hạn trong quản lý thu chi và tài chính cá nhân; câu hỏi toán hoặc yêu cầu viết mã bị từ chối.

## Hóa đơn và báo cáo

- OCR ưu tiên tổng tiền phải thanh toán sau giảm giá và giữ chi tiết từng món riêng với tổng hóa đơn.
- Chuẩn hóa ký hiệu `đ`, `₫`, `VNĐ` và `VND`.
- Ảnh hóa đơn độc lập với OCR; người dùng vẫn có thể đính kèm ảnh và nhập món bằng tay.
- Backup, Excel và PDF dùng hộp thoại lưu file chuẩn của Android để chọn thư mục và tên file.
- Xuất Excel giữ đầy đủ loại giao dịch và dữ liệu chi tiết; báo cáo không chèn ghi chú thừa dưới nội dung.

## Tối ưu và sửa lỗi

- Hiển thị dữ liệu đã lưu gần nhất trước, sau đó đồng bộ mới ở nền.
- Gộp các lần tải màn chính đang chạy để tránh gọi cùng một nhóm API hai lần.
- Giảm ảnh OCR còn tối đa 1600 × 2400 px, chất lượng 70% trước khi tải lên.
- Backend nén phản hồi JSON; truy vấn giao dịch lọc khoảng tiền trực tiếp tại cơ sở dữ liệu.
- Sửa lỗi lưu backup, Excel hoặc PDF có thể thất bại trên Android mới.
- Sửa nguy cơ mất bản nháp ngoại tuyến khi đồng bộ và tạo giao dịch cùng lúc.
- Sửa nguy cơ mất mục trong Hộp thư tài chính khi nhiều nguồn hoàn tất đồng thời.
- Ngăn khôi phục nhầm các dòng backup chưa được hiển thị.

## Kết quả kiểm tra hiện tại

- Mobile: **65 bộ, 287/287 trường hợp đạt**.
- Backend: **47 bộ, 289/289 trường hợp đạt**.
- Mobile TypeScript và ESLint đạt.
- Backend TypeScript và kiểm tra phần thay đổi đạt.
- Web admin build production và lint đạt ở lần kiểm tra toàn dự án gần nhất.
- Android `compileReleaseKotlin` đạt cho phần mã native mới.

## Việc còn lại trước khi phát hành

- Thử trên điện thoại thật: mất mạng, tạo nhiều bản nháp, sửa bản nháp lỗi và đồng bộ lại.
- Thử vòng backup hoàn chỉnh: tạo file, hủy lưu, nhập sai mật khẩu, xem trước, chọn một phần và khôi phục.
- Thử lưu backup, Excel và PDF vào các thư mục khác nhau trên Android.
- Thử thông báo ngân hàng gồm tiền ra, tiền vào, chỉ có số dư và OTP; kiểm tra thao tác lắc.
- Thử ghép thông báo ngân hàng với giao dịch có ảnh và chi tiết món.
- Đo tốc độ mở giao dịch và OCR bằng Wi-Fi và 4G.
- Kiểm tra giao diện của 12 chức năng với dữ liệu thật và nhiều loại tiền tệ.
- Chỉ sau khi các bước trên đạt và người dùng nói **“chốt”** hoặc **“cập nhật app”** mới chốt phiên bản, build, ký và phát hành APK.

## Lưu ý nâng cấp

- Chưa có APK mới trong giai đoạn này.
- Không cần nhập lại dữ liệu do chưa có thay đổi cấu trúc bắt buộc.
- Đọc thông báo ngân hàng cần quyền truy cập thông báo.
- Nhắc tài chính ngoài ứng dụng cần quyền gửi thông báo trên Android 13 trở lên.
- Mật khẩu backup không được lưu và không thể lấy lại nếu người dùng quên.
