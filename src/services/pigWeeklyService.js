import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    increment,
    serverTimestamp
} from 'firebase/firestore';
import { getAllPigs } from './pigService';
import {
    getDateKeyVN,
    getWeekIdVN,
    getWeekStartDate,
    getWeekStatus,
    updatePigGameSettings
} from './gameSettingsService';

const BATCH_LIMIT = 450;

/**
 * Lấy grade thực tế hiện tại của mỗi heo dựa trên lớp hiện tại của chủ heo,
 * vì field `grade` lưu trên pig doc chỉ được đồng bộ khi HS tự mở trang Heo Đất
 * (có thể bị lệch nếu HS đổi lớp hoặc mua heo trước khi được gán lớp).
 */
const resolveCurrentGrades = async (pigs) => {
    const [classesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'users'))
    ]);

    const classGradeMap = {};
    classesSnap.forEach(d => {
        classGradeMap[d.id] = parseInt(d.data().grade) || 0;
    });

    const userClassMap = {};
    usersSnap.forEach(d => {
        userClassMap[d.id] = d.data().classes || [];
    });

    return pigs.map(pig => {
        const userClasses = userClassMap[pig.ownerUid] || [];
        const grade = userClasses.length > 0 ? (classGradeMap[userClasses[0]] || 0) : 0;
        return { ...pig, grade };
    });
};

/**
 * Xem trước kết quả chốt tuần (chỉ đọc, không ghi).
 * Mỗi khối: top N heo (level desc → xp desc → đạt XP trước) được +1 lượt đập heo.
 * Heo của HS chưa được xếp lớp (grade = 0) không vào bảng xếp hạng khối nào,
 * nhưng vẫn bị reset cùng toàn bộ heo khác.
 */
export const previewWeeklyResults = async (settings, weekId = null) => {
    const rawPigs = await getAllPigs(); // đã sort sẵn
    const allPigs = await resolveCurrentGrades(rawPigs);

    const gradeGroups = {};
    const ungradedPigs = [];
    allPigs.forEach(pig => {
        const grade = pig.grade ?? 0;
        if (!grade) {
            ungradedPigs.push(pig);
            return;
        }
        if (!gradeGroups[grade]) gradeGroups[grade] = [];
        gradeGroups[grade].push(pig);
    });

    const grades = {};
    Object.keys(gradeGroups).forEach(grade => {
        const pigs = gradeGroups[grade];
        const topN = settings.smashTopNByGrade?.[grade] ?? 3;
        grades[grade] = {
            topLevel: pigs[0]?.level || 1,
            totalPigs: pigs.length,
            smashWinners: pigs.slice(0, topN).map((pig, index) => ({
                uid: pig.ownerUid,
                name: pig.ownerName || '',
                level: pig.level || 1,
                xp: pig.xp || 0,
                rank: index + 1
            }))
        };
    });

    return {
        weekId: weekId || settings.currentWeekId,
        grades,
        totalPigs: allPigs.length,
        ungradedCount: ungradedPigs.length,
        allPigUids: allPigs.map(p => p.id)
    };
};

/**
 * Chốt tuần (admin): +1 lượt đập cho top N mỗi khối, reset TOÀN BỘ heo về cấp 1 / 0 XP.
 * Heo top KHÔNG bị xóa lúc chốt — chỉ vỡ khi HS bấm đập (đập xong phải mua heo mới).
 *
 * Lưu ý: preview là ảnh chụp tại lúc admin bấm "Xem trước", HS vẫn có thể đập heo
 * (xóa pig doc) hoặc mua heo mới trước khi admin bấm chốt. Vì vậy danh sách heo cần
 * reset được ĐỌC LẠI ngay tại đây, không dùng preview.allPigUids.
 * Mọi ghi đều dùng set(merge) thay vì update() — update() vào doc đã bị xóa sẽ làm
 * hỏng cả batch và không thể rollback các batch đã commit trước đó.
 */
export const finalizeWeek = async (preview, adminUid) => {
    const weekId = preview.weekId;
    const resultRef = doc(db, 'pigWeeklyResults', weekId);

    const existing = await getDoc(resultRef);
    if (existing.exists()) {
        throw new Error(`Tuần ${weekId} đã được chốt rồi! Không thể chốt lại.`);
    }

    const allWinners = Object.values(preview.grades).flatMap(g => g.smashWinners);

    // Đọc lại danh sách heo tại thời điểm chốt (preview có thể đã cũ)
    const livePigs = await getAllPigs();
    const livePigUids = livePigs.map(p => p.id);

    // Gom các thao tác ghi, chia batch (giới hạn 500 ops/batch)
    const operations = [];

    allWinners.forEach(winner => {
        operations.push(batch => {
            batch.set(doc(db, 'users', winner.uid), {
                smashAttempts: increment(1),
                updatedAt: serverTimestamp()
            }, { merge: true });
            batch.set(doc(collection(db, 'pigGameLogs')), {
                uid: winner.uid,
                userName: winner.name,
                type: 'weekly_award',
                detail: { weekId, rank: winner.rank, level: winner.level, xp: winner.xp },
                dateKey: getDateKeyVN(),
                weekId,
                createdAt: serverTimestamp()
            });
        });
    });

    livePigUids.forEach(uid => {
        operations.push(batch => {
            batch.set(doc(db, 'pigs', uid), {
                xp: 0,
                level: 1,
                lastXpAt: null,
                windowFeeds: {},
                extraFeeds: { dateKey: null, count: 0 },
                updatedAt: serverTimestamp()
            }, { merge: true });
            batch.set(doc(db, 'users', uid), { pigLevel: 1 }, { merge: true });
        });
    });

    // Chạy batch theo chunk (mỗi operation ~2 ops ghi)
    let batch = writeBatch(db);
    let opCount = 0;
    for (const op of operations) {
        op(batch);
        opCount += 2;
        if (opCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
        }
    }

    // Ghi kết quả tuần (đồng thời là khóa chống chốt 2 lần)
    const { allPigUids: _omit, ...resultData } = preview;
    batch.set(resultRef, {
        ...resultData,
        finalizedAt: serverTimestamp(),
        finalizedBy: adminUid,
        totalPigsReset: livePigUids.length
    });
    await batch.commit();

    // Sang tuần kế tiếp của tuần vừa chốt (chốt trễ thì không nhảy cóc qua tuần chưa chốt)
    const monday = getWeekStartDate(weekId);
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(monday.getUTCDate() + 7);
    const nextWeekId = getWeekIdVN(nextMonday);
    await updatePigGameSettings({ currentWeekId: nextWeekId });

    return { weekId, nextWeekId, winnersCount: allWinners.length, pigsReset: livePigUids.length };
};

/**
 * Tuần của hoạt động game cũ nhất còn lưu — dùng làm mốc chặn, để hệ thống không
 * đòi admin chốt những tuần trước cả khi game bắt đầu chạy.
 */
const getEarliestActivityWeekId = async () => {
    const q = query(collection(db, 'pigGameLogs'), orderBy('createdAt', 'asc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const log = snapshot.docs[0].data();
    return log.weekId || (log.createdAt?.toDate ? getWeekIdVN(log.createdAt.toDate()) : null);
};

/**
 * Xác định tuần nên chốt, để admin không phải tự nghĩ weekId.
 *
 * currentWeekId có thể đang trỏ vào tuần đang diễn ra dù tuần trước chưa chốt
 * (mặc định lấy tuần hiện tại khi settings chưa có giá trị). Hàm này dò ngược
 * để tìm tuần đã KẾT THÚC nhưng CHƯA được chốt — đó mới là tuần cần chốt.
 * Không có tuần nào như vậy thì trả về tuần đang diễn ra.
 */
export const resolveWeekToFinalize = async () => {
    const thisWeekId = getWeekIdVN();
    const thisMonday = getWeekStartDate(thisWeekId);

    // Điểm bắt đầu dò = tuần cũ nhất còn có thể chưa chốt, lấy theo thứ tự ưu tiên:
    //  1. Tuần ngay sau tuần đã chốt gần nhất (trước đó chắc chắn xong rồi)
    //  2. Tuần có hoạt động game đầu tiên (hệ thống mới, chưa chốt lần nào)
    //  3. Tuần hiện tại
    // Không thể chỉ dựa vào currentWeekId: khi settings chưa từng được ghi, nó mặc
    // định là tuần hiện tại và tuần vừa kết thúc sẽ bị bỏ sót âm thầm.
    const [latestResult, earliestWeekId] = await Promise.all([
        getLatestWeeklyResult(),
        getEarliestActivityWeekId()
    ]);

    let startMonday = null;
    if (latestResult?.weekId) {
        const m = getWeekStartDate(latestResult.weekId);
        if (m) {
            startMonday = new Date(m);
            startMonday.setUTCDate(m.getUTCDate() + 7);
        }
    }
    if (!startMonday && earliestWeekId) startMonday = getWeekStartDate(earliestWeekId);
    if (!startMonday) startMonday = thisMonday;

    // Chặn trên: không dò quá tuần hiện tại. Chặn dưới: tối đa 12 tuần để tránh
    // quét vô hạn nếu dữ liệu cũ bất thường.
    if (startMonday > thisMonday) startMonday = thisMonday;
    const MAX_WEEKS = 12;

    const candidates = [];
    const cursor = new Date(startMonday);
    for (let i = 0; i < MAX_WEEKS; i++) {
        const id = getWeekIdVN(cursor);
        candidates.push(id);
        if (id === thisWeekId) break;
        cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    if (!candidates.includes(thisWeekId)) candidates.push(thisWeekId);

    const snaps = await Promise.all(
        candidates.map(id => getDoc(doc(db, 'pigWeeklyResults', id)))
    );

    // Tuần đã kết thúc mà chưa chốt → ưu tiên chốt tuần cũ nhất
    for (let i = 0; i < candidates.length; i++) {
        const id = candidates[i];
        if (snaps[i].exists()) continue;
        const status = getWeekStatus(id);
        if (status.isPast) {
            return { weekId: id, ...status, alreadyFinalized: false };
        }
    }

    // Không còn tuần quá hạn → tuần đang diễn ra
    const pendingIndex = candidates.indexOf(thisWeekId);
    return {
        weekId: thisWeekId,
        ...getWeekStatus(thisWeekId),
        alreadyFinalized: pendingIndex >= 0 ? snaps[pendingIndex].exists() : false
    };
};

/**
 * Kết quả tuần gần nhất (hiện trên BXH heo của HS)
 */
export const getLatestWeeklyResult = async () => {
    const q = query(collection(db, 'pigWeeklyResults'), orderBy('finalizedAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

/**
 * Lịch sử các tuần đã chốt (admin)
 */
export const getWeeklyResultsHistory = async (limitN = 20) => {
    const q = query(collection(db, 'pigWeeklyResults'), orderBy('finalizedAt', 'desc'), limit(limitN));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
