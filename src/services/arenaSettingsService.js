import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Cài đặt mặc định cho Đấu Trường (arena) — quiz nhiều người chơi realtime.
 * Admin có thể ghi đè qua trang Admin (lưu vào settings/arenaGame).
 *
 * Cơ cấu đề: 3 câu ABCD (0.5đ) + 1 câu đúng-sai 4 ý (2đ) + 1 câu điền (1đ) = 4.5đ
 */
export const DEFAULT_ARENA_SETTINGS = {
    // Câu ABCD
    abcdCount: 3,
    abcdSeconds: 30,
    abcdPoints: 0.5,

    // Câu đúng-sai 4 ý (điểm theo bậc thang số ý đúng)
    tfSeconds: 210,           // 3,5 phút
    tfPoints: 2,

    // Câu điền đáp án
    shortAnswerSeconds: 90,
    shortAnswerPoints: 1,

    // Nhịp trận
    countdownSeconds: 5,      // đếm ngược trước câu đầu
    interstitialSeconds: 5,   // khoảng chuyển câu (cửa sổ đặt cược x2)

    // Phòng
    minPlayers: 5,
    maxPlayers: 30,
    maxOpenRooms: 3,

    // Thưởng điểm tích luỹ (totalBehaviorPoints)
    rewards: { 1: 50, 2: 40, 3: 30, 4: 20, 5: 20 },
    dailyCapPoints: 100,

    // Vật phẩm nhân đôi KHÔNG áp dụng cho câu đúng-sai 2đ (tránh vỡ cân bằng)
    doubleAllowedTypes: ['abcd', 'short_answer']
};

/**
 * Bậc thang điểm câu đúng-sai: index = số ý đúng (0..4) → tỉ lệ điểm.
 * Đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%.
 * Dùng chung giữa client (hiển thị luật) và Cloud Function (chấm thật).
 */
export const TF_RATIO = [0, 0.1, 0.25, 0.5, 1];

const SETTINGS_REF = () => doc(db, 'settings', 'arenaGame');

let cachedSettings = null;

export const clearArenaSettingsCache = () => {
    cachedSettings = null;
};

/**
 * Lấy cài đặt Đấu Trường (merge với mặc định để không thiếu field)
 * @param {boolean} forceRefresh - Bỏ qua cache
 * @returns {Promise<Object>}
 */
export const getArenaSettings = async (forceRefresh = false) => {
    if (cachedSettings && !forceRefresh) return cachedSettings;

    try {
        const snap = await getDoc(SETTINGS_REF());
        const data = snap.exists() ? snap.data() : {};

        cachedSettings = {
            ...DEFAULT_ARENA_SETTINGS,
            ...data,
            // rewards là object lồng — merge riêng để admin chỉ sửa 1 hạng không mất hạng khác
            rewards: { ...DEFAULT_ARENA_SETTINGS.rewards, ...(data.rewards || {}) }
        };
        return cachedSettings;
    } catch (error) {
        console.error('Error getting arena settings:', error);
        return { ...DEFAULT_ARENA_SETTINGS };
    }
};

/**
 * Cập nhật cài đặt Đấu Trường (admin only)
 * @param {Object} partial - Các field cần cập nhật
 * @returns {Promise<void>}
 */
export const updateArenaSettings = async (partial) => {
    await setDoc(SETTINGS_REF(), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
    clearArenaSettingsCache();
};

/**
 * Thời gian (giây) của câu thứ `index` theo cơ cấu đề chuẩn.
 * Thứ tự cố định: [abcd, abcd, abcd, true_false, short_answer]
 * @param {number} index - Vị trí câu (0-based)
 * @param {Object} settings - Cài đặt arena
 * @returns {number} - Số giây
 */
export const getQuestionSeconds = (index, settings = DEFAULT_ARENA_SETTINGS) => {
    const abcdCount = settings.abcdCount ?? DEFAULT_ARENA_SETTINGS.abcdCount;
    if (index < abcdCount) return settings.abcdSeconds ?? DEFAULT_ARENA_SETTINGS.abcdSeconds;
    if (index === abcdCount) return settings.tfSeconds ?? DEFAULT_ARENA_SETTINGS.tfSeconds;
    return settings.shortAnswerSeconds ?? DEFAULT_ARENA_SETTINGS.shortAnswerSeconds;
};

/**
 * Điểm tối đa của câu thứ `index`
 * @param {number} index - Vị trí câu (0-based)
 * @param {Object} settings - Cài đặt arena
 * @returns {number}
 */
export const getQuestionPoints = (index, settings = DEFAULT_ARENA_SETTINGS) => {
    const abcdCount = settings.abcdCount ?? DEFAULT_ARENA_SETTINGS.abcdCount;
    if (index < abcdCount) return settings.abcdPoints ?? DEFAULT_ARENA_SETTINGS.abcdPoints;
    if (index === abcdCount) return settings.tfPoints ?? DEFAULT_ARENA_SETTINGS.tfPoints;
    return settings.shortAnswerPoints ?? DEFAULT_ARENA_SETTINGS.shortAnswerPoints;
};

/**
 * Tổng số câu của một trận theo cài đặt (3 ABCD + 1 Đ/S + 1 điền = 5)
 * @param {Object} settings
 * @returns {number}
 */
export const getTotalQuestions = (settings = DEFAULT_ARENA_SETTINGS) => {
    return (settings.abcdCount ?? DEFAULT_ARENA_SETTINGS.abcdCount) + 2;
};
