# 🔍 Troubleshooting Reset Password

## ❌ Vấn đề: "auth/invalid-credential"

Lỗi này xảy ra khi:
1. **Email không đúng**
2. **Password không đúng**
3. **Password chưa được reset thành công**

---

## 🧪 Cách kiểm tra

### 1. Kiểm tra email của học sinh

Mở **Firebase Console** → **Authentication** → Tìm học sinh:
- Xem email chính xác là gì
- Ví dụ: `hocsinh@quiz.com` hay `hocsinh@thaybien.com`?

### 2. Kiểm tra Cloud Function logs

Mở **Firebase Console** → **Functions** → **resetStudentPassword** → **Logs**:

**Nếu thành công, sẽ thấy:**
```
✅ Password reset successful for hocsinh@quiz.com
```

**Nếu lỗi, sẽ thấy:**
```
❌ Error resetting password: ...
```

### 3. Test reset password qua Postman/cURL

```bash
curl -X POST https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net/resetStudentPassword \
  -H "Content-Type: application/json" \
  -d '{
    "adminToken": "admin_thaybien2025",
    "studentEmail": "hocsinh@quiz.com",
    "newPassword": "123456"
  }'
```

**Response mong đợi:**
```json
{
  "success": true,
  "message": "Đã reset mật khẩu thành công"
}
```

---

## ✅ Giải pháp

### Option 1: Reset password trực tiếp trong Firebase Console

1. Mở **Firebase Console** → **Authentication**
2. Tìm học sinh
3. Click **...** → **Reset password**
4. Gửi email reset password

### Option 2: Tạo password mới trong Firebase Console

1. Mở **Firebase Console** → **Authentication**
2. Tìm học sinh
3. Click **Edit** (icon bút chì)
4. Nhập password mới
5. Click **Save**

### Option 3: Kiểm tra email format

Trong code đăng ký, email được tạo như thế nào?

**Ví dụ:**
```javascript
// Nếu username = "hocsinh"
const email = `${username}@quiz.com`; // hocsinh@quiz.com
// hoặc
const email = `${username}@thaybien.com`; // hocsinh@thaybien.com
```

**Đảm bảo email trong reset password khớp với email khi đăng ký!**

---

## 🔍 Debug Steps

### 1. Check student data trong Firestore

```javascript
// Trong DevTools Console
const student = await getDocs(query(collection(db, 'users'), where('username', '==', 'hocsinh')));
student.forEach(doc => console.log(doc.data()));
// Xem email là gì
```

### 2. Check Auth user

Mở **Firebase Console** → **Authentication** → Tìm user:
- Email: `hocsinh@quiz.com` hay `hocsinh@thaybien.com`?
- UID: Khớp với Firestore document không?

### 3. Test login với password cũ

Trước khi reset, hãy test login với password cũ:
- Nếu login được → Password cũ vẫn đúng
- Nếu không login được → Có vấn đề với Auth

---

## 💡 Khuyến nghị

### Tạo học sinh test mới

1. **Đăng ký học sinh mới:**
   - Username: `testuser`
   - Password: `123456`

2. **Login với testuser:**
   - Email: `testuser@quiz.com`
   - Password: `123456`

3. **Reset password:**
   - New password: `newpass123`

4. **Login lại:**
   - Email: `testuser@quiz.com`
   - Password: `newpass123`

**Nếu hoạt động → Cloud Function OK!**  
**Nếu không hoạt động → Có vấn đề với Cloud Function**

---

## 📞 Next Steps

1. ✅ Check Firebase Console → Authentication → Email của học sinh
2. ✅ Check Firebase Console → Functions → Logs
3. ✅ Test với học sinh mới
4. ✅ Verify email format khớp

**Hãy thử các bước trên và báo lại kết quả! 🚀**
