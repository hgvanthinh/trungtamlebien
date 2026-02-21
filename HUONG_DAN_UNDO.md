# Hướng dẫn sử dụng tính năng Hoàn tác (Undo)

## 🎯 Mục đích
Tính năng Hoàn tác cho phép giáo viên khôi phục lại dữ liệu sau khi thực hiện reset, phòng trường hợp nhập sai hoặc thay đổi ý định.

## 📋 Các bước sử dụng

### Kịch bản 1: Reset điểm/xu cho lớp

#### Bước 1: Mở trang Teaching
- Truy cập `/admin/teaching`
- Chọn lớp học từ dropdown

#### Bước 2: Thực hiện Reset
1. Nhấn nút **"Reset điểm/xu"** (màu cam)
2. Một modal sẽ hiện ra
3. Nhập giá trị mới:
   - **Điểm tích lũy**: Ví dụ `100`
   - **Xu**: Ví dụ `50`
4. Nhấn nút **"Reset ngay"**
5. Xác nhận trong hộp thoại

#### Bước 3: Kiểm tra kết quả
- Thông báo thành công xuất hiện ở góc phải trên màn hình
- Nội dung: "Đã reset điểm/xu cho X học sinh"
- **Lưu ý**: Thông báo có nút **"Hoàn tác"** màu trắng

#### Bước 4: Hoàn tác (nếu cần)
- Nếu phát hiện sai sót, nhấn nút **"Hoàn tác"**
- Hệ thống sẽ:
  1. Hiển thị "Đang hoàn tác..."
  2. Khôi phục tất cả điểm/xu về giá trị cũ
  3. Hiển thị "Đã hoàn tác reset điểm/xu thành công!"
  4. Tự động reload danh sách học sinh

---

### Kịch bản 2: Reset điểm học tập

#### Bước 1: Mở trang Teaching
- Truy cập `/admin/teaching`
- Chọn lớp học từ dropdown

#### Bước 2: Thực hiện Reset
1. Nhấn nút **"Reset học tập"** (màu xanh dương)
2. Xác nhận trong hộp thoại
3. Hệ thống sẽ reset tất cả điểm học tập về 0

#### Bước 3: Kiểm tra kết quả
- Thông báo thành công xuất hiện
- Nội dung: "Đã reset điểm học tập cho X học sinh"
- **Lưu ý**: Thông báo có nút **"Hoàn tác"**

#### Bước 4: Hoàn tác (nếu cần)
- Nhấn nút **"Hoàn tác"**
- Hệ thống sẽ khôi phục tất cả điểm học tập về giá trị cũ
- Hiển thị "Đã hoàn tác reset điểm học tập thành công!"

---

## ⚠️ Lưu ý quan trọng

### 1. Thời gian có thể hoàn tác
- ✅ **CÓ THỂ**: Hoàn tác ngay sau khi reset (trong cùng phiên làm việc)
- ❌ **KHÔNG THỂ**: Hoàn tác sau khi refresh trang
- ❌ **KHÔNG THỂ**: Hoàn tác sau khi thực hiện reset mới

### 2. Chỉ lưu 1 lần backup
- Mỗi lần reset mới sẽ **ghi đè** backup cũ
- Ví dụ:
  ```
  Reset lần 1: Điểm = 100 → Có thể hoàn tác
  Reset lần 2: Điểm = 200 → Backup lần 1 bị mất, chỉ có thể hoàn tác lần 2
  ```

### 3. Thông báo không tự động đóng
- Thông báo có nút "Hoàn tác" sẽ **KHÔNG tự động đóng**
- Bạn phải:
  - Nhấn "Hoàn tác" để khôi phục, HOẶC
  - Nhấn nút "X" để đóng thông báo

### 4. Phạm vi hoàn tác
- Reset điểm/xu: Hoàn tác **cả điểm tích lũy VÀ xu**
- Reset học tập: Hoàn tác **chỉ điểm học tập**

---

## 💡 Mẹo sử dụng

### Mẹo 1: Kiểm tra trước khi đóng thông báo
- Sau khi reset, hãy kiểm tra 1-2 học sinh để đảm bảo đúng
- Nếu sai, nhấn "Hoàn tác" ngay
- Nếu đúng, nhấn "X" để đóng thông báo

### Mẹo 2: Không refresh trang ngay
- Đợi vài giây sau khi reset để đảm bảo có thể hoàn tác nếu cần
- Chỉ refresh sau khi chắc chắn reset đúng

### Mẹo 3: Ghi chú giá trị cũ
- Trước khi reset, có thể chụp màn hình hoặc ghi chú giá trị hiện tại
- Phòng trường hợp cần nhập lại thủ công

---

## 🔧 Xử lý sự cố

### Vấn đề 1: Không thấy nút "Hoàn tác"
**Nguyên nhân**: Có thể đã refresh trang hoặc thực hiện reset mới
**Giải pháp**: Không thể hoàn tác, cần nhập lại thủ công

### Vấn đề 2: Nhấn "Hoàn tác" nhưng không có gì xảy ra
**Nguyên nhân**: Lỗi kết nối hoặc quyền truy cập
**Giải pháp**: 
1. Kiểm tra kết nối internet
2. Kiểm tra console (F12) để xem lỗi
3. Thử refresh và reset lại

### Vấn đề 3: Thông báo "Không có dữ liệu để hoàn tác"
**Nguyên nhân**: Backup đã bị xóa hoặc chưa có reset nào
**Giải pháp**: Không thể hoàn tác, cần nhập lại thủ công

---

## 📊 Ví dụ thực tế

### Ví dụ 1: Reset nhầm giá trị
```
Tình huống: Muốn reset điểm = 100, xu = 50 nhưng nhập nhầm điểm = 10

Giải pháp:
1. Sau khi reset, phát hiện sai ngay
2. Nhấn "Hoàn tác" trong thông báo
3. Mở lại modal "Reset điểm/xu"
4. Nhập đúng: điểm = 100, xu = 50
5. Reset lại
```

### Ví dụ 2: Reset nhầm lớp
```
Tình huống: Chọn nhầm lớp 6A thay vì 6B

Giải pháp:
1. Nhấn "Hoàn tác" ngay
2. Chọn đúng lớp 6B
3. Thực hiện reset lại
```

### Ví dụ 3: Đổi ý sau khi reset
```
Tình huống: Reset điểm học tập về 0, nhưng sau đó quyết định giữ nguyên

Giải pháp:
1. Nhấn "Hoàn tác" trong thông báo
2. Tất cả điểm học tập được khôi phục
```

---

## ✅ Checklist trước khi Reset

- [ ] Đã chọn đúng lớp học
- [ ] Đã kiểm tra giá trị cần reset
- [ ] Đã sẵn sàng nhấn "Hoàn tác" nếu cần
- [ ] Chưa refresh trang sau khi reset (nếu muốn có thể hoàn tác)

---

**Lưu ý cuối**: Tính năng Hoàn tác là công cụ hỗ trợ, nhưng vẫn nên cẩn thận khi thực hiện reset để tránh phải hoàn tác nhiều lần.
