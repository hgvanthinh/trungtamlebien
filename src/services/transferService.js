import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from 'firebase/firestore';
import { getDateKeyVN } from './gameSettingsService';
import { callMoneyFunction } from './moneyApi';

/**
 * Tài khoản được coi là "đã duyệt" nếu admin duyệt tường minh (approved === true),
 * hoặc là tài khoản cũ (chưa có field approved) đã được phân lớp — coi như đã duyệt sẵn.
 */
export const isAccountApproved = (userData) => {
    if (!userData) return false;
    if (userData.approved === true) return true;
    if (userData.approved === false) return false;
    return Array.isArray(userData.classes) && userData.classes.length > 0;
};

/**
 * Chuyển Xu/Đồng Vàng giữa 2 học sinh.
 *
 * Toàn bộ việc kiểm tra (duyệt tài khoản, giới hạn lượt/ngày, số dư) và cả
 * việc trừ/cộng tiền đều chạy TRÊN SERVER — client chỉ gửi ý định chuyển.
 * Các tham số fromUid/fromName/toName/settings giữ lại cho tương thích với
 * chỗ gọi cũ nhưng server không tin chúng: người gửi lấy từ token đăng nhập.
 */
export const transferCurrency = async ({ toUid, currency, amount }) => {
    const { newBalance, transfersLeft } = await callMoneyFunction('transferCurrency', {
        toUid,
        currency,
        amount,
    });
    return { newBalance, transfersLeft };
};

/**
 * Số lượt chuyển còn lại hôm nay của user
 */
export const getTransfersLeftToday = (userProfile, settings) => {
    const dateKey = getDateKeyVN();
    const used = userProfile?.transferStats?.dateKey === dateKey ? userProfile.transferStats.count : 0;
    return Math.max(0, settings.transferDailyLimit - used);
};

/**
 * Lịch sử chuyển khoản của 1 HS (gửi + nhận)
 */
export const getMyTransfers = async (uid, limitN = 50) => {
    const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(query(collection(db, 'transfers'), where('fromUid', '==', uid), orderBy('createdAt', 'desc'), limit(limitN))),
        getDocs(query(collection(db, 'transfers'), where('toUid', '==', uid), orderBy('createdAt', 'desc'), limit(limitN)))
    ]);

    const all = [
        ...sentSnap.docs.map(d => ({ id: d.id, ...d.data(), direction: 'sent' })),
        ...receivedSnap.docs.map(d => ({ id: d.id, ...d.data(), direction: 'received' }))
    ];
    return all.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
};

/**
 * Toàn bộ lịch sử chuyển khoản (admin)
 */
export const getAllTransfers = async (limitN = 200) => {
    const snapshot = await getDocs(
        query(collection(db, 'transfers'), orderBy('createdAt', 'desc'), limit(limitN))
    );
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
