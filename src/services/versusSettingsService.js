import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Cài đặt mặc định cho tính năng Đấu Trí 1v1.
 * Admin có thể ghi đè qua trang Admin (lưu vào settings/versusGame).
 */
export const DEFAULT_VERSUS_SETTINGS = {
    winCoins: 5,              // xu thưởng người thắng
    loseCoins: 0,             // xu cho người thua
    defaultWinSteps: 10,      // số bước thắng mặc định khi tạo bài
    defaultFreezeDuration: 3, // giây đóng băng khi sai
    maxOpenLobbies: 3,        // số phòng mở tối đa
    maxMatchesPerRoom: 20     // số trận tối đa mỗi phòng
};

const SETTINGS_REF = () => doc(db, 'settings', 'versusGame');

let cachedSettings = null;

export const clearVersusSettingsCache = () => {
    cachedSettings = null;
};

/**
 * Lấy cài đặt Đấu Trí 1v1 (merge với mặc định để không thiếu field)
 */
export const getVersusSettings = async (forceRefresh = false) => {
    if (cachedSettings && !forceRefresh) return cachedSettings;

    const snap = await getDoc(SETTINGS_REF());
    const data = snap.exists() ? snap.data() : {};

    cachedSettings = {
        ...DEFAULT_VERSUS_SETTINGS,
        ...data
    };
    return cachedSettings;
};

/**
 * Cập nhật cài đặt Đấu Trí 1v1 (admin only)
 */
export const updateVersusSettings = async (partial) => {
    await setDoc(SETTINGS_REF(), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
    clearVersusSettingsCache();
};
