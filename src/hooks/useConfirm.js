import { useState } from 'react';

/**
 * Custom hook để sử dụng ConfirmModal dễ dàng hơn
 * 
 * @example
 * const { showConfirm, ConfirmDialog } = useConfirm();
 * 
 * const handleDelete = () => {
 *   showConfirm({
 *     title: 'Xóa học sinh',
 *     message: 'Bạn có chắc muốn xóa học sinh này?',
 *     onConfirm: async () => {
 *       await deleteStudent(id);
 *     }
 *   });
 * };
 * 
 * return (
 *   <>
 *     <button onClick={handleDelete}>Xóa</button>
 *     <ConfirmDialog />
 *   </>
 * );
 */
export const useConfirm = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({
        title: 'Xác nhận',
        message: 'Bạn có chắc chắn?',
        confirmText: 'Xác nhận',
        cancelText: 'Hủy',
        type: 'warning',
        onConfirm: () => { },
    });

    const showConfirm = (newConfig) => {
        setConfig({ ...config, ...newConfig });
        setIsOpen(true);
    };

    const handleConfirm = () => {
        config.onConfirm();
        setIsOpen(false);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const ConfirmDialog = () => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="clay-card max-w-md w-full p-6 animate-scale-in">
                    <div className="flex items-start gap-4 mb-6">
                        <div className={`p-3 rounded-full bg-gray-100 dark:bg-gray-800 ${config.type === 'danger' ? 'text-red-600 dark:text-red-400' :
                                config.type === 'info' ? 'text-blue-600 dark:text-blue-400' :
                                    'text-yellow-600 dark:text-yellow-400'
                            }`}>
                            <span className="material-symbols-rounded text-2xl">
                                {config.type === 'danger' ? 'error' : config.type === 'info' ? 'info' : 'warning'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                                {config.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {config.message}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {config.cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${config.type === 'danger'
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-primary hover:shadow-lg text-[#052e16]'
                                }`}
                        >
                            {config.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return { showConfirm, ConfirmDialog };
};
