import { getPigImage, getRunningPigSize } from '../../config/pigAssets';

/**
 * Heo chạy hiển thị cạnh tên HS khi heo đạt cấp 2 trở lên.
 * Cấp càng cao heo càng to (game Nuôi Heo Đất).
 */
export default function RunningPigBadge({ level }) {
    const size = getRunningPigSize(level || 0);
    if (!size) return null;

    return (
        <span
            className="inline-flex items-center align-middle ml-1"
            title={`Heo đất cấp ${level}`}
        >
            <img
                src={getPigImage(level)}
                alt={`🐷 cấp ${level}`}
                className="animate-pig-run inline-block"
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        </span>
    );
}
