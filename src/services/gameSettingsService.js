import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Cài đặt mặc định cho Game Nuôi Heo Đất.
 * Admin có thể ghi đè qua trang Admin > Heo Đất - Game (lưu vào settings/pigGame).
 */
export const DEFAULT_PIG_SETTINGS = {
    pigPrice: 1,                 // giá mua heo (Đồng Vàng)
    xpPerLevel: 50,              // XP cần để lên 1 cấp
    feedXpMin: 1,                // XP tối thiểu mỗi lần cho ăn
    feedXpMax: 5,                // XP tối đa mỗi lần cho ăn
    feedingWindows: [
        { id: 'morning', label: 'Sáng', start: '06:00', end: '06:15' },
        { id: 'noon', label: 'Trưa', start: '11:45', end: '12:00' },
        { id: 'night', label: 'Tối', start: '21:30', end: '22:00' }
    ],
    maxExtraFeedsPerDay: 2,      // số lần cho ăn thêm ngoài khung giờ mỗi ngày
    smashHighChance: 0.75,       // xác suất trúng mức cao khi đập heo
    smashHighGold: 10,           // vàng nhận khi trúng mức cao
    smashLowGold: 5,             // vàng nhận khi trúng mức thấp
    smashTopNByGrade: {          // số heo top mỗi khối được +1 lượt đập cuối tuần
        6: 3, 7: 3, 8: 3, 9: 3,
        10: 5, 11: 5, 12: 5
    },
    transferDailyLimit: 3,       // số lần chuyển xu/vàng tối đa mỗi ngày
    transferMaxAmount: 0,        // giới hạn mỗi lần chuyển (0 = không giới hạn)
    currentWeekId: null          // weekId đang diễn ra, null = tự lấy tuần hiện tại
};

const SETTINGS_REF = () => doc(db, 'settings', 'pigGame');

let cachedSettings = null;

export const clearPigSettingsCache = () => {
    cachedSettings = null;
};

/**
 * Lấy cài đặt game heo (merge với mặc định để không thiếu field)
 */
export const getPigGameSettings = async (forceRefresh = false) => {
    if (cachedSettings && !forceRefresh) return cachedSettings;

    const snap = await getDoc(SETTINGS_REF());
    const data = snap.exists() ? snap.data() : {};

    cachedSettings = {
        ...DEFAULT_PIG_SETTINGS,
        ...data,
        smashTopNByGrade: { ...DEFAULT_PIG_SETTINGS.smashTopNByGrade, ...(data.smashTopNByGrade || {}) },
        feedingWindows: data.feedingWindows?.length ? data.feedingWindows : DEFAULT_PIG_SETTINGS.feedingWindows,
        currentWeekId: data.currentWeekId || getWeekIdVN()
    };
    return cachedSettings;
};

/**
 * Cập nhật cài đặt game heo (admin only)
 */
export const updatePigGameSettings = async (partial) => {
    await setDoc(SETTINGS_REF(), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
    clearPigSettingsCache();
};

// ===== Helpers thời gian Việt Nam (Asia/Ho_Chi_Minh) =====

/**
 * Ngày hiện tại theo giờ VN, dạng 'YYYY-MM-DD'
 */
export const getDateKeyVN = (date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);

/**
 * Giờ phút hiện tại theo giờ VN, dạng 'HH:mm'
 */
export const getTimeVN = (date = new Date()) =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);

/**
 * Mã tuần ISO theo giờ VN, vd '2026-W24'
 */
export const getWeekIdVN = (date = new Date()) => {
    const d = new Date(getDateKeyVN(date) + 'T00:00:00Z');
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Khung giờ cho ăn cố định đang mở tại thời điểm date (theo giờ VN), null nếu ngoài khung
 */
export const getActiveWindow = (settings, date = new Date()) => {
    const time = getTimeVN(date);
    return settings.feedingWindows.find(w => w.start <= time && time <= w.end) || null;
};
