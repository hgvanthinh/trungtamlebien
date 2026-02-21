# 🎯 Quick Start - Hybrid Architecture

## 🚀 Development

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Chạy React App
```bash
npm run dev
```

### 3. Truy cập
- React App: http://localhost:5173

**Lưu ý:** Dự án sử dụng **Production Firebase** (không dùng emulators)

---

## 📦 Production Deployment

### Quick Deploy (Recommended)
```bash
# Deploy tất cả
firebase deploy
```

### Selective Deploy
```bash
# 1. Deploy Firestore Rules (BẮT BUỘC nếu có thay đổi)
firebase deploy --only firestore:rules

# 2. Deploy Cloud Functions (chỉ khi cần)
firebase deploy --only functions

# 3. Deploy React App
npm run build
firebase deploy --only hosting
```

---

## 🏗️ Kiến trúc

### Firestore Client SDK (Direct Access)
✅ Lấy danh sách học sinh  
✅ Lấy danh sách lớp học  
✅ Tạo/Sửa/Xóa lớp học  
✅ Thêm/Xóa học sinh khỏi lớp  
✅ Lưu buổi học  

### Cloud Functions (Sensitive Operations)
🔒 Reset mật khẩu học sinh  
🔒 Xóa tài khoản học sinh  

---

## 📚 Documentation

- `HYBRID_ARCHITECTURE.md` - Chi tiết về kiến trúc Hybrid
- `MIGRATION_SUMMARY.md` - Tóm tắt migration
- `DEPLOYMENT_CHECKLIST.md` - Checklist deploy
- `MIGRATION_GUIDE.md` - Hướng dẫn migration (cũ)

---

## ⚡ Performance

| Tác vụ | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Lấy danh sách HS | 600-2100ms | 100-150ms | **6-20x** ⚡ |
| Lấy danh sách lớp | 600-2100ms | 100-150ms | **6-20x** ⚡ |
| Thêm HS vào lớp | 600-2100ms | 150-200ms | **4-14x** ⚡ |

---

## 🔐 Admin Login

- Email: `admin@thaybien.com`
- Password: (your admin password)

---

## ⚠️ Important Notes

1. **Firestore Rules phải được deploy** trước khi sử dụng Hybrid Architecture
2. **Admin phải đăng nhập** với email `admin@thaybien.com`
3. **Cloud Functions vẫn cần thiết** cho reset password và delete account

---

## 🐛 Troubleshooting

### "Missing or insufficient permissions"
```bash
firebase deploy --only firestore:rules
```

### "Admin không có quyền"
Login với email `admin@thaybien.com`

### Latency vẫn cao
1. Check Network tab trong DevTools
2. Verify Firestore Rules đã deploy
3. Clear browser cache

---

**Happy coding! 🎉**
