import { useState } from 'react';
import Icon from '../common/Icon';

const AssignExamModal = ({ exam, classes, onClose, onAssign }) => {
    const [selectedClassId, setSelectedClassId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('00:00');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Set default deadline to 7 days from now
    useState(() => {
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        setDeadline(defaultDeadline.toISOString().split('T')[0]);
    }, []);

    const handleAssign = async () => {
        setError('');

        // Validation
        if (!selectedClassId) {
            setError('Vui lòng chọn lớp');
            return;
        }

        if (!deadline) {
            setError('Vui lòng chọn thời hạn');
            return;
        }

        // Combine date and time in Vietnam timezone (UTC+7)
        const [hours, minutes] = deadlineTime.split(':').map(Number);
        // Parse date as local Vietnam time
        const [year, month, day] = deadline.split('-').map(Number);
        const deadlineDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

        const now = new Date();

        if (deadlineDate < now) {
            setError('Thời hạn phải từ bây giờ trở đi');
            return;
        }

        setIsLoading(true);
        await onAssign(selectedClassId, deadlineDate);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="clay-card max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#111812] dark:text-white">
                        Giao bài
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        disabled={isLoading}
                    >
                        <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Exam Info */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Đề thi:</p>
                    <p className="font-bold text-[#111812] dark:text-white">{exam.title}</p>
                    {exam.type === 'manual' && (
                        <p className="text-xs text-[#608a67] dark:text-[#8ba890] mt-1">
                            {exam.totalQuestions} câu • {exam.totalPoints} điểm • {exam.duration} phút
                        </p>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Class Selection */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Lớp học <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="clay-input w-full px-4 py-3 rounded-xl"
                            disabled={isLoading}
                        >
                            <option value="">-- Chọn lớp --</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name} (Khối {cls.grade}) - {cls.studentCount || 0} học sinh
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Thời hạn nộp bài <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="clay-input flex-1 px-4 py-3 rounded-xl"
                                disabled={isLoading}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <input
                                type="time"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                                className="clay-input w-32 px-4 py-3 rounded-xl"
                                disabled={isLoading}
                            />
                        </div>
                        <p className="text-xs text-[#608a67] dark:text-[#8ba890] mt-1">
                            Học sinh sẽ thấy bài này cho đến {deadline && deadlineTime ? `${new Date(deadline).toLocaleDateString('vi-VN')} lúc ${deadlineTime}` : '...'}
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Icon name="progress_activity" className="animate-spin" />
                                    Đang giao...
                                </>
                            ) : (
                                <>
                                    <Icon name="send" />
                                    Giao bài
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssignExamModal;
