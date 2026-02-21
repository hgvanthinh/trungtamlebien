import Icon from '../common/Icon';

const VideoCard = ({ video, onEdit, onDelete, isAdmin = false }) => {
    const thumbnailUrl = `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

    return (
        <div className="clay-card overflow-hidden hover:shadow-xl transition-all group">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <img
                    src={thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {video.grade && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-[#052e16] rounded-lg text-xs font-bold">
                        Khối {video.grade}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-bold text-[#111812] dark:text-white mb-2 line-clamp-2">
                    {video.title}
                </h3>

                {video.description && (
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-3 line-clamp-2">
                        {video.description}
                    </p>
                )}

                <div className="flex items-center gap-2 text-xs text-[#608a67] dark:text-[#8ba890] mb-3">
                    <Icon name="schedule" className="text-sm" />
                    <span>
                        {new Date(video.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('vi-VN')}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <a
                        href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-1"
                    >
                        <Icon name="play_circle" className="text-sm" />
                        Xem
                    </a>

                    {isAdmin && (
                        <>
                            <button
                                onClick={() => onEdit(video)}
                                className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center justify-center gap-1"
                            >
                                <Icon name="edit" className="text-sm" />
                            </button>
                            <button
                                onClick={() => onDelete(video.id)}
                                className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-1"
                            >
                                <Icon name="delete" className="text-sm" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCard;
