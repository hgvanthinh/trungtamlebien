# Hướng dẫn Migration: Chuyển sang Hybrid Architecture

## Tổng quan

Đã chuyển từ kiến trúc **100% Cloud Functions** sang **Hybrid Architecture**:
- ✅ CRUD thông thường: Gọi trực tiếp Firestore từ React
- ✅ Tác vụ nhạy cảm: Vẫn dùng Cloud Functions

## Lợi ích

1. **Tăng tốc độ**: Không còn round-trip qua Cloud Functions
2. **Giảm latency**: Gọi trực tiếp Firestore nhanh hơn 3-5 lần
3. **Dễ debug**: Xem data trực tiếp trong DevTools
4. **Tiết kiệm chi phí**: Ít invocations cho Cloud Functions

## Các bước thực hiện

### Bước 1: Thay thế file service

```bash
# Xóa file cũ và đổi tên file mới
rm src/services/adminService.js
mv src/services/adminService.new.js src/services/adminService.js

rm src/services/classService.js
mv src/services/classService.new.js src/services/classService.js
```

### Bước 2: Cập nhật imports trong components

**Không cần thay đổi gì!** Các component đang import từ `adminService` và `classService` sẽ tự động dùng code mới.

### Bước 3: Kiểm tra kết quả

1. Mở DevTools → Network tab
2. Thử load danh sách học sinh
3. **Trước đây**: Thấy request đến Cloud Functions URL
4. **Bây giờ**: Thấy request đến Firestore API (firestore.googleapis.com)

### Bước 4: Test bảo mật

1. Đăng nhập bằng `admin@thaybien.com` → ✅ Có thể đọc/ghi
2. Đăng nhập bằng tài khoản học sinh → ❌ Không thể đọc danh sách học sinh khác
3. Đăng xuất → ❌ Không thể truy cập gì

## So sánh Code

### Trước (Cloud Functions)

```javascript
// adminService.js (CŨ)
export const getAllStudents = async () => {
  const response = await fetch(`${FUNCTIONS_URL}/getAllStudents`, {
    method: 'POST',
    body: JSON.stringify({ adminToken }),
  });
  return await response.json();
};
```

**Vấn đề:**
- Phải chờ HTTP request + Cloud Function cold start
- Latency: ~500-2000ms
- Khó debug (không thấy data trong DevTools)

### Sau (Firestore SDK)

```javascript
// adminService.js (MỚI)
export const getAllStudents = async () => {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'student')
  );
  const snapshot = await getDocs(q);

  const students = [];
  snapshot.forEach(doc => {
    students.push({ uid: doc.id, ...doc.data() });
  });

  return { success: true, students };
};
```

**Lợi ích:**
- Gọi trực tiếp Firestore
- Latency: ~50-200ms
- Dễ debug (thấy data trong Firestore DevTools Extension)

## Cloud Functions còn lại (Chỉ dùng cho tác vụ nhạy cảm)

Danh sách functions **VẪN GIỮ LẠI**:

1. ✅ `resetStudentPassword` - Đổi mật khẩu (Admin only)
2. ✅ `deleteStudent` - Xóa tài khoản (Admin only)

Các functions **ĐÃ XÓA** (thay bằng Firestore SDK):

- ❌ `getAllStudents` → Dùng `getDocs()`
- ❌ `createClass` → Dùng `addDoc()`
- ❌ `getAllClasses` → Dùng `getDocs()`
- ❌ `addStudentToClass` → Dùng `updateDoc()` + `arrayUnion()`
- ❌ `removeStudentFromClass` → Dùng `updateDoc()` + `arrayRemove()`
- ❌ `getClassStudents` → Dùng `getDoc()`
- ❌ `deleteClass` → Dùng `deleteDoc()`
- ❌ `saveSession` → Dùng `addDoc()`

## Firestore Security Rules

File `firestore.rules` đã được deploy với logic:

```
✅ Admin (admin@thaybien.com): Full access
✅ Học sinh: Chỉ đọc data của chính mình
❌ Anonymous: Không có quyền gì
```

## Rollback (Nếu cần)

Nếu có vấn đề, bạn có thể rollback:

```bash
# Khôi phục file cũ từ Git
git checkout src/services/adminService.js
git checkout src/services/classService.js

# Hoặc đổi lại tên file
mv src/services/adminService.js src/services/adminService.new.js
mv src/services/adminService.old.js src/services/adminService.js
```

## Testing Checklist

- [ ] Load danh sách học sinh: Nhanh hơn trước
- [ ] Tạo lớp học mới: Hoạt động OK
- [ ] Thêm/xóa học sinh khỏi lớp: Hoạt động OK
- [ ] Reset mật khẩu: Vẫn gọi Cloud Function
- [ ] Xóa học sinh: Vẫn gọi Cloud Function
- [ ] Đăng xuất → Không thể truy cập data: Bảo mật OK

## Lưu ý

1. **Emulator**: Firestore rules cũng áp dụng cho emulator
2. **Index**: Nếu gặp lỗi "index required", làm theo link Firebase cung cấp
3. **Offline**: Firestore SDK hỗ trợ offline cache tự động
