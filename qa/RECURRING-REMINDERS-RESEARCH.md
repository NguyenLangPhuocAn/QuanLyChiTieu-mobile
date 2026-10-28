# Nhắc các khoản dễ bỏ sót — nghiên cứu 26/10/2026

**Cập nhật28/10 — C1:** đã có cảnh báo tăng tiền/nghi ghi lặp có bằng chứng, Đã kiểm tra/Hiện lại và tổng dự kiến30ngày. Xem [BILL-ACTIVITY](BILL-ACTIVITY.md). Đối chiếu nguồn B2 xem [PAYMENT-LINK-CHECKS](PAYMENT-LINK-CHECKS.md). Các đoạn mô tả chưa có bên dưới là khảo sát lịch sử; C2 backup/sync/nối dự báo vẫn chưa xong.

**Tiếp tục27/10:** gợi ý theo tuần/tháng/năm, bằng chứng và Theo dõi/Không định kỳ/Để sau đã có source; xem [BILL-SUGGESTIONS](BILL-SUGGESTIONS.md). Chưa có chu kỳ quý, tự gộp tên không rõ, kiểm lại thanh toán gốc, cảnh báo bất thường hoặc tích hợp backup/dự báo; không coi toàn bộ nghiên cứu đã hoàn thành.

**Cập nhật27/10:** nhắc lịch đã xác nhận (đợt A) đã có source/QA, xem [BILL-REMINDERS](BILL-REMINDERS.md). Phát hiện ứng viên/bất thường dưới đây vẫn là đề xuất, không tự gửi nhắc từ suy đoán.

Trạng thái: đã khảo sát nguồn chính thức và rà source; các hành vi dưới đây là **đề xuất**, chưa được triển khai hoặc phát hành. Mục tiêu là chủ động tìm khoản người dùng có thể quên, thay vì chỉ nhắc lịch họ đã nhập.

Rà soát trạng thái27/10: [kết quả kiểm tra plan và thứ tự thực hiện](PLAN-REVIEW-2026-10-27.md). Không dùng việc có detector/nhắc chung để kết luận nhắc từng hóa đơn đã hoạt động.

## Nguồn tham khảo và điều rút ra

- [Rocket Money: quản lý hóa đơn và thuê bao](https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions): phân tích lịch sử giao dịch để phát hiện khoản lặp; khoản không có trong nguồn dữ liệu vẫn cần thêm tay. Nova không có kết nối ngân hàng như sản phẩm này, nên chỉ dùng giao dịch đã được người dùng lưu/nhập hợp lệ và lịch đã xác nhận.
- [Monarch: Bill Sync](https://www.monarch.com/blog/introducing-bill-sync): đưa khoản lặp mới phát hiện ra để người dùng duyệt/sửa trước khi theo dõi. Đây là mô hình phù hợp để tránh nhầm thói quen mua sắm với nghĩa vụ thanh toán.
- [Rocket Money: cảnh báo thay đổi giá thuê bao](https://www.rocketmoney.com/learn/personal-finance/is-there-an-app-that-can-tell-me-when-my-subscription-price-increased): so sánh khoản bị trừ với lịch sử để báo mức tăng. Không sao chép ngưỡng USD của sản phẩm này sang VND/ngoại tệ của Nova.
- [Android: quyền thông báo](https://developer.android.com/develop/ui/compose/notifications/notification-permission): Android 13+ cần POST_NOTIFICATIONS cho thông báo thông thường; không hứa gửi được nếu quyền/kênh bị tắt.
- [Android: hẹn lịch nền](https://developer.android.com/develop/background-work/services/alarms): có thể hẹn tác vụ khi app không chạy; lịch không chính xác chịu giới hạn tiết kiệm pin. Nhắc hóa đơn không cần cam kết đúng đến từng phút hoặc xin quyền exact alarm ngay từ đầu.

## Source hiện có và khoảng trống đã xác minh

- `src/utils/financialInsights.ts`: detectRecurringMoney nhóm ghi chú đã chuẩn hóa, loại Thu/Chi và số tiền làm tròn theo bậc 10.000. Cần ít nhất hai giao dịch, toàn bộ khoảng cách 20–40 ngày, độ lệch tiền tối đa 12%. Chỉ suy ra chu kỳ tháng; khóa hiện chưa có tiền tệ. Có thể bỏ sót khoản tăng giá hoặc nhóm sai ngoại tệ, không nên nối thẳng vào thông báo tự động.
- Helper buildRecurringDueReminders và màn FinancialCenter cũ có gợi ý kỳ; không dùng việc có helper/route làm bằng chứng chức năng đang đến được người dùng. Người dùng đã yêu cầu bỏ trung tâm tài chính, không khôi phục nó cho tính năng này.
- `src/services/recurringBills.ts`, `src/utils/recurringBills.ts`, `RecurringBillsScreen.tsx`: lịch local theo tài khoản/backend, kỳ tuần/tháng/năm, xác nhận liên kết khoản đã trả và chống trùng. Chưa nối tự phát hiện hoặc nhắc từng kỳ.
- `FinancialReminderScheduler.kt`/Receiver: nền nhắc kiểm tra tài chính chung theo ngày/tuần/tháng, một requestCode/notificationId cố định và một message. Có xử lý boot/đổi giờ/múi giờ, nhưng chưa chứa nhiều lịch hóa đơn, khóa theo kỳ hoặc liên kết mở đúng hóa đơn. Không được ghi đè nhắc chung khi thêm nhắc hóa đơn.
- Backend notifications có lịch quét ngân sách/dự báo/tiết kiệm; chưa phải nhắc từng hóa đơn local. Không thêm cron backend đọc lịch đang chỉ nằm trên máy mà chưa có thiết kế đồng bộ.

## Những khoản cần phát hiện và cách nhắc

| Khoản dễ quên | Bằng chứng tối thiểu | Cách trình bày đề xuất |
|---|---|---|
| Thuê bao nhỏ, tự gia hạn | Giao dịch cùng dịch vụ có nhịp ổn định | “Khoản này xuất hiện 3 tháng liên tiếp. Theo dõi kỳ tới?” |
| Tiền nhà/internet/điện/nước | Lịch đã xác nhận; tiền biến thiên dùng khoảng phù hợp | “Ngày mai đến hạn tiền internet. Bạn đã thanh toán chưa?” |
| Phí quý/năm, bảo hiểm, tên miền | Ngày gia hạn do người dùng xác nhận; lịch sử dài đủ tin cậy chỉ làm gợi ý | Nhắc sớm hơn để có thời gian chuẩn bị; không suy ra gia hạn năm chỉ từ một lần chi |
| Sắp hết dùng thử/ưu đãi | Ngày kết thúc có trong thông tin người dùng nhập hoặc chứng từ rõ ràng và đã xác nhận | Nhắc trước khi chuyển sang tính phí; không tự biết ngày này từ ngân hàng nếu chưa có dữ liệu |
| Khoản định kỳ tăng tiền | So sánh cùng dịch vụ/tiền tệ với lịch sử hoặc khoảng dự kiến; phân biệt phí/thuế và tiền biến thiên | “Khoản vừa ghi cao hơn các kỳ trước. Kiểm tra lại?” Cảnh báo tăng tiền thường chỉ có sau khi giao dịch xuất hiện |
| Có thể thu hai lần một kỳ | Hai giao dịch khác nhau cùng dịch vụ/kỳ, có bằng chứng đủ; không nhầm bản nhập trùng | “Có 2 khoản giống nhau trong kỳ này.” Cho xem hai khoản, không tự xóa hoặc kết luận ngân hàng thu sai |
| Đến hạn nhưng chưa thấy ghi trả | Lịch xác nhận, kỳ chưa xử lý, dữ liệu có mốc cập nhật | “Chưa thấy giao dịch thanh toán.” Có Đã trả / Nhắc lại / Bỏ qua, không khẳng định người dùng mắc nợ |
| Nhiều khoản nhỏ cộng lại lớn | Tổng thuê bao đã xác nhận trong một kỳ/tiền tệ | Bản tổng hợp: “Các khoản đang theo dõi dự kiến …/tháng. Còn dùng tất cả không?” Không tự kết luận dịch vụ không được dùng |

## Luồng tối giản

1. Sau khi giao dịch được lưu hoặc import xác nhận, phân tích lịch sử đã có theo từng tài khoản/backend/tiền tệ. Không tự đọc lại toàn bộ ngân hàng, chụp màn hình hoặc gửi chữ sang AI chỉ vì đang có dữ liệu mới.
2. Trong **Hóa đơn định kỳ**, thêm phần gọn “Có thể bạn bỏ sót”, hiện vài ứng viên kèm các lần chi làm bằng chứng. Không tạo thêm trung tâm hoặc màn điểm số.
3. Người dùng chọn Theo dõi / Không phải định kỳ / Để sau. Theo dõi mở lịch đã điền sẵn tên, nhịp, khoảng tiền và ngày dự kiến; chỉ lưu sau xác nhận. Để sau và từ chối cần nhớ để không hỏi mỗi lần mở app.
4. Lịch đã bật nhắc được đặt lịch native trên thiết bị. Thông báo mở đúng hóa đơn/kỳ; từ đó xem trước liên kết khoản đã ghi hoặc mở form tạo nháp. Không tự tạo/sửa/xóa giao dịch, chọn ví hoặc trừ tiền.

## Quy tắc suy luận đề xuất

- Tách chắc chắn lịch đã xác nhận và ứng viên dự đoán. Hai lần lặp chỉ là gợi ý yếu; ba lần có nhịp ổn định tốt hơn, vẫn cần xác nhận. Cà phê/Grab mua thường xuyên không mặc nhiên là hóa đơn.
- Chuẩn hóa đơn vị nhận tiền, giữ chữ có nghĩa, bỏ mã tham chiếu biến đổi có kiểm soát; có thể hỏi người dùng gộp tên dịch vụ. Không gộp chỉ vì cùng danh mục hoặc cùng số tiền.
- Mọi số tiền/ngưỡng theo đúng tiền tệ, không trộn VND/USD hoặc dùng bậc 10.000 chung. Đổi ví thanh toán không nhất thiết đổi dịch vụ; nhiều gói cùng nhà cung cấp vẫn phải tách được. Dòng chuyển ví, vay/nợ, tiết kiệm và hoàn tiền không tự tạo một hóa đơn mới.
- Phát hiện tuần/tháng/quý/năm bằng ngày lịch và xử lý ngày 28–31/năm nhuận. Bỏ qua một kỳ không dịch ngày gốc. Không bắt buộc tiền giống nhau để phát hiện điện/nước hoặc để theo dõi tăng giá.
- Hiện ngày dự kiến, khoảng tiền, độ đầy đủ của lịch sử; không điền mức chính xác giả khi thiếu dữ liệu. AI có thể hỗ trợ nhận diện tên/giải thích khi có đồng ý phù hợp, nhưng lịch/tiền/trạng thái phải được kiểm chứng; tính năng cơ bản không cần gọi AI mỗi lần nhắc.

## Chính sách nhắc đề xuất để không làm phiền

- Người dùng bật nhóm nhắc và cấp quyền; cho chỉnh từng lịch. Mặc định đề xuất hóa đơn tháng trước 3 ngày/1 ngày/đúng hạn, khoản quý/năm trước 7 ngày/1 ngày/đúng hạn; giờ nhắc do người dùng chọn. Đây là cấu hình dự kiến, chưa phải hành vi đã có.
- Nhiều khoản cùng ngày gộp một thông báo: “Ngày mai có 3 khoản cần kiểm tra”, mở danh sách chi tiết. Ứng viên chưa xác nhận gom thành bản tổng hợp, không đẩy riêng liên tục.
- Chống trùng theo tài khoản + backend + lịch + kỳ + mốc nhắc, lưu trạng thái đã gửi bền vững. Callback đến muộn phải kiểm lại phiên, quyền và trạng thái kỳ.
- Đã trả/bỏ qua/tạm dừng/xóa lịch: hủy lịch nhắc tương ứng và thông báo cũ. Đăng xuất/đổi tài khoản không lộ lịch người trước; chỉnh ngày, múi giờ, reboot hoặc cập nhật app cần tái lập đúng phần còn hiệu lực.
- Nhắc quá hạn hữu hạn, có nhắc lại hoặc tắt; không lặp vô hạn. Tôn trọng giờ yên lặng, tránh dồn các mốc đã lỡ sau khi máy bật lại.
- Màn khóa mặc định nội dung chung, không lộ số tiền/tên dịch vụ khi người dùng bật ẩn tiền. Từ chối quyền vẫn thấy nhắc trong app; hướng dẫn bật lại khi cần.
- Không hứa đúng phút trên mọi OEM/tiết kiệm pin; force-stop bởi người dùng có thể ngăn tác vụ nền cho tới khi app được mở lại. Cần kiểm tra điện thoại thật trước nghiệm thu.

## Thứ tự làm và điều kiện đạt

1. **Nhắc hóa đơn đã xác nhận:** mở rộng native bằng scheduler riêng/ID riêng, hủy/rebuild lịch theo vòng đời; không đổi server ổn định. Test nhiều hóa đơn cùng ngày, cuối tháng/năm nhuận, đã trả/pause/skip, reboot/đổi giờ/đổi tài khoản, quyền bị tắt và lưu bền chống gửi lặp.
2. **Phát hiện khoản bỏ sót:** sửa detector/tiền tệ, bổ sung evidence và quyết định theo tài khoản/backend; nối vào màn Hóa đơn định kỳ. Test tên biến đổi, biến thiên/tăng giá, đổi ví, nhiều gói chung nhà cung cấp, thiếu dữ liệu, nhập Excel trùng và chi thói quen không phải nghĩa vụ.
3. **Tăng tiền/trùng kỳ/tổng hợp:** kiểm chứng bằng giao dịch đã lưu, cho người dùng xử lý và tắt nhắc; chỉ gợi ý, không sửa tiền. Ngày dùng thử cần nhập/xác nhận rõ ràng.
4. Chụp từng luồng trên Android local với dữ liệu QA, kiểm tra không đổi số dư/giao dịch và thử điện thoại thật. Cập nhật log/Excel/patch note bằng kết quả đã có. Commit/push sau mỗi đợt đã kiểm tra; chờ người dùng chốt mới phát hành APK. Không đánh dấu hoàn thành chỉ vì có giao diện hoặc helper.

Ngày ghi nhận:26/10/2026. Tài liệu này chỉ bổ sung thiết kế; không đổi hành vi app, môi trường production, quyền Android hoặc lịch nhắc của người dùng.
