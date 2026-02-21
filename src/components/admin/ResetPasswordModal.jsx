import { useState } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';

const ResetPasswordModal = ({ student, onClose, onReset }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    await onReset(newPassword);  // ✅ Chỉ truyền newPassword
    setIsLoading(false);

    // Lưu password và hiển thị thông báo thành công
    setResetPassword(newPassword);
    setResetSuccess(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(resetPassword);
    alert('Đã copy mật khẩu!');
  };

  const handleClose = () => {
    setResetSuccess(false);
    setResetPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="clay-card max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Reset mật khẩu
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            disabled={isLoading}
          >
            <Icon name="close" className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Học sinh:</strong> {student.fullName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <strong>Email:</strong> {student.email}
          </p>
        </div>

        {resetSuccess ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-700 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="check_circle" className="text-green-600 dark:text-green-400 text-2xl" />
                <p className="text-green-600 dark:text-green-400 font-bold">
                  Reset mật khẩu thành công!
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-300 dark:border-green-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <strong>Mật khẩu mới:</strong>
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white">
                    {resetPassword}
                  </code>
                  <button
                    onClick={handleCopyPassword}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    title="Copy mật khẩu"
                  >
                    <Icon name="content_copy" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                ⚠️ <strong>Lưu ý:</strong> Hãy ghi nhớ hoặc copy mật khẩu này. Học sinh sẽ cần dùng mật khẩu này để đăng nhập.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleClose}
              className="w-full clay-btn-primary"
            >
              <Icon name="check" className="mr-2" />
              Đóng
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="clay-input w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 dark:text-white"
                placeholder="Nhập mật khẩu mới"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="clay-input w-full px-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary text-gray-800 dark:text-white"
                placeholder="Nhập lại mật khẩu mới"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                className="flex-1 clay-btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="progress_activity" className="animate-spin" />
                    Đang reset...
                  </span>
                ) : (
                  <>
                    <Icon name="lock_reset" className="mr-2" />
                    Reset mật khẩu
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isLoading}
              >
                Hủy
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
