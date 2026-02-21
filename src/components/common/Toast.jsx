import { useEffect } from 'react';
import Icon from './Icon';

const Toast = ({ message, type = 'success', onClose, duration = 3000, showUndo = false, onUndo }) => {
    useEffect(() => {
        // Don't auto-close if undo is available
        if (duration > 0 && !showUndo) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose, showUndo]);

    const styles = {
        success: {
            bg: 'bg-green-500 dark:bg-green-600',
            icon: 'check_circle',
            iconColor: 'text-white',
        },
        error: {
            bg: 'bg-red-500 dark:bg-red-600',
            icon: 'error',
            iconColor: 'text-white',
        },
        info: {
            bg: 'bg-blue-500 dark:bg-blue-600',
            icon: 'info',
            iconColor: 'text-white',
        },
        warning: {
            bg: 'bg-yellow-500 dark:bg-yellow-600',
            icon: 'warning',
            iconColor: 'text-white',
        },
    };

    const style = styles[type] || styles.success;

    return (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
            <div className={`${style.bg} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md`}>
                <Icon name={style.icon} className={`text-2xl ${style.iconColor}`} />
                <p className="flex-1 font-medium">{message}</p>
                {showUndo && onUndo && (
                    <button
                        onClick={onUndo}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-bold text-sm"
                    >
                        Hoàn tác
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <Icon name="close" className="text-lg" />
                </button>
            </div>
        </div>
    );
};

export default Toast;
