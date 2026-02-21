import { useState, useRef } from 'react';
import Icon from '../common/Icon';
import Avatar from '../common/Avatar';

const AvatarUpload = ({ currentAvatar, userName, borderUrl, onUpload, isLoading }) => {
  const [preview, setPreview] = useState(currentAvatar);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (max 10MB trước khi nén)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Kích thước ảnh gốc không được vượt quá 10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Call upload handler (sẽ tự động nén xuống dưới 200KB)
    onUpload(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Preview */}
      <div
        className={`relative group cursor-pointer ${isDragging ? 'ring-4 ring-primary' : ''
          }`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Avatar src={preview} name={userName} size="xl" borderUrl={borderUrl} />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {isLoading ? (
            <Icon name="progress_activity" className="text-white text-3xl animate-spin" />
          ) : (
            <div className="text-center">
              <Icon name="photo_camera" className="text-white text-3xl mb-1" />
              <p className="text-white text-xs">Thay đổi</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Instructions */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Click hoặc kéo thả ảnh để tải lên
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          JPG, PNG, GIF, WebP (tối đa 10MB)
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isLoading}
      />
    </div>
  );
};

export default AvatarUpload;
