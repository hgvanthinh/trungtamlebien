import { useCallback, useEffect, useState } from 'react';

/**
 * Cỡ chữ / cỡ ảnh khi làm bài Đấu Trường.
 *
 * Lưu ở localStorage chứ không lên Firestore: đây là tuỳ chọn của CÁI MÀN HÌNH
 * đang dùng, không phải của tài khoản. Cùng một em ngồi máy tính lớp và điện
 * thoại ở nhà cần hai cỡ chữ khác nhau.
 */

const STORAGE_KEY = 'arenaDisplayPrefs';

/** Bậc cỡ chữ — nhân vào cỡ gốc của đề và đáp án */
export const FONT_SCALES = [
    { value: 0.9, label: 'Nhỏ', short: 'A' },
    { value: 1, label: 'Vừa', short: 'A' },
    { value: 1.15, label: 'Lớn', short: 'A' },
    { value: 1.35, label: 'Rất lớn', short: 'A' },
    { value: 1.6, label: 'Cực lớn', short: 'A' },
];

/** Bậc chiều cao tối đa của ảnh đề (px) */
export const IMAGE_SCALES = [
    { value: 120, label: 'Nhỏ' },
    { value: 192, label: 'Vừa' },
    { value: 280, label: 'Lớn' },
    { value: 400, label: 'Rất lớn' },
    { value: 9999, label: 'Tối đa' },
];

const DEFAULTS = { fontScale: 1, imageMaxHeight: 192 };

const readStored = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw);
        return {
            fontScale: Number(parsed.fontScale) || DEFAULTS.fontScale,
            imageMaxHeight: Number(parsed.imageMaxHeight) || DEFAULTS.imageMaxHeight,
        };
    } catch {
        // Chế độ riêng tư / bộ nhớ bị chặn — dùng mặc định, không làm hỏng màn thi
        return DEFAULTS;
    }
};

/**
 * @returns {{ prefs: Object, setFontScale: Function, setImageMaxHeight: Function, reset: Function }}
 */
export const useArenaDisplayPrefs = () => {
    const [prefs, setPrefs] = useState(readStored);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Không lưu được thì vẫn dùng được trong phiên này
        }
    }, [prefs]);

    const setFontScale = useCallback((fontScale) => {
        setPrefs((p) => ({ ...p, fontScale: Number(fontScale) || DEFAULTS.fontScale }));
    }, []);

    const setImageMaxHeight = useCallback((imageMaxHeight) => {
        setPrefs((p) => ({
            ...p,
            imageMaxHeight: Number(imageMaxHeight) || DEFAULTS.imageMaxHeight,
        }));
    }, []);

    const reset = useCallback(() => setPrefs(DEFAULTS), []);

    return { prefs, setFontScale, setImageMaxHeight, reset };
};

export default useArenaDisplayPrefs;
