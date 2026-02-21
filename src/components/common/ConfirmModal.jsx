import Icon from './Icon';
import Button from './Button';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Xác nhận',
    message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    type = 'warning' // 'warning', 'danger', 'info'
}) => {
    if (!isOpen) return null;

    const iconMap = {
        warning: { name: 'warning', color: 'text-yellow-600 dark:text-yellow-400' },
        danger: { name: 'error', color: 'text-red-600 dark:text-red-400' },
        info: { name: 'info', color: 'text-blue-600 dark:text-blue-400' }
    };

    const icon = iconMap[type] || iconMap.warning;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="clay-card max-w-md w-full p-6 animate-scale-in">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                    <div className={`p-3 rounded-full bg-gray-100 dark:bg-gray-800 ${icon.color}`}>
                        <Icon name={icon.name} className="text-2xl" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                            {title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={type === 'danger' ? 'danger' : 'primary'}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
