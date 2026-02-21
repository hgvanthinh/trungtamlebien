# Hybrid Architecture Migration Guide

## 📋 Tổng quan

Dự án đã được chuyển đổi từ kiến trúc **Cloud Functions Only** sang **Hybrid Architecture** để:
- ✅ **Tăng tốc độ**: Giảm latency bằng cách gọi trực tiếp Firestore thay vì qua Cloud Functions
- ✅ **Dễ debug**: Code chạy trực tiếp trên client, dễ dàng debug hơn
- ✅ **Giảm chi phí**: Ít invocation Cloud Functions hơn
- ✅ **Bảo mật vẫn đảm bảo**: Các tác vụ nhạy cảm vẫn dùng Cloud Functions

## 🏗️ Kiến trúc mới

### **Firestore Client SDK** (Direct Access)
Sử dụng cho các tác vụ CRUD thông thường:
- ✅ Lấy danh sách học sinh (`getAllStudents`)
- ✅ Lấy danh sách lớp học (`getAllClasses`)
- ✅ Tạo lớp học (`createClass`)
- ✅ Thêm/Xóa học sinh khỏi lớp (`addStudentToClass`, `removeStudentFromClass`)
- ✅ Lấy danh sách học sinh của lớp (`getClassStudents`)
- ✅ Xóa lớp học (`deleteClass`)
- ✅ Lưu buổi học (`saveSession`)
- ✅ Cập nhật thông tin học sinh (tên, avatar, ...)

### **Cloud Functions** (Sensitive Operations)
Chỉ sử dụng cho các tác vụ nhạy cảm và nguy hiểm:
- 🔒 Reset mật khẩu học sinh (`resetStudentPassword`)
- 🔒 Xóa tài khoản học sinh (`deleteStudent`)

## 📝 Những thay đổi đã thực hiện

### 1. **Firestore Rules** (`firestore.rules`)
```rules
// Cho phép admin query toàn bộ collection users
match /users/{document=**} {
  allow read: if isAdmin();
}

// Cho phép admin query toàn bộ collection classes
match /classes/{document=**} {
  allow read, write: if isAdmin();
}

// Cho phép admin query toàn bộ collection sessions
match /sessions/{document=**} {
  allow read, write: if isAdmin();
}
```

### 2. **Admin Service** (`src/services/adminService.js`)

#### ✅ Đã chuyển sang Firestore SDK:
```javascript
export const getAllStudents = async () => {
  // Query trực tiếp từ Firestore
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'student'));
  const querySnapshot = await getDocs(q);
  
  const students = [];
  querySnapshot.forEach((doc) => {
    students.push({
      uid: doc.id,
      ...doc.data(),
    });
  });
  
  return { success: true, students };
};
```

#### 🔒 Vẫn dùng Cloud Functions:
- `resetStudentPassword(email, newPassword)` - Reset mật khẩu
- `deleteStudent(uid)` - Xóa tài khoản

### 3. **Class Service** (`src/services/classService.js`)

Tất cả các hàm đã được chuyển sang Firestore SDK:

```javascript
// Tạo lớp học
export const createClass = async (name, grade) => {
  const classesRef = collection(db, 'classes');
  const docRef = await addDoc(classesRef, {
    name,
    grade,
    students: [],
    studentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true, classId: docRef.id };
};

// Thêm học sinh vào lớp
export const addStudentToClass = async (classId, studentUid) => {
  // Cập nhật class document
  const classRef = doc(db, 'classes', classId);
  await updateDoc(classRef, {
    students: arrayUnion(studentUid),
    studentCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  
  // Cập nhật user document
  const userRef = doc(db, 'users', studentUid);
  await updateDoc(userRef, {
    classes: arrayUnion(classId),
  });
  
  return { success: true };
};
```

### 4. **React Components**
✅ **KHÔNG CẦN THAY ĐỔI** - Vì interface của các service functions vẫn giữ nguyên!

## 🚀 Lợi ích

### Trước (Cloud Functions Only):
```
React Component → Cloud Function → Firestore
     ↓                  ↓              ↓
  ~50ms            ~500-2000ms      ~50ms
  
  TỔNG: ~600-2100ms (rất chậm!)
```

### Sau (Hybrid):
```
React Component → Firestore
     ↓                ↓
  ~50ms           ~50-100ms
  
  TỔNG: ~100-150ms (nhanh gấp 6-20 lần!)
```

## 🔐 Bảo mật

### Firestore Rules đảm bảo:
1. ✅ Chỉ admin mới có thể query collection `users`, `classes`, `sessions`
2. ✅ Học sinh chỉ có thể đọc document của chính mình
3. ✅ Học sinh không thể thay đổi `role`, `email`, `classes`

### Cloud Functions đảm bảo:
1. 🔒 Reset mật khẩu phải qua Cloud Function (không thể làm từ client)
2. 🔒 Xóa tài khoản phải qua Cloud Function (xóa cả Auth + Firestore)

## 📊 So sánh

| Tác vụ | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Lấy danh sách HS | Cloud Function | Firestore SDK | ⚡ Nhanh hơn 10-20x |
| Lấy danh sách lớp | Cloud Function | Firestore SDK | ⚡ Nhanh hơn 10-20x |
| Thêm HS vào lớp | Cloud Function | Firestore SDK | ⚡ Nhanh hơn 10-20x |
| Tạo lớp học | Cloud Function | Firestore SDK | ⚡ Nhanh hơn 10-20x |
| Reset mật khẩu | Cloud Function | Cloud Function | ⚠️ Giữ nguyên (bảo mật) |
| Xóa tài khoản | Cloud Function | Cloud Function | ⚠️ Giữ nguyên (bảo mật) |

## 🛠️ Cách sử dụng

### Development (với Emulators):
```bash
# Terminal 1: Chạy Firebase Emulators
firebase emulators:start

# Terminal 2: Chạy React App
npm run dev
```

### Production:
```bash
# Deploy Firestore Rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions (chỉ còn 2 functions)
firebase deploy --only functions

# Build React App
npm run build
```

## ⚠️ Lưu ý quan trọng

1. **Firestore Rules phải được deploy trước** khi sử dụng:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Admin phải đăng nhập** với email `admin@thaybien.com` để có quyền truy cập

3. **Cloud Functions vẫn cần thiết** cho:
   - Reset mật khẩu
   - Xóa tài khoản

4. **Offline support**: Firestore SDK hỗ trợ offline cache tự động!

## 🎯 Kết luận

Kiến trúc Hybrid giúp:
- ⚡ **Tăng tốc độ** đáng kể (nhanh hơn 10-20 lần)
- 🐛 **Dễ debug** hơn (code chạy trên client)
- 💰 **Giảm chi phí** Cloud Functions
- 🔒 **Vẫn bảo mật** với Firestore Rules + Cloud Functions cho tác vụ nhạy cảm

**Đây là best practice cho Firebase + React!** 🎉
