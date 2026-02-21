# Hướng dẫn cấu hình CORS cho Firebase Storage

## Vấn đề
PDF.js không thể load PDF từ Firebase Storage vì lỗi CORS (Cross-Origin Resource Sharing).

## Giải pháp: Cấu hình CORS cho Firebase Storage Bucket

### Bước 1: Cài đặt Google Cloud SDK (nếu chưa có)

**Windows:**
1. Tải về từ: https://cloud.google.com/sdk/docs/install
2. Chạy installer và làm theo hướng dẫn
3. Mở **Command Prompt** (CMD) hoặc **PowerShell** mới

**macOS/Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Bước 2: Đăng nhập vào Google Cloud

```bash
gcloud auth login
```

Trình duyệt sẽ mở ra, đăng nhập bằng tài khoản Google của bạn (tài khoản quản lý Firebase project).

### Bước 3: Tìm tên Firebase Storage Bucket

**Cách 1: Từ Firebase Console**
1. Vào https://console.firebase.google.com
2. Chọn project của bạn
3. Vào **Storage** > **Files**
4. Sao chép phần đầu URL, ví dụ: `gs://your-project.appspot.com`
5. Bucket name là: `your-project.appspot.com`

**Cách 2: Từ file firebase.js**
- Mở `src/config/firebase.js`
- Tìm `storageBucket: "xxxxx.appspot.com"`
- Đó chính là bucket name

### Bước 4: Áp dụng CORS configuration

Trong thư mục project (nơi có file `cors.json`), chạy lệnh:

```bash
gsutil cors set cors.json gs://YOUR-BUCKET-NAME.appspot.com
```

**Ví dụ:**
```bash
gsutil cors set cors.json gs://trungtamdaythem-react.appspot.com
```

### Bước 5: Kiểm tra CORS đã được cấu hình

```bash
gsutil cors get gs://YOUR-BUCKET-NAME.appspot.com
```

Bạn sẽ thấy output:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600
  }
]
```

### Bước 6: Test lại ứng dụng

1. Hard refresh browser (Ctrl+Shift+R)
2. Vào `/admin/grade-submissions`
3. Click "Chấm điểm"
4. Click "Ghi chú lên bài"
5. PDF bây giờ sẽ load thành công! ✅

## Giải thích CORS configuration

```json
{
  "origin": ["*"],           // Cho phép tất cả origins (localhost, production domain, etc.)
  "method": ["GET", "HEAD"], // Cho phép GET và HEAD requests
  "maxAgeSeconds": 3600      // Cache CORS preflight trong 1 giờ
}
```

## Lưu ý bảo mật (Production)

Trong production, nên giới hạn `origin` cụ thể:

```json
[
  {
    "origin": [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://your-domain.com"
    ],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600
  }
]
```

## Troubleshooting

### Lỗi: "gsutil: command not found"
- Google Cloud SDK chưa được cài đặt hoặc chưa được thêm vào PATH
- Giải pháp: Cài đặt lại Google Cloud SDK và restart terminal

### Lỗi: "AccessDeniedException: 403"
- Tài khoản không có quyền truy cập bucket
- Giải pháp: Đảm bảo đăng nhập đúng tài khoản owner/editor của Firebase project

### Lỗi: "BucketNotFoundException"
- Bucket name sai
- Giải pháp: Kiểm tra lại bucket name từ Firebase Console

### CORS vẫn bị block sau khi setup
- Browser cache
- Giải pháp: Hard refresh (Ctrl+Shift+R) hoặc clear browser cache

## Tài liệu tham khảo

- Firebase Storage CORS: https://firebase.google.com/docs/storage/web/download-files#cors_configuration
- Google Cloud CORS: https://cloud.google.com/storage/docs/configuring-cors
