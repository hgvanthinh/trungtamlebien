import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllVideos, createVideo, updateVideo, deleteVideo } from '../../services/videoService';
import VideoCard from '../../components/video/VideoCard';
import VideoModal from '../../components/video/VideoModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';

const VideoLibrary = () => {
    const { currentUser } = useAuth();
    const [videos, setVideos] = useState([]);
    const [filteredVideos, setFilteredVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState(null);
    const [filterGrade, setFilterGrade] = useState('');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        loadVideos();
    }, []);

    useEffect(() => {
        if (filterGrade === '') {
            setFilteredVideos(videos);
        } else {
            setFilteredVideos(videos.filter(v => v.grade === parseInt(filterGrade)));
        }
    }, [filterGrade, videos]);

    const loadVideos = async () => {
        setLoading(true);
        const result = await getAllVideos();
        if (result.success) {
            setVideos(result.videos);
            setFilteredVideos(result.videos);
        }
        setLoading(false);
    };

    const handleAddVideo = () => {
        setSelectedVideo(null);
        setShowModal(true);
    };

    const handleEditVideo = (video) => {
        setSelectedVideo(video);
        setShowModal(true);
    };

    const handleSaveVideo = async (videoData) => {
        let result;

        if (selectedVideo) {
            result = await updateVideo(selectedVideo.id, videoData);
        } else {
            result = await createVideo({
                ...videoData,
                createdBy: currentUser.uid,
            });
        }

        if (result.success) {
            setToast({
                type: 'success',
                message: selectedVideo ? 'Đã cập nhật video!' : 'Đã thêm video mới!'
            });
            await loadVideos();
            setShowModal(false);
        } else {
            setToast({ type: 'error', message: result.error });
        }
    };

    const handleDeleteVideo = (videoId) => {
        setVideoToDelete(videoId);
        setShowConfirmDelete(true);
    };

    const confirmDeleteVideo = async () => {
        if (videoToDelete) {
            const result = await deleteVideo(videoToDelete);
            if (result.success) {
                setToast({ type: 'success', message: 'Đã xóa video!' });
                await loadVideos();
            } else {
                setToast({ type: 'error', message: result.error });
            }
            setVideoToDelete(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                    <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
                    Kho video
                </h1>
                <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
                    Quản lý video học tập từ YouTube
                </p>
            </div>

            {/* Actions & Filter */}
            <div className="flex gap-3 items-center">
                <button
                    onClick={handleAddVideo}
                    className="px-6 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Icon name="add_circle" />
                    Thêm video mới
                </button>

                <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="px-4 py-3 bg-white dark:bg-gray-800 border border-[#d0e5d4] dark:border-white/20 rounded-xl text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="">Tất cả khối</option>
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                </select>

                <div className="ml-auto text-sm text-[#608a67] dark:text-[#8ba890]">
                    {filteredVideos.length} video
                </div>
            </div>

            {/* Videos Grid */}
            {filteredVideos.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="video_library" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                        {filterGrade ? 'Không có video cho khối này' : 'Chưa có video'}
                    </h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        {filterGrade ? 'Thử chọn khối khác hoặc thêm video mới' : 'Nhấn "Thêm video mới" để bắt đầu'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredVideos.map((video) => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            onEdit={handleEditVideo}
                            onDelete={handleDeleteVideo}
                            isAdmin={true}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showModal && (
                <VideoModal
                    video={selectedVideo}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedVideo(null);
                    }}
                    onSave={handleSaveVideo}
                />
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={confirmDeleteVideo}
                title="Xóa video"
                message="Bạn có chắc chắn muốn xóa video này? Hành động này không thể hoàn tác."
                confirmText="Xóa"
                cancelText="Hủy"
                type="danger"
            />

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

export default VideoLibrary;
