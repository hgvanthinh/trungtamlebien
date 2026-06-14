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
import { getDateKeyVN, getWeekIdVN, updatePigGameSettings } from './gameSettingsService';

const BATCH_LIMIT = 450;

/**
 * Xem trước kết quả chốt tuần (chỉ đọc, không ghi).
 * Mỗi khối: top N heo (level desc → xp desc → đạt XP trước) được +1 lượt đập heo.
 */
export const previewWeeklyResults = async (settings) => {
    const allPigs = await getAllPigs(); // đã sort sẵn

    const gradeGroups = {};
    allPigs.forEach(pig => {
        const grade = pig.grade ?? 0;
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
        weekId: settings.currentWeekId,
        grades,
        totalPigs: allPigs.length,
        allPigUids: allPigs.map(p => p.id)
    };
};

/**
 * Chốt tuần (admin): +1 lượt đập cho top N mỗi khối, reset TOÀN BỘ heo về cấp 1 / 0 XP.
 * Heo top KHÔNG bị xóa lúc chốt — chỉ vỡ khi HS bấm đập (đập xong phải mua heo mới).
 */
export const finalizeWeek = async (preview, adminUid) => {
    const weekId = preview.weekId;
    const resultRef = doc(db, 'pigWeeklyResults', weekId);

    const existing = await getDoc(resultRef);
    if (existing.exists()) {
        throw new Error(`Tuần ${weekId} đã được chốt rồi! Không thể chốt lại.`);
    }

    const allWinners = Object.values(preview.grades).flatMap(g => g.smashWinners);

    // Gom các thao tác ghi, chia batch (giới hạn 500 ops/batch)
    const operations = [];

    allWinners.forEach(winner => {
        operations.push(batch => {
            batch.update(doc(db, 'users', winner.uid), {
                smashAttempts: increment(1),
                updatedAt: serverTimestamp()
            });
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

    preview.allPigUids.forEach(uid => {
        operations.push(batch => {
            batch.update(doc(db, 'pigs', uid), {
                xp: 0,
                level: 1,
                lastXpAt: null,
                windowFeeds: {},
                extraFeeds: { dateKey: null, count: 0 },
                updatedAt: serverTimestamp()
            });
            batch.update(doc(db, 'users', uid), { pigLevel: 1 });
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
        totalPigsReset: preview.totalPigs
    });
    await batch.commit();

    // Sang tuần mới
    const nowWeekId = getWeekIdVN();
    const nextWeekId = weekId === nowWeekId
        ? getWeekIdVN(new Date(Date.now() + 7 * 86400000))
        : nowWeekId;
    await updatePigGameSettings({ currentWeekId: nextWeekId });

    return { weekId, nextWeekId, winnersCount: allWinners.length, pigsReset: preview.totalPigs };
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
