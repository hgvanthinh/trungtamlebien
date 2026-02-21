import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar, deleteAvatar } from '../services/storageService';
import { getStudentClasses } from '../services/classService';
import AvatarUpload from '../components/profile/AvatarUpload';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import Toast from '../components/common/Toast';
import GoldIcon from '../components/common/GoldIcon';

const Profile = () => {
  const { userProfile, currentUser, updateProfile } = useAuth();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    fullName: userProfile?.fullName || '',
  });

  useEffect(() => {
    loadClasses();
  }, [userProfile]);

  const loadClasses = async () => {
    if (userProfile?.classes && userProfile.classes.length > 0) {
      const result = await getStudentClasses(userProfile.classes);
      if (result.success) {
        setClasses(result.classes);
      }
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!currentUser) return;

    setIsUploadingAvatar(true);

    try {
      // Xóa avatar cũ trên Storage (nếu có) trước khi upload mới
      if (userProfile?.avatar) {
        await deleteAvatar(userProfile.avatar);
      }

      // Upload ảnh mới lên Storage
      const result = await uploadAvatar(currentUser.uid, file);

      if (result.success) {
        // Cập nhật avatar URL vào Firestore
        const updateResult = await updateProfile({ avatar: result.url });

        if (updateResult.success) {
          setToast({ type: 'success', message: 'Cập nhật ảnh đại diện thành công!' });
        } else {
          setToast({ type: 'error', message: updateResult.error || 'Cập nhật thất bại' });
        }
      } else {
        setToast({ type: 'error', message: result.error });
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setToast({ type: 'error', message: 'Có lỗi xảy ra khi upload ảnh' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!formData.fullName.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập họ tên' });
      return;
    }

    const result = await updateProfile({
      fullName: formData.fullName,
    });

    if (result.success) {
      setToast({ type: 'success', message: 'Cập nhật thông tin thành công!' });
      setIsEditing(false);
    } else {
      setToast({ type: 'error', message: result.error || 'Cập nhật thất bại' });
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      fullName: userProfile?.fullName || '',
    });
    setIsEditing(false);
  };

  // Lấy danh sách tên lớp mà học sinh tham gia
  const getUserClasses = () => {
    if (!userProfile?.classes || userProfile.classes.length === 0) {
      return [];
    }
    return userProfile.classes
      .map(classId => {
        const cls = classes.find(c => c.id === classId);
        return cls ? cls.name : null;
      })
      .filter(Boolean);
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Hồ sơ cá nhân</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Section */}
        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-center">Ảnh đại diện</h2>
              <AvatarUpload
                currentAvatar={userProfile.avatar}
                userName={userProfile.fullName}
                borderUrl={userProfile.activeAvatarBorder}
                onUpload={handleAvatarUpload}
                isLoading={isUploadingAvatar}
              />
            </div>
          </Card>
        </div>

        {/* Profile Info Section */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
                {!isEditing && (
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                  >
                    <Icon name="edit" />
                    Chỉnh sửa
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {/* Username (readonly) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tên đăng nhập
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <Icon name="person" className="text-gray-500" />
                    <span className="text-gray-800 dark:text-gray-200">
                      {userProfile.username}
                    </span>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Họ và tên
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="clay-input w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 dark:text-white"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <Icon name="badge" className="text-gray-500" />
                      <span className="text-gray-800 dark:text-gray-200">
                        {userProfile.fullName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Classes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lớp học
                  </label>
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-start gap-2">
                      <Icon name="school" className="text-gray-500 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        {getUserClasses().length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {getUserClasses().map((className, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm font-medium"
                              >
                                {className}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            Chưa được phân lớp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Buttons */}
                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="primary"
                      onClick={handleSaveProfile}
                      className="flex-1 clay-btn-primary"
                    >
                      <Icon name="check" className="mr-2" />
                      Lưu thay đổi
                    </Button>
                    <Button variant="secondary" onClick={handleCancelEdit} className="flex-1">
                      <Icon name="close" className="mr-2" />
                      Hủy
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Points & Coins Section */}
          <Card className="mt-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-6 text-center">Điểm số & Xu</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Điểm tích lũy */}
                <div className="flex flex-col items-center justify-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Điểm tích lũy</p>
                  <div className={`relative p-6 rounded-3xl ${(userProfile.totalBehaviorPoints || 0) >= 0
                    ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/20'
                    : 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/20'
                    }`}>
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className={`p-3 rounded-full ${(userProfile.totalBehaviorPoints || 0) >= 0
                        ? 'bg-green-500 dark:bg-green-600'
                        : 'bg-red-500 dark:bg-red-600'
                        }`}>
                        <Icon
                          name={(userProfile.totalBehaviorPoints || 0) >= 0 ? "star" : "warning"}
                          className="text-white text-2xl"
                        />
                      </div>
                    </div>
                    <div className="text-center mt-4">
                      <p className={`text-5xl font-bold mb-2 ${(userProfile.totalBehaviorPoints || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                        }`}>
                        {userProfile.totalBehaviorPoints || 0}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        điểm
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(userProfile.totalBehaviorPoints || 0) >= 0
                        ? '🎉 Tiếp tục phát huy!'
                        : '💪 Cố gắng lên nào!'}
                    </p>
                  </div>
                </div>

                {/* Xu */}
                <div className="flex flex-col items-center justify-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Xu</p>
                  <div className="relative p-6 rounded-3xl bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900/30 dark:to-amber-800/20">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="p-3 rounded-full bg-yellow-500 dark:bg-yellow-600">
                        <Icon
                          name="paid"
                          className="text-white text-2xl"
                        />
                      </div>
                    </div>
                    <div className="text-center mt-4">
                      <p className="text-5xl font-bold mb-2 text-yellow-600 dark:text-yellow-400">
                        {userProfile.coins || 0}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        xu
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tích lũy từ hành vi tốt
                    </p>
                  </div>
                </div>

                {/* Đồng Vàng */}
                <div className="flex flex-col items-center justify-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Đồng Vàng</p>
                  <div className="relative p-6 rounded-3xl bg-gradient-to-br from-amber-100 to-yellow-200 dark:from-amber-900/30 dark:to-yellow-800/20">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="p-2 rounded-full bg-amber-500 dark:bg-amber-600">
                        <GoldIcon size={32} />
                      </div>
                    </div>
                    <div className="text-center mt-4">
                      <p className="text-5xl font-bold mb-2 text-amber-600 dark:text-amber-400">
                        {userProfile.gold || 0}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        đồng vàng
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                      <GoldIcon size={14} /> Chế tạo từ Xu
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Profile;
