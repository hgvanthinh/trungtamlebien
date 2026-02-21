import { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../../config/firebase';
import { useBackground } from '../../contexts/BackgroundContext';
import Card from '../../components/common/Card';
import Icon from '../../components/common/Icon';

const BackgroundSettings = () => {
  const { backgroundImage, backgroundOpacity, backgroundImageMobile, updateBackground, removeBackground } = useBackground();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempOpacity, setTempOpacity] = useState(backgroundOpacity);
  const [tempImageUrl, setTempImageUrl] = useState(backgroundImage);
  const [tempImageUrlMobile, setTempImageUrlMobile] = useState(backgroundImageMobile || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileMobile, setSelectedFileMobile] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFileSelect = (e, isMobile = false) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra loại file
    if (!file.type.startsWith('image/')) {
      showNotification('Vui lòng chọn file ảnh!', 'error');
      return;
    }

    // Kiểm tra kích thước file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Kích thước ảnh không được vượt quá 5MB!', 'error');
      return;
    }

    // Lưu file để upload sau khi nhấn "Lưu cài đặt"
    if (isMobile) {
      setSelectedFileMobile(file);
    } else {
      setSelectedFile(file);
    }

    // Tạo preview local (KHÔNG upload lên Storage ngay)
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isMobile) {
        setTempImageUrlMobile(reader.result);
      } else {
        setTempImageUrl(reader.result);
      }
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleOpacityChange = (value) => {
    const opacity = parseFloat(value);
    setTempOpacity(opacity);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setUploading(true);
      let finalImageUrl = tempImageUrl;
      let finalImageUrlMobile = tempImageUrlMobile;

      // UPLOAD ẢNH DESKTOP LÊN FIREBASE STORAGE
      if (selectedFile) {
        const timestamp = Date.now();
        const fileExtension = selectedFile.name.split('.').pop();
        const storageRef = ref(storage, `backgrounds/bg_desktop_${timestamp}.${fileExtension}`);

        // Upload file lên Storage
        await uploadBytes(storageRef, selectedFile);

        // Lấy URL download
        finalImageUrl = await getDownloadURL(storageRef);
      }

      // UPLOAD ẢNH MOBILE LÊN FIREBASE STORAGE (nếu có)
      if (selectedFileMobile) {
        const timestamp = Date.now();
        const fileExtension = selectedFileMobile.name.split('.').pop();
        const storageRef = ref(storage, `backgrounds/bg_mobile_${timestamp}.${fileExtension}`);

        // Upload file lên Storage
        await uploadBytes(storageRef, selectedFileMobile);

        // Lấy URL download
        finalImageUrlMobile = await getDownloadURL(storageRef);
      }

      setUploading(false);

      // Lưu vào localStorage cho admin
      updateBackground(finalImageUrl, tempOpacity, finalImageUrlMobile);

      // Lưu vào Firestore để áp dụng cho tất cả người dùng (bao gồm học sinh)
      await setDoc(doc(db, 'settings', 'background'), {
        imageUrl: finalImageUrl,
        imageUrlMobile: finalImageUrlMobile,
        opacity: tempOpacity,
        applyToStudents: true, // Mặc định luôn áp dụng cho học sinh
        updatedAt: new Date().toISOString(),
      });

      // Reset state
      setTempImageUrl(finalImageUrl);
      setTempImageUrlMobile(finalImageUrlMobile);
      setSelectedFile(null);
      setSelectedFileMobile(null);
      setHasChanges(false);
      showNotification('Lưu cài đặt hình nền thành công!', 'success');
    } catch (error) {
      console.error('Error saving background:', error);
      showNotification('Lỗi khi lưu cài đặt: ' + error.message, 'error');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleRemoveBackground = async (isMobile = false) => {
    try {
      setSaving(true);

      if (isMobile) {
        // Chỉ xóa hình mobile
        setTempImageUrlMobile('');
        setSelectedFileMobile(null);

        // Cập nhật Firestore
        await setDoc(doc(db, 'settings', 'background'), {
          imageUrl: tempImageUrl,
          imageUrlMobile: '',
          opacity: tempOpacity,
          applyToStudents: true, // Luôn áp dụng cho học sinh
          updatedAt: new Date().toISOString(),
        });

        showNotification('Đã xóa hình nền mobile!', 'success');
      } else {
        // Xóa tất cả
        removeBackground();

        await setDoc(doc(db, 'settings', 'background'), {
          imageUrl: '',
          imageUrlMobile: '',
          opacity: 0.3,
          applyToStudents: true, // Vẫn giữ setting này
          updatedAt: new Date().toISOString(),
        });

        setTempImageUrl('');
        setTempImageUrlMobile('');
        setTempOpacity(0.3);
        setSelectedFile(null);
        setSelectedFileMobile(null);
        showNotification('Đã xóa tất cả hình nền!', 'success');
      }

      setHasChanges(false);
    } catch (error) {
      console.error('Error removing background:', error);
      showNotification('Lỗi khi xóa hình nền: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg animate-slide-in-right ${
            notification.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name={notification.type === 'success' ? 'check_circle' : 'error'} />
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Cài đặt hình nền
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Tùy chỉnh hình nền cho giao diện hệ thống
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Xem trước hình nền
            </label>
            <div
              className="relative w-full h-64 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600"
              style={{
                backgroundImage: tempImageUrl ? `url(${tempImageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {tempImageUrl && (
                <div
                  className="absolute inset-0 bg-background-light dark:bg-background-dark"
                  style={{ opacity: 1 - tempOpacity }}
                />
              )}
              {!tempImageUrl && (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
                  <div className="text-center">
                    <Icon name="image" className="text-6xl mb-2" />
                    <p>Chưa có hình nền</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button Desktop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="computer" />
                <span>Hình nền cho máy tính</span>
              </div>
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, false)}
                  disabled={uploading || saving}
                  className="hidden"
                />
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    uploading || saving
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'border-primary hover:bg-primary/10 dark:hover:bg-primary/20'
                  }`}
                >
                  <Icon name={uploading ? 'hourglass_empty' : 'upload'} />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {uploading ? 'Đang upload...' : 'Chọn ảnh Desktop'}
                  </span>
                </div>
              </label>

              {tempImageUrl && (
                <button
                  onClick={() => handleRemoveBackground(false)}
                  disabled={uploading || saving}
                  className="px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Icon name="delete" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Khuyến nghị: Ảnh ngang, độ phân giải cao (ví dụ: 1920x1080)
            </p>
          </div>

          {/* Upload Button Mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="smartphone" />
                <span>Hình nền cho điện thoại (tùy chọn)</span>
              </div>
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, true)}
                  disabled={uploading || saving}
                  className="hidden"
                />
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    uploading || saving
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'border-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/20'
                  }`}
                >
                  <Icon name={uploading ? 'hourglass_empty' : 'upload'} />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {uploading ? 'Đang upload...' : tempImageUrlMobile ? 'Thay đổi ảnh Mobile' : 'Chọn ảnh Mobile'}
                  </span>
                </div>
              </label>

              {tempImageUrlMobile && (
                <button
                  onClick={() => handleRemoveBackground(true)}
                  disabled={uploading || saving}
                  className="px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Icon name="delete" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {tempImageUrlMobile
                ? 'Khuyến nghị: Ảnh dọc, tối ưu cho màn hình điện thoại (ví dụ: 1080x1920)'
                : 'Nếu không chọn, sẽ dùng hình nền Desktop cho cả mobile'
              }
            </p>
          </div>

          {/* Opacity Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Độ rõ của hình nền: {Math.round(tempOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={tempOpacity}
              onChange={(e) => handleOpacityChange(e.target.value)}
              disabled={!tempImageUrl || uploading || saving}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Mờ nhất (0%)</span>
              <span>Rõ nhất (100%)</span>
            </div>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={uploading || saving}
                className="flex-1 clay-btn-primary px-6 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Icon name="hourglass_empty" className="animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Icon name="save" />
                    <span>Lưu cài đặt</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex gap-3">
              <Icon name="info" className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Lưu ý:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                  <li>Hình nền áp dụng cho tất cả người dùng (Admin và Học sinh)</li>
                  <li>Desktop và Mobile có thể dùng hình nền riêng hoặc chung</li>
                  <li>Nhớ nhấn "Lưu cài đặt" sau khi thay đổi</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BackgroundSettings;
