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
 * Ngày thứ Hai (UTC) của một weekId ISO, vd '2026-W30' → Date(2026-07-20)
 */
export const getWeekStartDate = (weekId) => {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekId || '');
    if (!match) return null;
    const [, year, week] = match;

    // Thứ Năm của tuần 1 luôn nằm trong tuần chứa 04/01
    const jan4 = new Date(Date.UTC(Number(year), 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

    const monday = new Date(week1Monday);
    monday.setUTCDate(week1Monday.getUTCDate() + (Number(week) - 1) * 7);
    return monday;
};

/**
 * Mô tả tuần cho admin đọc, vd '20/07 – 26/07/2026'
 */
export const formatWeekRange = (weekId) => {
    const monday = getWeekStartDate(weekId);
    if (!monday) return weekId || '—';
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const dm = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return `${dm(monday)} – ${dm(sunday)}/${sunday.getUTCFullYear()}`;
};

/**
 * Trạng thái của một tuần so với hiện tại, dùng để nhắc admin chốt đúng lúc.
 * - isCurrent: tuần đang diễn ra
 * - isPast: tuần đã kết thúc (chốt trễ)
 * - daysLate: số ngày đã trễ kể từ lúc tuần kết thúc (0 nếu chưa kết thúc)
 * - daysRemaining: số ngày còn lại tới hết tuần (0 nếu đã kết thúc)
 */
export const getWeekStatus = (weekId, now = new Date()) => {
    const monday = getWeekStartDate(weekId);
    if (!monday) return { isCurrent: false, isPast: false, daysLate: 0, daysRemaining: 0 };

    const todayVN = new Date(getDateKeyVN(now) + 'T00:00:00Z');
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(monday.getUTCDate() + 7);

    const isPast = todayVN >= nextMonday;
    const isCurrent = todayVN >= monday && !isPast;

    return {
        isCurrent,
        isPast,
        daysLate: isPast ? Math.round((todayVN - nextMonday) / 86400000) + 1 : 0,
        daysRemaining: isCurrent ? Math.round((nextMonday - todayVN) / 86400000) : 0
    };
};

/**
 * Khung giờ cho ăn cố định đang mở tại thời điểm date (theo giờ VN), null nếu ngoài khung
 */
export const getActiveWindow = (settings, date = new Date()) => {
    const time = getTimeVN(date);
    return settings.feedingWindows.find(w => w.start <= time && time <= w.end) || null;
};
