import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { deleteAvatar } from '../../services/storageService';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Avatar from '../common/Avatar';

const EditStudentModal = ({ student, onClose, onSuccess }) => {
    const [fullName, setFullName] = useState(student.fullName);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

    const handleSave = async () => {
        if (!fullName.trim()) {
            alert('Vui lòng nhập họ tên');
            return;
        }

        setIsLoading(true);
        try {
            const userRef = doc(db, 'users', student.uid);
            await updateDoc(userRef, {
                fullName: fullName.trim(),
            });

            onSuccess('Đã cập nhật họ tên!');
            onClose();
        } catch (error) {
            console.error('Error updating name:', error);
            alert('Lỗi khi cập nhật họ tên');
        }
        setIsLoading(false);
    };

    const handleDeleteAvatar = async () => {
        if (!student.avatar) {
            alert('Học sinh chưa có avatar');
            return;
        }

        if (!confirm('Bạn có chắc muốn xóa avatar của học sinh này?')) {
            return;
        }

        setIsDeletingAvatar(true);
        try {
            // Xóa avatar từ Storage (dùng service tập trung)
            await deleteAvatar(student.avatar);

            // Cập nhật Firestore
            const userRef = doc(db, 'users', student.uid);
            await updateDoc(userRef, {
                avatar: '',
            });

            onSuccess('Đã xóa avatar!');
            onClose();
        } catch (error) {
            console.error('Error deleting avatar:', error);
            alert('Lỗi khi xóa avatar: ' + error.message);
        }
        setIsDeletingAvatar(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="clay-card max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Chỉnh sửa học sinh
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        disabled={isLoading || isDeletingAvatar}
                    >
                        <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Student Info */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar
                            src={student.avatar}
                            name={student.fullName}
                            size="lg"
                        />
                        <div>
                            <p className="font-bold text-gray-800 dark:text-white">
                                @{student.username}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {student.email}
                            </p>
                        </div>
                    </div>

                    {/* Delete Avatar Button */}
                    {student.avatar && (
                        <button
                            onClick={handleDeleteAvatar}
                            disabled={isDeletingAvatar}
                            className="w-full mt-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeletingAvatar ? (
                                <>
                                    <Icon name="progress_activity" className="animate-spin" />
                                    Đang xóa avatar...
                                </>
                            ) : (
                                <>
                                    <Icon name="delete" />
                                    Xóa avatar
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Edit Name Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Họ và tên
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="clay-input w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 dark:text-white"
                            placeholder="Nhập họ và tên"
                            disabled={isLoading || isDeletingAvatar}
                            autoFocus
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSave}
                            className="flex-1 clay-btn-primary"
                            disabled={isLoading || isDeletingAvatar}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Icon name="progress_activity" className="animate-spin" />
                                    Đang lưu...
                                </span>
                            ) : (
                                <>
                                    <Icon name="save" className="mr-2" />
                                    Lưu thay đổi
                                </>
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isLoading || isDeletingAvatar}
                        >
                            Hủy
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditStudentModal;
