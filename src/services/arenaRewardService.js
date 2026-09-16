import { callMoneyFunction } from './moneyApi';

/**
 * Cầu nối tới 3 Cloud Function của Đấu Trường.
 *
 * Cả ba đều phải chạy server-side vì đáp án chỉ có ở Firestore `arenaSessions`
 * mà học sinh không đọc được — client không tự chấm điểm hay tự biết đáp án nào
 * sai để loại bỏ.
 */

/**
 * Chủ phòng bắt đầu trận.
 *
 * Chạy server-side vì kho câu hỏi chỉ admin đọc được (chủ phòng có thể là học
 * sinh) và vì doc đề chứa đáp án nên client không được ghi.
 *
 * @param {string} roomId
 * @returns {Promise<{ sessionId: string, totalQuestions: number }>}
 */
export const startArenaMatch = async (roomId) => {
    return await callMoneyFunction('startArenaMatch', { roomId });
};

/**
 * Chấm điểm và xếp hạng cả trận.
 *
 * MỌI client đều gọi khi thấy trận kết thúc — đó là chủ ý: ai đó rớt mạng thì
 * người còn lại vẫn kích hoạt được việc chấm. Server idempotent nên lần đầu
 * chấm thật, các lần sau trả về đúng bảng xếp hạng đã chốt.
 *
 * @param {string} sessionId
 * @returns {Promise<{ ranking: Array, alreadyGraded?: boolean }>}
 */
export const finalizeArenaMatch = async (sessionId, { retries = 3, delayMs = 1000 } = {}) => {
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            return await callMoneyFunction('finalizeArenaMatch', { sessionId });
        } catch (error) {
            lastError = error;

            // Chưa hết giờ câu cuối — chờ rồi thử lại
            if (error.message?.includes('chưa kết thúc') && i < retries) {
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            // Lỗi dứt khoát: không tham gia trận, không tìm thấy trận
            if (
                error.message?.includes('không tham gia') ||
                error.message?.includes('Không tìm thấy trận')
            ) {
                throw error;
            }
            if (i < retries) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }

    throw lastError;
};

/**
 * Dùng vật phẩm cần biết đáp án (50/50 hoặc gợi ý câu đúng-sai).
 *
 * Server tự đánh dấu đã dùng trong cùng lượt gọi, nên không có chuyện dùng lại.
 * KHÔNG retry: mỗi lần gọi là một lần tiêu lượt, thử lại có thể mất oan vật phẩm.
 *
 * @param {string} sessionId
 * @param {number} qIndex - Vị trí câu đang làm
 * @param {'fifty'|'hint_tf'} effect
 * @param {number} [statementIndex] - Ý muốn gợi ý (chỉ với hint_tf)
 * @returns {Promise<{ effect: string, removed?: number[], index?: number, isTrue?: boolean }>}
 */
export const requestArenaHint = async (sessionId, qIndex, effect, statementIndex = null) => {
    const payload = { sessionId, qIndex, effect };
    if (statementIndex !== null && statementIndex !== undefined) {
        payload.statementIndex = statementIndex;
    }
    return await callMoneyFunction('useArenaHint', payload);
};

/**
 * Bắt đầu một lượt luyện tập một mình.
 *
 * @param {string} roomId
 * @returns {Promise<{ sessionId: string, totalQuestions: number, usedToday: number, maxPerDay: number }>}
 */
export const startArenaPractice = async (roomId) => {
    return await callMoneyFunction('startArenaPractice', { roomId });
};

/**
 * Chấm lượt luyện tập, cộng điểm tích luỹ và lấy phần xem lại đáp án.
 *
 * Điểm tích luỹ bằng đúng điểm bài làm (được 5đ thì cộng 5đ), chung trần ngày
 * với thi đấu. Server idempotent nên gọi lại không cộng điểm hai lần.
 *
 * @param {string} sessionId
 * @returns {Promise<{ score: number, maxScore: number, points: number, capped: boolean, review: Array }>}
 */
export const finalizeArenaPractice = async (sessionId, { retries = 3, delayMs = 1000 } = {}) => {
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            return await callMoneyFunction('finalizeArenaPractice', { sessionId });
        } catch (error) {
            lastError = error;
            if (error.message?.includes('chưa kết thúc') && i < retries) {
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw error;
        }
    }

    throw lastError;
};

/**
 * Dọn phòng bị bỏ hoang (cả phòng đã thoát giữa trận).
 *
 * Phải chạy server-side vì học sinh không có quyền ghi `status` của phòng.
 * Server tự kiểm tra phòng thực sự trống trước khi dọn, nên gọi nhầm lúc trận
 * còn đang chạy cũng không ảnh hưởng ai.
 *
 * @param {string} roomId
 * @returns {Promise<{ cleaned: boolean, reason?: string }>}
 */
export const cleanupArenaRoom = async (roomId) => {
    return await callMoneyFunction('cleanupArenaRoom', { roomId });
};

/**
 * Nhận điểm tích luỹ sau trận.
 *
 * Server tự đọc bảng xếp hạng để xác minh thứ hạng, và tự áp trần điểm mỗi
 * ngày. Trả về `awarded: false` kèm `reason` cho các trường hợp không phải lỗi
 * (ngoài top 5, chạm trần ngày, phòng không đủ người) để UI hiển thị lời giải
 * thích thay vì báo lỗi đỏ.
 *
 * Bảng xếp hạng có thể do client khác vừa ghi xong, nên thử lại vài nhịp.
 *
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export const claimArenaReward = async (sessionId, { retries = 4, delayMs = 1200 } = {}) => {
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            return await callMoneyFunction('claimArenaReward', { sessionId });
        } catch (error) {
            lastError = error;

            // Đã nhận rồi → coi như xong
            if (error.message?.includes('đã nhận thưởng')) {
                return { awarded: false, reason: 'already_claimed', points: 0 };
            }
            if (error.message?.includes('không tham gia')) {
                return { awarded: false, reason: 'not_participant', points: 0 };
            }
            // Còn lại (thường là bảng xếp hạng chưa kịp ghi) → chờ rồi thử lại
            if (i < retries) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }

    throw lastError;
};
