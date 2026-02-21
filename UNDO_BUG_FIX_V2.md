# Sửa lỗi: "Không có dữ liệu để hoàn tác" - Lần 2

## 🐛 Vấn đề mới phát hiện
Sau khi sửa lần 1, vẫn gặp lỗi:
- Lần đầu nhấn "Hoàn tác" → Báo lỗi "Không có dữ liệu để hoàn tác"
- Phải nhấn "Hoàn tác" lần 2 mới thành công
- Vẫn cần 2 lần thay vì 1 lần

## 🔍 Nguyên nhân sâu xa

### Vấn đề 1: Race Condition với State
```javascript
// Code có vấn đề
const handleUndoResetPoints = async () => {
    setToast({ message: 'Đang hoàn tác...', type: 'info' });
    
    // Khi setToast được gọi, React re-render
    // Toast cũ (có nút Hoàn tác) bị unmount
    // Toast mới (không có nút Hoàn tác) được mount
    
    const updatePromises = resetBackup.data.map(...);  // ← resetBackup có thể đã null
    setResetBackup(null);  // ← Xóa backup quá sớm
}
```

**Vấn đề:**
1. Khi `setToast` được gọi, React bắt đầu re-render
2. Component re-render có thể trigger lại hàm undo (nếu user click nhanh)
3. `resetBackup` bị set null trước khi hoàn thành
4. Lần gọi thứ 2 thấy `resetBackup === null` → Báo lỗi

### Vấn đề 2: Không có cơ chế ngăn chặn double-click
```javascript
// Không có guard
const handleUndoResetPoints = async () => {
    // User có thể click nhiều lần trong khi async đang chạy
    setUndoing(true);
    // ... async operations
    setUndoing(false);
}
```

## ✅ Giải pháp chi tiết

### 1. Thêm guard ngăn chặn double execution
```javascript
const handleUndoResetPoints = async () => {
    // THÊM: Kiểm tra nếu đang undo thì return ngay
    if (undoing) {
        return;  // Ngăn không cho chạy lại
    }
    
    // ... rest of code
}
```

**Lợi ích:**
- Ngăn user click nhiều lần
- Ngăn React re-render trigger lại hàm

### 2. Lưu backup vào biến local
```javascript
const handleUndoResetPoints = async () => {
    if (undoing) return;
    
    if (!resetBackup || resetBackup.type !== 'points') {
        setToast({ message: 'Không có dữ liệu...', type: 'error' });
        return;
    }
    
    // THÊM: Lưu backup vào biến local TRƯỚC KHI xóa state
    const backupData = resetBackup.data;
    
    setUndoing(true);
    setToast({ message: 'Đang hoàn tác...', type: 'info' });
    
    try {
        // Dùng backupData thay vì resetBackup.data
        const updatePromises = backupData.map(student => {
            // ... update logic
        });
        
        await Promise.all(updatePromises);
        await fetchStudents();
        
        // Chỉ xóa backup SAU KHI hoàn thành
        setResetBackup(null);
        setToast({ message: 'Thành công!', type: 'success' });
    } catch (error) {
        setToast({ message: 'Lỗi...', type: 'error' });
    } finally {
        setUndoing(false);  // Đảm bảo luôn reset flag
    }
}
```

**Lợi ích:**
- `backupData` là biến local, không bị ảnh hưởng bởi state changes
- Backup chỉ bị xóa SAU KHI hoàn thành thành công
- `finally` đảm bảo `undoing` luôn được reset

### 3. Thay đổi thứ tự operations
```javascript
// TRƯỚC (SAI):
setResetBackup(null);      // Xóa backup trước
await fetchStudents();     // Load data sau

// SAU (ĐÚNG):
await fetchStudents();     // Load data trước
setResetBackup(null);      // Xóa backup sau
```

**Lý do:**
- Nếu `fetchStudents()` fail, backup vẫn còn để retry
- Chỉ xóa backup khi chắc chắn thành công

## 📊 Luồng hoạt động chi tiết

### Trước khi sửa (Lỗi 2 lần):
```
User nhấn "Hoàn tác" lần 1:
1. handleUndoResetPoints() được gọi
2. setToast("Đang hoàn tác...") → React re-render
3. resetBackup.data được truy cập
4. setResetBackup(null) → Backup bị xóa
5. User nhấn lại (hoặc re-render trigger lại)
6. handleUndoResetPoints() được gọi lại
7. Check: resetBackup === null → Báo lỗi ❌

User nhấn "Hoàn tác" lần 2:
1. Lúc này reset đã chạy xong, backup đã được tạo lại
2. Hoàn tác thành công ✅
```

### Sau khi sửa (OK 1 lần):
```
User nhấn "Hoàn tác":
1. handleUndoResetPoints() được gọi
2. Check: undoing === true? → Không, tiếp tục
3. Check: resetBackup exists? → Có, tiếp tục
4. backupData = resetBackup.data → Lưu vào local variable
5. setUndoing(true) → Khóa, ngăn gọi lại
6. setToast("Đang hoàn tác...")
7. updateDoc() với backupData (không dùng resetBackup.data)
8. await fetchStudents() → Load data mới
9. setResetBackup(null) → Xóa backup
10. setToast("Thành công!")
11. finally: setUndoing(false) → Mở khóa

Nếu user nhấn lại trong lúc đang undo:
1. handleUndoResetPoints() được gọi
2. Check: undoing === true? → Có, return ngay ✅
→ Không chạy lại, không báo lỗi
```

## 🧪 Test Cases

### Test 1: Click 1 lần bình thường
```
1. Reset điểm/xu
2. Nhấn "Hoàn tác" 1 lần
3. Đợi 2-3 giây
4. Kết quả: Hoàn tác thành công ✅
```

### Test 2: Click nhanh nhiều lần (spam click)
```
1. Reset điểm/xu
2. Nhấn "Hoàn tác" 5 lần liên tục
3. Kết quả: 
   - Lần 1: Chạy hoàn tác
   - Lần 2-5: Bị ignore (undoing === true)
   - Hoàn tác thành công 1 lần ✅
```

### Test 3: Mạng chậm
```
1. Reset điểm/xu
2. Throttle network về 3G slow
3. Nhấn "Hoàn tác"
4. Đợi loading (có thể lâu)
5. Kết quả: Vẫn hoàn tác thành công ✅
```

## 📝 Tóm tắt các thay đổi

### Cả 2 hàm undo (handleUndoResetPoints & handleUndoResetStudy):

1. **Thêm guard ngăn double execution**
   ```javascript
   if (undoing) return;
   ```

2. **Lưu backup vào local variable**
   ```javascript
   const backupData = resetBackup.data;
   ```

3. **Dùng backupData thay vì resetBackup.data**
   ```javascript
   const updatePromises = backupData.map(...)
   ```

4. **Đổi thứ tự: fetch trước, clear sau**
   ```javascript
   await fetchStudents();
   setResetBackup(null);
   ```

5. **Dùng finally để đảm bảo cleanup**
   ```javascript
   } finally {
       setUndoing(false);
   }
   ```

## ✨ Kết quả cuối cùng

- ✅ Nhấn "Hoàn tác" **1 lần duy nhất**
- ✅ Không báo lỗi "Không có dữ liệu để hoàn tác"
- ✅ Ngăn chặn spam click
- ✅ Xử lý tốt cả khi mạng chậm
- ✅ Dữ liệu được cập nhật ngay lập tức
- ✅ Backup chỉ bị xóa khi thành công

## 🎯 Bài học

1. **State trong React không đồng bộ**: Không nên dựa vào state trong async operations
2. **Luôn dùng local variables**: Cho dữ liệu quan trọng trong async flows
3. **Guard against double execution**: Đặc biệt với async operations
4. **Finally block**: Đảm bảo cleanup code luôn chạy
5. **Thứ tự operations**: Quan trọng để đảm bảo data integrity
