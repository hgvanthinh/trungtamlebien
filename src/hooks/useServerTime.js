import { useEffect, useRef, useState, useCallback } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

/**
 * Đồng hồ đồng bộ với server, dùng cho mọi deadline của Đấu Trường.
 *
 * VÌ SAO CẦN: timer trong arena là deadline TUYỆT ĐỐI lưu trên RTDB
 * (`questionEndsAt`). Nếu mỗi máy so deadline với `Date.now()` của chính nó,
 * máy nào lệch giờ hệ thống sẽ được nhiều/ít thời gian hơn người khác —
 * và vật phẩm đóng băng 10 giây cũng lệch theo.
 *
 * `/.info/serverTimeOffset` là giá trị Firebase tự tính (server time - client time),
 * cập nhật liên tục. `Date.now() + offset` cho thời gian server ước lượng,
 * sai số chỉ còn độ trễ mạng (cỡ chục ms).
 *
 * @example
 * const { serverNow, ready } = useServerTime();
 * const remaining = Math.max(0, questionEndsAt - serverNow());
 */

// Cache ở mức module: mọi component dùng chung 1 listener, và giá trị
// vẫn còn khi component unmount/remount giữa các màn (lobby → match).
let sharedOffset = 0;
let sharedReady = false;
let refCount = 0;
let unsubscribe = null;
const subscribers = new Set();

const startListening = () => {
    if (unsubscribe) return;

    const offsetRef = ref(realtimeDb, '.info/serverTimeOffset');
    unsubscribe = onValue(
        offsetRef,
        (snap) => {
            sharedOffset = Number(snap.val()) || 0;
            sharedReady = true;
            subscribers.forEach((fn) => fn(sharedOffset));
        },
        (error) => {
            // Mất kết nối → giữ offset cũ, vẫn cho chạy với đồng hồ máy
            console.error('Error listening to serverTimeOffset:', error);
            sharedReady = true;
            subscribers.forEach((fn) => fn(sharedOffset));
        }
    );
};

const stopListening = () => {
    // LƯU Ý: dùng hàm unsubscribe của onValue, KHÔNG dùng off(ref) —
    // off(ref) huỷ mọi listener trên path, kể cả của component khác.
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
};

export const useServerTime = () => {
    const [offset, setOffset] = useState(sharedOffset);
    const [ready, setReady] = useState(sharedReady);
    const offsetRef = useRef(sharedOffset);

    useEffect(() => {
        const handler = (value) => {
            offsetRef.current = value;
            setOffset(value);
            setReady(true);
        };

        subscribers.add(handler);
        refCount += 1;
        startListening();

        // Nếu offset đã có sẵn từ lần mount trước, dùng ngay không đợi snapshot
        if (sharedReady) handler(sharedOffset);

        return () => {
            subscribers.delete(handler);
            refCount -= 1;
            if (refCount <= 0) {
                refCount = 0;
                stopListening();
            }
        };
    }, []);

    // Dùng ref để serverNow giữ identity ổn định — tránh làm re-run
    // các useEffect có serverNow trong deps mỗi lần offset nhích vài ms.
    const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

    return { serverNow, offset, ready };
};

/**
 * Bản không-hook, dùng trong service (nơi không gọi được hook).
 * Chỉ chính xác sau khi offset đã được nạp — với thao tác quan trọng
 * (đặt deadline cho cả phòng) hãy dùng `ensureServerTime()` trước.
 * @returns {number} - Thời gian server ước lượng (ms)
 */
export const serverNowSync = () => Date.now() + sharedOffset;

/**
 * Đảm bảo đã có offset trước khi tính thời gian.
 *
 * CẦN THIẾT cho những thao tác đặt deadline dùng chung cho cả phòng
 * (startArenaMatch): lúc đó chủ phòng đang ở màn chờ, có thể chưa component nào
 * gắn useServerTime nên offset vẫn là 0 — deadline sẽ lệch đúng bằng sai số
 * đồng hồ máy chủ phòng, và cả phòng chịu chung sai số đó.
 *
 * Đọc trực tiếp /.info/serverTimeOffset một lần; nếu lỗi hoặc quá chậm thì
 * dùng offset hiện có (không chặn trận đấu vì một lần đọc hỏng).
 *
 * @param {number} timeoutMs - Chờ tối đa bao lâu
 * @returns {Promise<number>} - offset (ms)
 */
export const ensureServerTime = async (timeoutMs = 3000) => {
    if (sharedReady) return sharedOffset;

    try {
        const snap = await Promise.race([
            get(ref(realtimeDb, '.info/serverTimeOffset')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
        ]);
        const value = Number(snap.val());
        if (Number.isFinite(value)) {
            sharedOffset = value;
            sharedReady = true;
        }
    } catch (error) {
        console.warn('Không đọc được serverTimeOffset, dùng đồng hồ máy:', error?.message);
    }

    return sharedOffset;
};

export default useServerTime;
