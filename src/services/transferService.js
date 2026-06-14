import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { getDateKeyVN } from './gameSettingsService';

/**
 * Chuyển Xu/Đồng Vàng giữa 2 học sinh.
 * - Giới hạn số lần/ngày (settings.transferDailyLimit), đếm trên users.transferStats của người gửi
 * - Atomic: trừ người gửi + cộng người nhận + ghi log trong 1 transaction
 */
export const transferCurrency = async ({ fromUid, fromName, toUid, toName, currency, amount, settings }) => {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Số lượng phải là số nguyên dương');
    if (fromUid === toUid) throw new Error('Không thể tự chuyển cho chính mình');
    if (currency !== 'coins' && currency !== 'gold') throw new Error('Loại tiền không hợp lệ');
    if (settings.transferMaxAmount > 0 && amount > settings.transferMaxAmount) {
        throw new Error(`Mỗi lần chuyển tối đa ${settings.transferMaxAmount}`);
    }

    const fromRef = doc(db, 'users', fromUid);
    const toRef = doc(db, 'users', toUid);

    return await runTransaction(db, async (transaction) => {
        const fromDoc = await transaction.get(fromRef);
        const toDoc = await transaction.get(toRef);

        if (!fromDoc.exists()) throw new Error('Không tìm thấy tài khoản của bạn');
        if (!toDoc.exists()) throw new Error('Không tìm thấy người nhận');

        const fromData = fromDoc.data();
        const dateKey = getDateKeyVN();

        // Giới hạn lượt chuyển trong ngày
        const stats = fromData.transferStats?.dateKey === dateKey
            ? fromData.transferStats
            : { dateKey, count: 0 };
        if (stats.count >= settings.transferDailyLimit) {
            throw new Error(`Bạn đã hết lượt chuyển hôm nay (tối đa ${settings.transferDailyLimit} lần/ngày)`);
        }

        // Kiểm tra số dư
        const balance = fromData[currency] || 0;
        if (balance < amount) {
            throw new Error(`Không đủ ${currency === 'coins' ? 'Xu' : 'Đồng Vàng'} để chuyển`);
        }

        // Trừ người gửi + đếm lượt
        transaction.update(fromRef, {
            [currency]: balance - amount,
            transferStats: { dateKey, count: stats.count + 1 },
            updatedAt: serverTimestamp()
        });

        // Cộng người nhận — CHỈ ghi đúng field currency (rules chỉ cho phép tăng coins/gold)
        transaction.update(toRef, {
            [currency]: (toDoc.data()[currency] || 0) + amount
        });

        // Log giao dịch (append-only)
        const logRef = doc(collection(db, 'transfers'));
        transaction.set(logRef, {
            fromUid,
            fromName: fromName || '',
            toUid,
            toName: toName || '',
            currency,
            amount,
            dateKey,
            createdAt: serverTimestamp()
        });

        return {
            newBalance: balance - amount,
            transfersLeft: settings.transferDailyLimit - stats.count - 1
        };
    });
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
