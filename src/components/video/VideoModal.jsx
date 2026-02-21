import { useState } from 'react';
import { extractYouTubeId } from '../../services/videoService';
import Icon from '../common/Icon';

const VideoModal = ({ video, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: video?.title || '',
        description: video?.description || '',
        youtubeUrl: video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '',
        grade: video?.grade || '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setError('');

        // Validation
        if (!formData.title.trim()) {
            setError('Vui lòng nhập tiêu đề video');
            return;
        }

        if (!formData.youtubeUrl.trim()) {
            setError('Vui lòng nhập link YouTube');
            return;
        }

        // Extract YouTube ID
        const youtubeId = extractYouTubeId(formData.youtubeUrl);
        if (!youtubeId) {
            setError('Link YouTube không hợp lệ. Vui lòng nhập link dạng: https://www.youtube.com/watch?v=...');
            return;
        }

        setIsLoading(true);

        const videoData = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            youtubeId,
            grade: formData.grade ? parseInt(formData.grade) : null,
        };

        await onSave(videoData);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="clay-card max-w-2xl w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#111812] dark:text-white">
                        {video ? 'Chỉnh sửa video' : 'Thêm video mới'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        disabled={isLoading}
                    >
                        <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* YouTube URL */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Link YouTube <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.youtubeUrl}
                            onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="clay-input w-full px-4 py-3 rounded-xl"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-[#608a67] dark:text-[#8ba890] mt-1">
                            Ví dụ: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Tiêu đề <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Nhập tiêu đề video..."
                            className="clay-input w-full px-4 py-3 rounded-xl"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Grade */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Khối lớp
                        </label>
                        <select
                            value={formData.grade}
                            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                            className="clay-input w-full px-4 py-3 rounded-xl"
                            disabled={isLoading}
                        >
                            <option value="">Tất cả khối</option>
                            <option value="6">Khối 6</option>
                            <option value="7">Khối 7</option>
                            <option value="8">Khối 8</option>
                            <option value="9">Khối 9</option>
                        </select>
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
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Icon name="progress_activity" className="animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Icon name="save" />
                                    {video ? 'Cập nhật' : 'Thêm video'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoModal;
