import { db, auth } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { getDateKeyVN, getWeekIdVN } from './gameSettingsService';

const FUNCTIONS_URL = 'https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net';

const pigRef = (uid) => doc(db, 'pigs', uid);
const userRef = (uid) => doc(db, 'users', uid);

const calcLevel = (xp, xpPerLevel) => Math.floor(xp / xpPerLevel) + 1;

/**
 * Ghi nhật ký game heo (gọi bên trong transaction)
 */
const writeLog = (transaction, { uid, userName, type, detail = {} }) => {
    const logRef = doc(collection(db, 'pigGameLogs'));
    transaction.set(logRef, {
        uid,
        userName: userName || '',
        type,
        detail,
        dateKey: getDateKeyVN(),
        weekId: getWeekIdVN(),
        createdAt: serverTimestamp()
    });
};

/**
 * Mua heo đất (1 heo / tài khoản, trả bằng Đồng Vàng)
 */
export const buyPig = async (uid, userName, grade, settings) => {
    return await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef(uid));
        const pigDoc = await transaction.get(pigRef(uid));

        if (!userDoc.exists()) throw new Error('Không tìm thấy thông tin người dùng');
        if (pigDoc.exists()) throw new Error('Bạn đã có heo đất rồi!');

        const gold = userDoc.data().gold || 0;
        if (gold < settings.pigPrice) {
            throw new Error(`Không đủ Đồng Vàng (cần ${settings.pigPrice} vàng)`);
        }

        const newGold = gold - settings.pigPrice;
        transaction.update(userRef(uid), { gold: newGold, pigLevel: 1, updatedAt: serverTimestamp() });
        transaction.set(pigRef(uid), {
            ownerUid: uid,
            ownerName: userName || '',
            grade: grade ?? null,
            xp: 0,
            level: 1,
            food: 0,
            lastXpAt: null,
            windowFeeds: {},
            extraFeeds: { dateKey: null, count: 0 },
            lastFeedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        writeLog(transaction, { uid, userName, type: 'buy_pig', detail: { goldSpent: settings.pigPrice } });

        return { newGold };
    });
};

/**
 * Mua đồ ăn cho heo bằng Xu (giá lấy từ store item category 'pig-food')
 */
export const buyFood = async (uid, userName, quantity, unitPrice) => {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Số lượng không hợp lệ');

    return await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef(uid));
        const pigDoc = await transaction.get(pigRef(uid));

        if (!userDoc.exists()) throw new Error('Không tìm thấy thông tin người dùng');
        if (!pigDoc.exists()) throw new Error('Bạn chưa có heo! Hãy mua heo trước.');

        const coins = userDoc.data().coins || 0;
        const totalCost = unitPrice * quantity;
        if (coins < totalCost) throw new Error(`Không đủ Xu (cần ${totalCost} xu)`);

        const newCoins = coins - totalCost;
        const newFood = (pigDoc.data().food || 0) + quantity;

        transaction.update(userRef(uid), { coins: newCoins, updatedAt: serverTimestamp() });
        transaction.update(pigRef(uid), { food: newFood, updatedAt: serverTimestamp() });
        writeLog(transaction, {
            uid, userName, type: 'buy_food',
            detail: { quantity, coinsSpent: totalCost }
        });

        return { newCoins, newFood };
    });
};

/**
 * Cho heo ăn: trong khung giờ cố định (mỗi khung 1 lần/ngày) hoặc dùng lượt cho ăn thêm.
 * Mỗi lần ăn tốn 1 đồ ăn, nhận XP ngẫu nhiên đều từ feedXpMin đến feedXpMax.
 */
// feedPig chạy server-side qua Cloud Function để chống gian lận đổi giờ máy.
export const feedPig = async (uid, userName) => {
    const idToken = await getIdToken(auth.currentUser);
    const res = await fetch(`${FUNCTIONS_URL}/feedPig`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid, userName }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Lỗi khi cho heo ăn');
    return data;
};

/**
 * Cộng XP cho heo khi nộp bài "Dạy heo học" trong khung giờ.
 * Idempotent qua flag pigXpAwarded trên examSubmissions.
 * @param {Date} effectiveTime - thời điểm dùng để check khung giờ (mặc định now; đề upload truyền submittedAt)
 */
export const awardExamXp = async (uid, userName, submissionId, { totalScore, maxScore }, assignment, settings, effectiveTime = new Date()) => {
    if (!assignment?.isPigTeaching) return { awarded: false, reason: 'not_pig_teaching' };

    const start = assignment.startTime?.toDate ? assignment.startTime.toDate() : assignment.startTime;
    const end = assignment.deadline?.toDate ? assignment.deadline.toDate() : assignment.deadline;
    if (start && effectiveTime < start) return { awarded: false, reason: 'before_window' };
    if (end && effectiveTime > end) return { awarded: false, reason: 'after_window' };

    const submissionRef = doc(db, 'examSubmissions', submissionId);

    return await runTransaction(db, async (transaction) => {
        const pigDoc = await transaction.get(pigRef(uid));
        if (!pigDoc.exists()) return { awarded: false, reason: 'no_pig' };

        const subDoc = await transaction.get(submissionRef);
        if (!subDoc.exists()) return { awarded: false, reason: 'no_submission' };
        if (subDoc.data().pigXpAwarded) return { awarded: false, reason: 'already_awarded' };

        // Quy điểm về thang 10, tối thiểu 1 XP khi đã nộp bài
        const score10 = maxScore > 0 ? (totalScore / maxScore) * 10 : 0;
        const xpGained = Math.max(1, Math.min(10, Math.round(score10)));

        const pig = pigDoc.data();
        const newXp = (pig.xp || 0) + xpGained;
        const newLevel = calcLevel(newXp, settings.xpPerLevel);
        const leveledUp = newLevel > (pig.level || 1);

        transaction.update(pigRef(uid), {
            xp: newXp,
            level: newLevel,
            lastXpAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        if (leveledUp) {
            transaction.update(userRef(uid), { pigLevel: newLevel, updatedAt: serverTimestamp() });
        }
        transaction.update(submissionRef, { pigXpAwarded: true, pigXpAmount: xpGained });
        writeLog(transaction, {
            uid, userName, type: 'exam_xp',
            detail: { submissionId, xpGained, totalScore, maxScore, newXp, newLevel }
        });

        return { awarded: true, xpGained, newXp, newLevel, leveledUp };
    });
};

/**
 * Đập heo đất: cần lượt đập (users.smashAttempts) và đang có heo.
 * Luôn nhận vàng: smashHighChance → smashHighGold, còn lại → smashLowGold.
 * Heo VỠ (bị xóa) — muốn nuôi tiếp phải mua heo mới.
 */
export const smashPiggy = async (uid, userName, settings) => {
    const isHigh = Math.random() < settings.smashHighChance;
    const goldWon = isHigh ? settings.smashHighGold : settings.smashLowGold;

    return await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef(uid));
        const pigDoc = await transaction.get(pigRef(uid));

        if (!userDoc.exists()) throw new Error('Không tìm thấy thông tin người dùng');
        const attempts = userDoc.data().smashAttempts || 0;
        if (attempts < 1) throw new Error('Bạn không có lượt đập heo!');
        if (!pigDoc.exists()) throw new Error('Bạn không có heo để đập!');

        const newGold = (userDoc.data().gold || 0) + goldWon;
        transaction.update(userRef(uid), {
            gold: newGold,
            smashAttempts: attempts - 1,
            pigLevel: 0,
            updatedAt: serverTimestamp()
        });
        transaction.delete(pigRef(uid));
        writeLog(transaction, {
            uid, userName, type: 'smash',
            detail: { isHigh, goldWon, pigLevel: pigDoc.data().level || 1 }
        });

        return { isHigh, goldWon, attemptsLeft: attempts - 1, newGold };
    });
};

// ===== Reads =====

export const getPig = async (uid) => {
    const snap = await getDoc(pigRef(uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Sort heo: level cao → XP cao → đạt XP đó trước (lastXpAt sớm hơn xếp trên)
 */
export const sortPigs = (pigs) =>
    [...pigs].sort((a, b) => {
        if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
        if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
        const aT = a.lastXpAt?.toMillis ? a.lastXpAt.toMillis() : Infinity;
        const bT = b.lastXpAt?.toMillis ? b.lastXpAt.toMillis() : Infinity;
        return aT - bT;
    });

export const getAllPigs = async () => {
    const snapshot = await getDocs(collection(db, 'pigs'));
    return sortPigs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const getPigsByGrade = async (grade) => {
    const all = await getAllPigs();
    return all.filter(p => String(p.grade) === String(grade));
};

/**
 * Nhật ký game heo cho admin (mới nhất trước)
 */
export const getPigLogs = async (limitN = 200) => {
    const q = query(collection(db, 'pigGameLogs'), orderBy('createdAt', 'desc'), limit(limitN));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
