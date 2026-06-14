// Ảnh heo theo cấp độ.
// Thầy muốn đổi hình: thay file cùng tên trong src/assets/pig/ (giữ tên level_1.png...),
// hoặc thêm ảnh mới rồi cập nhật map bên dưới.
import level1 from '../assets/pig/level_1.png';
import level2 from '../assets/pig/level_2.png';
import level3 from '../assets/pig/level_3.png';
import level4 from '../assets/pig/level_4.png';
import level5 from '../assets/pig/level_5.png';

const PIG_IMAGES = {
    1: level1,
    2: level2,
    3: level3,
    4: level4,
    5: level5
};

const MAX_LEVEL_IMAGE = Math.max(...Object.keys(PIG_IMAGES).map(Number));

/**
 * Lấy ảnh heo theo cấp (cấp cao hơn max thì dùng ảnh max)
 */
export const getPigImage = (level) => {
    const lv = Math.max(1, Math.min(level || 1, MAX_LEVEL_IMAGE));
    return PIG_IMAGES[lv];
};

/**
 * Kích thước (px) heo chạy cạnh tên HS theo cấp — cấp càng cao heo càng to
 */
export const getRunningPigSize = (level) => {
    if (level >= 5) return 38;
    if (level === 4) return 32;
    if (level === 3) return 26;
    if (level === 2) return 20;
    return 0;
};
