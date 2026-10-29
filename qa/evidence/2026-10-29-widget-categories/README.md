# Danh mục widget — giao diện cũ và danh sách đầy đủ, 29/10/2026

## Yêu cầu và thay đổi

Hai danh mục Chi QA cũ là dữ liệu tối thiểu của QA7 để thử widget, không phải giới hạn trong app hoặc xóa danh mục người dùng. Không sửa database production. Đợt này khôi phục kiểu thẻ chọn/CategoryIcon gốc như CategoriesScreen, có tên, hệ thống/cá nhân, trạng thái chọn và tìm kiếm. Thẻ đã chọn có icon/Khoản thu–chi/Đổi; ví nằm riêng. Không hardcode tên/ID/số lượng mẫu vào UI. Bộ chọn nhận toàn bộ danh mục thu/chi thường của tài khoản hiện có; kiểm thử danh sách30mục vẫn thấy và chọn được mục cuối.

Làm mới cache cùng API danh mục, panel đăng ký nhận cache mới để dữ liệu không đứng ở bộ cũ đến lần mở sau; không reset số tiền/ghi chú đang nhập. Vẫn dùng scope tài khoản/backend và kiểm tra lại ví/danh mục trước ghi. Không thêm luồng ghi tiền, không thay native widget activity/mic/camera trong đợt này.

## Môi trường và dữ liệu thử

Android13 Pixel3a emulator5554, com.mobile.dev source local/Metro8081/API3301/MySQL loopback schema QA có sẵn. Helper scripts/widget-categories-qa.cjs tạo mới đúng một tài khoản QA8/ví8 trong transaction:12Chi (Ăn uống/Di chuyển/Hóa đơn/Mua sắm/Giải trí/Sức khỏe/Nhà ở/Giáo dục/Du lịch/Làm đẹp/Bảo hiểm/Khác),5Thu (Lương/Thưởng/Đầu tư/Quà tặng/Khác), ví1triệu và0giao dịch. Icon trỏ tới public/categories/icons sẵn có; HTTP QA3301 cho ảnh expense_food.png trả200. Đây là dữ liệu mẫu riêng; không giới hạn danh mục thật ở17mục và không chuyển thông tin người dùng thật vào QA. Các mục mẫu được tạo cá nhân để không ảnh hưởng API các tài khoản QA khác.

QA7 của đợt trước giữ nguyên3giao dịch/ví1.030.000. Không đổi/reset/migrate schema hoặc .env/server3000; health cuối200. Chưa build/ký/phát hành APK hoặc sửa web. Native vẫn dùng debug local đã cài ở đợt trước; các thay đổi mới là JS qua Metro và helper QA.

## Các bước đã kiểm tra

- 00–03 đóng panel cũ, mở MainActivity local để chuyển tài khoản thử;02 là frame bundle chưa sẵn sàng,03 mới Tổng quan QA7. 04 là chuyển tab,05 mới Tài khoản.06–08 cuộn tới Đăng xuất;09 màn Launch,10 xác nhận đã đăng xuất. Không xóa tài khoản/ví/giao dịch.
- 11–16 đăng nhập QA8 bằng helper kiểm package QA/đúng focus/schema/email. Không log mật khẩu/token; ảnh15/XML chỉ có ký tự che mật khẩu.17 Tổng quan QA8 có1ví,18 widget đã xóa scope/lựa chọn QA7 và dùng catalog mới.
- 19 native dropdown có đủ12danh mục Chi và đúng tên cũ; chọn mục cuối Ăn uống ở20 rồi mở panel21. 22 mới là form sẵn sàng: icon Ăn uống/Khoản chi/Đổi, chưa chọn ví/số tiền. 23 bộ chọn thẻ icon ghi12danh mục, các mục phía dưới cuộn được; không giới hạn ở nhóm đang nhìn thấy.
- 24 gõ hi vào tìm kiếm → còn Bảo hiểm,25 đóng bàn phím,26 chọn đúng và trở lại thẻ Bảo hiểm/Khoản chi. Không ghi tiền khi chọn danh mục.
- 27 đổi Thu xóa lựa chọn Chi;28 bộ chọn có5mục Thu với icon: Khác/Quà tặng/Đầu tư/Thưởng/Lương.29 Back về form,30 đổi Chi,31 mở lại danh sách Chi đầy đủ và để sẵn cho người dùng xem. Tìm kiếm cũ không bị mang sang bộ chọn mới.
- 32–33 cuộn xuống cuối danh sách Chi, thấy Di chuyển/Ăn uống và Quay lại;34 chọn được Ăn uống ở cuối,35 mở lại bộ chọn. Không coi chỉ các thẻ nằm trong viewport đầu là toàn bộ danh sách. Để bộ chọn này mở cho người dùng xem local, chưa nhập tiền/chọn ví/lưu.
- SQL trước/cuối: QA8 vẫn0giao dịch/ví1triệu,17danh mục; QA7 giữ3giao dịch/ví1.030.000 và danh mục8/9/10 không đổi. Không bấm Kiểm tra/Xác nhận lưu ở đợt này. Bản mẫu QA8 không phải kết quả phục hồi dữ liệu người dùng thật.

## Kết quả kiểm thử và giới hạn

Jest92/92 qua12bộ,4ca mới so với88 trước đó:30danh mục/mục cuối, tìm theo tên và callback đúngID, chỉ Thu, cache thay đổi vẫn giữ số tiền. Lượt đầu test đếm cả wrapper React Native nên đếm120 thay vì30; sửa bộ chọn test dùng đúng TouchableOpacity, không sửa assertion số lượng hoặc bớt danh mục để qua. API/native trong Jest là mock; giữ log chẩn đoán cùng log cuối. TypeScript noEmit/ESLint các file thay đổi đạt; node --check helper backend/login đạt. Android local và API/MySQL QA thật xác nhận các bước trên, ảnh/XML gốc và SHA-256 được giữ.

Danh mục tài khoản thật sẽ đến từ API/cache của chính tài khoản đó; không đổi tên/xóa/tự tạo danh mục trên production. Chưa phát hành APK nên điện thoại dùng bản phát hành cũ chưa nhận UI này. Giới hạn mic/OCR thật/OEM/4G/C2b từ đợt trước vẫn còn; không chạy lại các kiểm thử phần cứng/ghi tiền rồi tính thành kết quả mới. Giữ Metro/QA3301 và QA8 đăng nhập để thử local; server ổn định PID3764/3000 giữ nguyên.
