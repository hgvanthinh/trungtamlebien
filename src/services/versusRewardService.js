import { callMoneyFunction } from './moneyApi';

/**
 * Nhận thưởng Xu sau khi thắng trận Đấu Trí.
 *
 * Server tự đọc versusMatchResults để xác minh người gọi đúng là người thắng,
 * nên client không thể tự khai thắng. Mỗi sessionId chỉ được trả thưởng một
 * lần (chốt bằng docId trong versusRewardClaims), kể cả khi HS reload trang.
 *
 * Kết quả trận do MỘT trong hai client ghi lên Firestore, có thể chậm hơn lúc
 * người thắng gọi nhận thưởng — nên thử lại vài nhịp trước khi bỏ cuộc.
 */
export const claimVersusReward = async (sessionId, { retries = 4, delayMs = 1200 } = {}) => {
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            return await callMoneyFunction('claimVersusReward', { sessionId });
        } catch (error) {
            lastError = error;

            // Đã nhận rồi → coi như xong, không thử lại nữa
            if (error.message?.includes('đã nhận thưởng')) {
                return { awarded: false, reason: 'already_claimed', coins: 0 };
            }
            // Các lỗi dứt khoát khác: không phải người thắng, trận bị dừng
            if (error.message?.includes('không phải người thắng') ||
                error.message?.includes('bị dừng')) {
                return { awarded: false, reason: 'not_eligible', coins: 0 };
            }
            // Còn lại (thường là kết quả trận chưa kịp lên Firestore) → chờ rồi thử lại
            if (i < retries) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }

    throw lastError;
};
