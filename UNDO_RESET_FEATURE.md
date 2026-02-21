# Chức năng Hoàn tác (Undo) cho Reset

## Tổng quan
Đã thêm chức năng **Hoàn tác** cho hai tính năng reset trong trang Teaching:
1. **Reset điểm/xu cho lớp**
2. **Reset điểm học tập**

## Cách hoạt động

### 1. Reset điểm/xu cho lớp
- Khi giáo viên nhấn nút "Reset điểm/xu", hệ thống sẽ:
  - Lưu trữ dữ liệu hiện tại (điểm tích lũy và xu) của tất cả học sinh
  - Thực hiện reset theo giá trị mới
  - Hiển thị thông báo thành công với nút **"Hoàn tác"**

- Nếu giáo viên nhấn nút "Hoàn tác":
  - Hệ thống sẽ khôi phục lại điểm tích lũy và xu về giá trị trước khi reset
  - Hiển thị thông báo xác nhận hoàn tác thành công

### 2. Reset điểm học tập
- Khi giáo viên nhấn nút "Reset học tập", hệ thống sẽ:
  - Lưu trữ dữ liệu điểm học tập hiện tại của tất cả học sinh
  - Thực hiện reset về 0
  - Hiển thị thông báo thành công với nút **"Hoàn tác"**

- Nếu giáo viên nhấn nút "Hoàn tác":
  - Hệ thống sẽ khôi phục lại điểm học tập về giá trị trước khi reset
  - Hiển thị thông báo xác nhận hoàn tác thành công

## Đặc điểm kỹ thuật

### Thay đổi trong Teaching.jsx
1. **State mới**:
   - `resetBackup`: Lưu trữ dữ liệu backup với cấu trúc `{ type: 'points' | 'study', data: [...] }`
   - `undoing`: Trạng thái đang thực hiện hoàn tác

2. **Hàm mới**:
   - `handleUndoResetPoints()`: Hoàn tác reset điểm/xu
   - `handleUndoResetStudy()`: Hoàn tác reset điểm học tập

3. **Logic backup**:
   - Trước khi reset, hệ thống tự động tạo backup dữ liệu cũ
   - Backup chỉ lưu trữ cho lần reset gần nhất
   - Sau khi hoàn tác thành công, backup sẽ bị xóa

### Thay đổi trong Toast.jsx
1. **Props mới**:
   - `showUndo`: Boolean để hiển thị nút hoàn tác
   - `onUndo`: Callback function khi nhấn nút hoàn tác

2. **Behavior**:
   - Toast có nút hoàn tác sẽ **không tự động đóng**
   - Người dùng phải chủ động đóng hoặc nhấn hoàn tác
   - Khi nhấn hoàn tác, toast sẽ tự động đóng

## Lưu ý
- Chỉ có thể hoàn tác **lần reset gần nhất**
- Nếu thực hiện reset mới, dữ liệu backup cũ sẽ bị ghi đè
- Tính năng hoàn tác chỉ hoạt động trong phiên làm việc hiện tại (không lưu vào database)
- Nếu refresh trang, dữ liệu backup sẽ mất

## Ví dụ sử dụng
1. Giáo viên chọn lớp 6A
2. Nhấn "Reset điểm/xu", nhập giá trị mới (điểm: 100, xu: 50)
3. Xác nhận reset
4. Thông báo xuất hiện: "Đã reset điểm/xu cho 30 học sinh" với nút **"Hoàn tác"**
5. Nếu phát hiện sai sót, nhấn "Hoàn tác"
6. Tất cả học sinh sẽ được khôi phục về điểm/xu ban đầu
