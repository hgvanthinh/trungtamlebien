import { db, auth } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit
} from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { callMoneyFunction } from './moneyApi';

const FUNCTIONS_URL = 'https://asia-southeast1-toanthaybien-2c3d2.cloudfunctions.net';

const pigRef = (uid) => doc(db, 'pigs', uid);

/**
 * Mua heo đất (1 heo / tài khoản, trả bằng Đồng Vàng).
 *
 * Server tự tra khối lớp của HS từ collection classes rồi mới cho mua — HS
 * chưa được xếp lớp (grade = 0) không nuôi được heo, và không thể tự khai
 * grade để lách. Giá heo cũng lấy từ settings phía server.
 */
export const buyPig = async () => {
    const { newGold } = await callMoneyFunction('pigPurchase', { action: 'buy_pig' });
    return { newGold };
};

/**
 * Mua đồ ăn cho heo bằng Xu.
 * Đơn giá do server đọc từ store item category 'pig-food', client không gửi giá.
 */
export const buyFood = async (uid, userName, quantity) => {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Số lượng không hợp lệ');

    const { newCoins, newFood } = await callMoneyFunction('pigPurchase', {
        action: 'buy_food',
        quantity,
    });
    return { newCoins, newFood };
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
 *
 * Chạy server-side: XP heo dẫn tới lượt đập heo (ra Đồng Vàng), nên nếu để
 * client tự ghi thì HS bơm cấp heo để lọt top khối rồi lấy vàng. Server tự
 * đọc điểm và thời điểm nộp từ examSubmissions — không tin số client gửi.
 * Idempotent qua flag pigXpAwarded trên submission.
 *
 * Các tham số sau submissionId giữ lại cho tương thích với chỗ gọi cũ.
 * Admin chấm bài hộ thì truyền uid của HS; HS tự nộp thì bỏ trống.
 */
export const awardExamXp = async (uid, userName, submissionId) => {
    return await callMoneyFunction('awardExamXp', { submissionId, uid });
};

/**
 * Đập heo đất: cần lượt đập (users.smashAttempts) và đang có heo.
 * Luôn nhận vàng: smashHighChance → smashHighGold, còn lại → smashLowGold.
 * Heo VỠ (bị xóa) — muốn nuôi tiếp phải mua heo mới.
 *
 * Xúc xắc tung trên server: HS không đoán trước được kết quả, cũng không
 * thể gọi lại nhiều lần để "quay" cho tới khi trúng mức cao.
 */
export const smashPiggy = async () => {
    const { isHigh, goldWon, attemptsLeft, newGold } = await callMoneyFunction('smashPiggy');
    return { isHigh, goldWon, attemptsLeft, newGold };
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
