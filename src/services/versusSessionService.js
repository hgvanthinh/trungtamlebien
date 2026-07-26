/**
 * Versus Session Service
 * Quản lý phòng chờ (lobby) và trận đấu real-time bằng Firebase Realtime Database.
 *
 * Cấu trúc RTDB (tách node nhỏ để giảm bandwidth):
 *
 * versus_open_lobbies/{gameId}: { title, openedAt }        ← danh sách phòng đang mở (HS nhìn thấy)
 * versus_active_lobby/{adminId}/{gameId}: true             ← pointer giới hạn số phòng mở của admin
 *
 * versus_lobbies/{gameId}/
 *   status, openedAt, teacherId, lastActivityAt
 *   players/{uid}: { name, avatar, joinedAt, status: 'waiting'|'in_match'|'done', matchId }
 *   challenges/{pushId}: { fromPlayerId, fromName, toPlayerId, status, createdAt }
 *
 * versus_sessions/{sessionId}/
 *   meta: { gameId, status, winner, winSteps, questionOrder, submittedToFirestore, rewardClaimed,
 *           player1: {id, name, score, frozenUntil}, player2: {...} }
 *   q_p1 / q_p2: { questionIndex, questionText, questionImage, type, answers..., answered }
 *   rounds_p1 / rounds_p2: lịch sử vòng đấu của từng player
 */

import {
    ref,
    set,
    get,
    update,
    remove,
    onValue,
    off,
    push,
    runTransaction,
    onDisconnect,
} from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { realtimeDb, db } from '../config/firebase';

const LOBBIES_PATH = 'versus_lobbies';
const SESSIONS_PATH = 'versus_sessions';
const ACTIVE_LOBBY_PATH = 'versus_active_lobby'; // {adminId}/{gameId}: true
const OPEN_LOBBIES_PATH = 'versus_open_lobbies'; // {gameId}: { title, openedAt }

// ==================== LOBBY ====================

const MAX_OPEN_LOBBIES = 3;

/**
 * Lấy danh sách gameId của các phòng đang mở của admin.
 * Tự dọn pointer của phòng đã đóng hoặc game đã bị xóa trên Firestore.
 * @returns {Promise<string[]>}
 */
export async function getActiveLobbies(teacherId) {
    const snap = await get(ref(realtimeDb, `${ACTIVE_LOBBY_PATH}/${teacherId}`));
    if (!snap.exists()) return [];
    const ids = Object.keys(snap.val()); // { gameId: true, ... }

    // Verify từng phòng: còn open trên RTDB và doc versusGames còn tồn tại trên Firestore
    const checks = await Promise.all(
        ids.map(async (id) => {
            const s = await get(ref(realtimeDb, `${LOBBIES_PATH}/${id}/status`));
            if (s.val() !== 'open') return { id, open: false, reason: 'rtdb_not_open' };

            try {
                const gameSnap = await getDoc(doc(db, 'versusGames', id));
                if (!gameSnap.exists()) return { id, open: false, reason: 'game_missing' };
            } catch (err) {
                console.warn(`[VersusSession] getActiveLobbies: lỗi check Firestore cho ${id}`, err);
            }

            return { id, open: true };
        })
    );

    // Đóng lobby trên RTDB và dọn pointer cho các phòng không còn hợp lệ
    const stale = checks.filter(c => !c.open);
    if (stale.length) {
        await Promise.all(stale.map(async (c) => {
            if (c.reason === 'game_missing') {
                await set(ref(realtimeDb, `${LOBBIES_PATH}/${c.id}/status`), 'closed');
            }
            await remove(ref(realtimeDb, `${OPEN_LOBBIES_PATH}/${c.id}`));
            await remove(ref(realtimeDb, `${ACTIVE_LOBBY_PATH}/${teacherId}/${c.id}`));
        }));
    }

    return checks.filter(c => c.open).map(c => c.id);
}

/**
 * Admin mở phòng chờ — tối đa MAX_OPEN_LOBBIES phòng cùng lúc.
 * @param {string} gameId - id doc Firestore versusGames
 * @param {string} teacherId - adminUid
 * @param {string} title - tên game hiển thị cho HS ở danh sách phòng mở
 * @returns {Promise<{ ok: boolean, reason?: 'limit_reached' }>}
 */
export async function openLobby(gameId, teacherId, title = '') {
    const openIds = await getActiveLobbies(teacherId);

    // Phòng này đã mở rồi thì mở lại bình thường (idempotent)
    if (!openIds.includes(gameId) && openIds.length >= MAX_OPEN_LOBBIES) {
        return { ok: false, reason: 'limit_reached' };
    }

    const now = Date.now();
    await set(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}`), {
        status: 'open',
        openedAt: now,
        lastActivityAt: now,
        teacherId,
        players: {},
        challenges: {},
    });

    // Ghi pointer + danh sách phòng đang mở cho HS
    await set(ref(realtimeDb, `${ACTIVE_LOBBY_PATH}/${teacherId}/${gameId}`), true);
    await set(ref(realtimeDb, `${OPEN_LOBBIES_PATH}/${gameId}`), { title, openedAt: now });
    return { ok: true };
}

/**
 * Admin đóng phòng chờ
 */
export async function closeLobby(gameId, teacherId) {
    await set(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/status`), 'closed');
    await remove(ref(realtimeDb, `${OPEN_LOBBIES_PATH}/${gameId}`));
    if (teacherId) {
        await remove(ref(realtimeDb, `${ACTIVE_LOBBY_PATH}/${teacherId}/${gameId}`));
    }
}

/**
 * Admin xóa hoàn toàn phòng chờ + tất cả sessions liên quan (tiết kiệm RTDB)
 */
export async function deleteLobby(gameId, teacherId) {
    // Lấy danh sách matchId từ players trước khi xóa lobby
    const lobbySnap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}`));
    if (lobbySnap.exists()) {
        const players = lobbySnap.val().players || {};
        const sessionIds = [...new Set(
            Object.values(players).map(p => p.matchId).filter(Boolean)
        )];
        // Xóa tất cả sessions thuộc lobby
        await Promise.all(sessionIds.map(sid =>
            remove(ref(realtimeDb, `${SESSIONS_PATH}/${sid}`))
        ));
        await remove(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}`));
    }
    await remove(ref(realtimeDb, `${OPEN_LOBBIES_PATH}/${gameId}`));
    if (teacherId) {
        await remove(ref(realtimeDb, `${ACTIVE_LOBBY_PATH}/${teacherId}/${gameId}`));
    }
}

/**
 * HS vào phòng chờ. playerId = uid thật của HS.
 */
export async function joinLobby(gameId, playerId, name, avatar) {
    // Dọn duplicate: entry cũ cùng tên nhưng uid khác (HS đổi thiết bị/tài khoản phụ)
    // → chỉ xóa nếu đang 'waiting', tránh xóa entry đang in_match
    const playersSnap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players`));
    if (playersSnap.exists()) {
        const existing = playersSnap.val();
        const staleIds = Object.entries(existing)
            .filter(([id, p]) => id !== playerId && p.name === name && p.status === 'waiting')
            .map(([id]) => id);
        if (staleIds.length) {
            await Promise.all(
                staleIds.map(id => remove(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${id}`)))
            );
        }
    }

    await set(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${playerId}`), {
        name,
        avatar: avatar || '',
        joinedAt: Date.now(),
        status: 'waiting',
        matchId: null,
    });
}

/**
 * HS rời phòng chờ (xóa hẳn entry khỏi lobby)
 */
export async function leaveLobby(gameId, playerId) {
    await remove(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${playerId}`));
}

/**
 * Cập nhật status của player trong lobby
 * @param {'waiting'|'in_match'|'done'} status
 */
export async function updatePlayerStatus(gameId, playerId, status, matchId = null) {
    await update(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${playerId}`), { status, matchId });
}

/**
 * Lấy thông tin player trong lobby (1 lần, không subscribe)
 * Dùng cho early reconnect check khi vào lobby
 */
export async function getPlayerInLobby(gameId, playerId) {
    const snap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${playerId}`));
    return snap.val();
}

/**
 * Lấy status lobby 1 lần (không subscribe)
 */
export async function getLobbyStatus(gameId) {
    const snap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/status`));
    return snap.val();
}

// ==================== CHALLENGE ====================

/**
 * Gửi challenge đến 1 HS khác
 * @returns {Promise<string>} challengeId
 */
export async function sendChallenge(gameId, fromPlayerId, fromName, toPlayerId) {
    const newChallengeRef = push(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/challenges`));
    await set(newChallengeRef, {
        fromPlayerId,
        fromName,
        toPlayerId,
        status: 'pending',
        createdAt: Date.now(),
    });
    return newChallengeRef.key;
}

/**
 * Hủy challenge đã gửi
 */
export async function cancelChallenge(gameId, challengeId) {
    await remove(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/challenges/${challengeId}`));
}

/**
 * Trả lời challenge (accept hoặc reject).
 * Nếu accept: kiểm tra cả 2 đều còn 'waiting' + chưa vượt maxMatches, rồi tạo match.
 * @param {Object|null} gameSnapshot - data doc versusGames đã đọc sẵn từ caller (có thể null)
 * @returns {Promise<string|null>} sessionId nếu accept thành công, null nếu reject/fail
 */
export async function respondToChallenge(gameId, challengeId, accept, gameSnapshot) {
    const challengeRef = ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/challenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);
    if (!challengeSnap.exists()) return null;

    const challenge = challengeSnap.val();

    if (!accept) {
        await update(challengeRef, { status: 'rejected' });
        // Xóa sau 2s để challenger kịp thấy trạng thái rejected
        setTimeout(() => remove(challengeRef), 2000);
        return null;
    }

    // Nếu gameSnapshot bị mất (HS reload trang trước khi nhận challenge),
    // đọc lại doc versusGames từ Firestore để đảm bảo winSteps và questions luôn đúng
    let effectiveSnapshot = gameSnapshot;
    if (!effectiveSnapshot) {
        try {
            const gameSnap = await getDoc(doc(db, 'versusGames', gameId));
            if (gameSnap.exists()) effectiveSnapshot = gameSnap.data();
        } catch (err) {
            console.error('[VersusSession] Không đọc lại được versusGames từ Firestore:', err);
        }
    }

    // Kiểm tra cả 2 đều còn waiting
    const p1Snap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${challenge.fromPlayerId}`));
    const p2Snap = await get(ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players/${challenge.toPlayerId}`));

    if (!p1Snap.exists() || !p2Snap.exists()) return null;
    const p1 = p1Snap.val();
    const p2 = p2Snap.val();

    if (p1.status !== 'waiting' || p2.status !== 'waiting') {
        // Người kia đã bắt đầu trận khác
        await update(challengeRef, { status: 'rejected' });
        setTimeout(() => remove(challengeRef), 2000);
        return null;
    }

    // Kiểm tra giới hạn số trận (matchesPlayed trong doc versusGames)
    const maxMatches = effectiveSnapshot?.maxMatches ?? 20;
    const matchesPlayed = effectiveSnapshot?.matchesPlayed ?? 0;
    if (matchesPlayed >= maxMatches) {
        await update(challengeRef, { status: 'rejected' });
        setTimeout(() => remove(challengeRef), 2000);
        return null;
    }

    // Tạo match
    const sessionId = await createMatch(gameId, challenge.fromPlayerId, p1, challenge.toPlayerId, p2, effectiveSnapshot);

    // Xóa challenge
    await remove(challengeRef);

    return sessionId;
}

// ==================== MATCH ====================

/** Fisher-Yates shuffle — trả về mảng mới, không mutate */
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Tạo match mới trong RTDB + cập nhật status players trong lobby.
 * @param {Object} gameSnapshot - data doc versusGames (questions, winSteps, shuffleAnswers...)
 * @returns {Promise<string>} sessionId
 */
export async function createMatch(gameId, p1Id, p1Data, p2Id, p2Data, gameSnapshot) {
    const sessionRef = push(ref(realtimeDb, SESSIONS_PATH));
    const sessionId = sessionRef.key;

    const rawQuestions = gameSnapshot?.questions || [];
    const winSteps = gameSnapshot?.winSteps || 5;
    const shuffle = gameSnapshot?.shuffleAnswers === true;

    // Shuffle thứ tự câu hỏi mỗi trận để HS không thuộc vị trí.
    // Lưu questionOrder (mảng index vào pool gốc) vào meta để cả 2 client dùng chung.
    const baseOrder = rawQuestions.map((_, i) => i);
    const questionOrder = rawQuestions.length > 1 ? shuffleArray(baseOrder) : baseOrder;

    // Chọn 2 câu hỏi ban đầu (khác nhau nếu có thể)
    const q1Index = 0;
    const q2Index = rawQuestions.length > 1 ? 1 : 0;
    const q1 = buildQuestionNode(rawQuestions, questionOrder[q1Index], shuffle);
    const q2 = buildQuestionNode(rawQuestions, questionOrder[q2Index], shuffle);

    // Ghi session với các node tách biệt
    // scheduledDeleteAt: fallback TTL cho cleanup nếu client-side setTimeout fail
    const SESSION_TTL_MS = 10 * 60 * 1000; // 10 phút sau khi tạo
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`), {
        gameId,
        status: 'playing',
        winner: null,
        winSteps,
        questionOrder,
        submittedToFirestore: false,
        rewardClaimed: false,
        startedAt: Date.now(),
        scheduledDeleteAt: Date.now() + SESSION_TTL_MS,
        player1: { id: p1Id, name: p1Data.name, score: 0, frozenUntil: 0 },
        player2: { id: p2Id, name: p2Data.name, score: 0, frozenUntil: 0 },
    });
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/q_p1`), { ...q1, answered: false });
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/q_p2`), { ...q2, answered: false });

    // Cập nhật status players trong lobby
    await updatePlayerStatus(gameId, p1Id, 'in_match', sessionId);
    await updatePlayerStatus(gameId, p2Id, 'in_match', sessionId);

    return sessionId;
}

/**
 * Build question node từ pool (cycling).
 * Hỗ trợ 3 loại: abcd (mặc định), true_false (statements), short_answer.
 */
function buildQuestionNode(questions, index, shuffle = false) {
    if (!questions || questions.length === 0) {
        return { questionIndex: 0, questionText: '', questionImage: '', answers: [], type: 'abcd' };
    }
    const safeIndex = index % questions.length;
    const q = questions[safeIndex];
    const qType = q.type || 'abcd';
    const base = {
        questionIndex: safeIndex,
        questionText: q.questionText || '',
        questionImage: q.questionImage || '',
        type: qType,
    };

    if (qType === 'true_false') {
        base.statements = (q.statements || []).map(s => ({ text: s.text || '', isTrue: !!s.isTrue }));
        return base;
    }
    if (qType === 'short_answer') {
        base.shortAnswer = q.correctAnswer || '';
        base.alternativeAnswers = q.alternativeAnswers || [];
        return base;
    }

    // abcd — có thể shuffle đáp án
    const originalAnswers = q.answers || [];
    if (shuffle && originalAnswers.length > 1) {
        // Gắn originalIndex trước khi shuffle để client map lại khi submit
        const withIdx = originalAnswers.map((a, i) => ({ text: a.text, isCorrect: a.isCorrect, originalIndex: i }));
        base.answers = shuffleArray(withIdx);
    } else {
        base.answers = originalAnswers.map((a, i) => ({ text: a.text, isCorrect: a.isCorrect, originalIndex: i }));
    }
    return base;
}

/**
 * HS trả lời câu hỏi.
 * @param {string} sessionId
 * @param {'player1'|'player2'} playerKey
 * @param {number} answerIndex - abcd: index đáp án được chọn (vị trí hiển thị);
 *                               true_false/short_answer: client gửi 1 = đúng, 0 = sai
 * @param {Array} questions - toàn bộ pool câu hỏi từ gameSnapshot
 * @param {number} currentQuestionIndex - index thực trong pool gốc của câu hiện tại
 * @param {number} winSteps
 * @param {number} currentScore - điểm hiện tại của player này
 * @param {boolean} shuffle - có shuffle đáp án không
 * @param {number[]|null} questionOrder - thứ tự câu hỏi đã shuffle (từ meta)
 * @param {number} freezeDuration - số giây đóng băng khi trả lời sai
 * @param {number} steps - số bước tiến khi đúng (2 khi HS dùng vật phẩm Nhân đôi)
 * @returns {Promise<'correct'|'wrong'|'win'>}
 */
export async function submitAnswer(sessionId, playerKey, answerIndex, questions, currentQuestionIndex, winSteps, currentScore, shuffle = false, questionOrder = null, freezeDuration = 3, steps = 1) {
    const qNode = playerKey === 'player1' ? 'q_p1' : 'q_p2';
    const q = questions[currentQuestionIndex % questions.length];
    const qType = q?.type || 'abcd';

    let isCorrect = false;
    if (qType === 'true_false' || qType === 'short_answer') {
        // Loại không phải abcd: client tự chấm và gửi answerIndex = 1 (đúng) / 0 (sai)
        isCorrect = answerIndex === 1;
    } else {
        // abcd: answerIndex là vị trí hiển thị (có thể đã shuffle),
        // isCorrect client tính dựa vào originalIndex — ở đây chỉ trust kết quả boolean
        isCorrect = (q.answers || [])[answerIndex]?.isCorrect === true;
    }

    if (!isCorrect) {
        // Sai: set frozenUntil (client-side timer đếm ngược)
        await update(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta/${playerKey}`), {
            frozenUntil: Date.now() + freezeDuration * 1000,
        });
        return 'wrong';
    }

    // Đúng: tăng score theo steps (1 hoặc 2 nếu dùng Nhân đôi) + gán câu mới
    const newScore = currentScore + steps;
    const nextIndex = currentQuestionIndex + 1;

    // Kiểm tra thắng
    if (newScore >= winSteps) {
        // Dùng transaction để tránh double-write khi cả 2 cùng cán đích
        const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
        let won = false;
        await runTransaction(metaRef, (meta) => {
            if (!meta) return meta;
            if (meta.status === 'finished') return meta; // đã có winner
            won = true;
            return {
                ...meta,
                status: 'finished',
                winner: playerKey,
                [playerKey]: { ...meta[playerKey], score: newScore },
                // Cập nhật TTL: 10 phút từ lúc match kết thúc để xem kết quả
                scheduledDeleteAt: Date.now() + 10 * 60 * 1000,
            };
        });

        if (won) return 'win';
        // Người kia đã thắng trước, chỉ cập nhật score
        await update(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta/${playerKey}`), { score: newScore });
        return 'correct';
    }

    // Chưa thắng: cập nhật score + câu mới
    // questionOrder lưu thứ tự câu đã shuffle; nextIndex là position trong order đó
    const nextResolvedIndex = (questionOrder && questionOrder.length > 0)
        ? questionOrder[nextIndex % questionOrder.length]
        : nextIndex % questions.length;
    const nextQ = buildQuestionNode(questions, nextResolvedIndex, shuffle);
    await update(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta/${playerKey}`), { score: newScore });
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/${qNode}`), { ...nextQ, answered: false });

    return 'correct';
}

/**
 * HS đầu hàng — đối thủ thắng. Dùng transaction để tránh race condition.
 * @param {'player1'|'player2'} loserKey
 * @returns {Promise<boolean>} true nếu cập nhật thành công
 */
export async function surrender(sessionId, loserKey) {
    const winnerKey = loserKey === 'player1' ? 'player2' : 'player1';
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    let done = false;
    let savedMeta = null;
    await runTransaction(metaRef, (meta) => {
        if (!meta || meta.status === 'finished') return meta;
        done = true;
        savedMeta = meta;
        return { ...meta, status: 'finished', winner: winnerKey, surrendered: loserKey };
    });
    // Cập nhật lobby player status → 'done' để tránh reconnect về trận đã kết thúc
    if (done && savedMeta?.gameId) {
        const updates = {};
        if (savedMeta.player1?.id) updates[`${LOBBIES_PATH}/${savedMeta.gameId}/players/${savedMeta.player1.id}/status`] = 'done';
        if (savedMeta.player2?.id) updates[`${LOBBIES_PATH}/${savedMeta.gameId}/players/${savedMeta.player2.id}/status`] = 'done';
        if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
    }
    return done;
}

/**
 * Xử lý thắng do đối thủ disconnect quá lâu (~45s, caller tự đếm giờ).
 * Dùng transaction — chỉ 1 client claim thành công.
 * @param {'player1'|'player2'} winnerKey
 * @returns {Promise<boolean>} true nếu claim thành công
 */
export async function claimWinByDisconnect(sessionId, winnerKey) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    let claimed = false;
    let savedMeta = null;
    await runTransaction(metaRef, (meta) => {
        if (!meta) return meta;
        if (meta.status === 'finished') return meta;
        claimed = true;
        savedMeta = meta;
        return { ...meta, status: 'finished', winner: winnerKey };
    });
    // Cập nhật status cả 2 player về 'done' trong lobby để tránh reconnect về trận cũ
    if (claimed && savedMeta?.gameId) {
        const updates = {};
        if (savedMeta.player1?.id) updates[`${LOBBIES_PATH}/${savedMeta.gameId}/players/${savedMeta.player1.id}/status`] = 'done';
        if (savedMeta.player2?.id) updates[`${LOBBIES_PATH}/${savedMeta.gameId}/players/${savedMeta.player2.id}/status`] = 'done';
        if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
    }
    return claimed;
}

/**
 * Admin force-finish 1 trận (hủy trận không có winner).
 * Cập nhật cả player status trong lobby → biến mất khỏi "Trận đang diễn ra".
 */
export async function forceFinishMatch(sessionId, gameId) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    let meta = null;
    await runTransaction(metaRef, (m) => {
        if (!m || m.status === 'finished') return m;
        meta = m;
        return { ...m, status: 'finished', winner: null, forceStopped: true };
    });
    // Cập nhật status 2 player trong lobby về 'done'
    if (meta && gameId) {
        const updates = {};
        if (meta.player1?.id) updates[`${LOBBIES_PATH}/${gameId}/players/${meta.player1.id}/status`] = 'done';
        if (meta.player2?.id) updates[`${LOBBIES_PATH}/${gameId}/players/${meta.player2.id}/status`] = 'done';
        if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
    }
}

// ==================== CLAIM / CLEANUP ====================

/**
 * Đánh dấu Firestore đã được submit (tránh double-write).
 * Dùng transaction trên cờ submittedToFirestore — chỉ 1 client thành công.
 * @returns {Promise<boolean>} true nếu client này được phép submit
 */
export async function claimFirestoreSubmission(sessionId) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    let claimed = false;
    await runTransaction(metaRef, (meta) => {
        if (!meta) return meta;
        if (meta.submittedToFirestore) return meta; // đã có người submit
        claimed = true;
        return { ...meta, submittedToFirestore: true };
    });
    return claimed;
}

/**
 * Claim quyền nhận thưởng (chống cộng xu 2 lần khi reload/duplicate tab).
 * Transaction trên cờ rewardClaimed — chỉ lần đầu trả về true.
 * @returns {Promise<boolean>} true nếu client này được phép cộng thưởng
 */
export async function claimReward(sessionId) {
    const claimedRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta/rewardClaimed`);
    let claimed = false;
    await runTransaction(claimedRef, (current) => {
        if (current === true) return current; // đã claim rồi
        claimed = true;
        return true;
    });
    return claimed;
}

/**
 * Cleanup session sau ~5 phút (client-side setTimeout)
 */
export function scheduleSessionCleanup(sessionId, delayMs = 5 * 60 * 1000) {
    setTimeout(async () => {
        try {
            await remove(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}`));
        } catch (e) {
            console.error('[VersusSession] Cleanup error:', e);
        }
    }, delayMs);
}

/**
 * Xóa session ngay lập tức
 */
export async function deleteSession(sessionId) {
    await remove(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}`));
}

// ==================== ROUNDS HISTORY ====================

/**
 * Mỗi player tự lưu lịch sử rounds của mình vào RTDB khi match kết thúc.
 * Winner sẽ đọc cả 2 (waitForPlayerRounds) để gộp vào Firestore.
 * RTDB xóa node khi set [] → dùng sentinel {_empty: true} để phân biệt "đã lưu nhưng rỗng".
 */
export async function savePlayerRounds(sessionId, playerKey, rounds) {
    const node = playerKey === 'player1' ? 'rounds_p1' : 'rounds_p2';
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/${node}`), rounds.length > 0 ? rounds : { _empty: true });
}

/**
 * Chờ rounds của đối thủ xuất hiện trên RTDB, timeout sau timeoutMs.
 * Dùng onValue để react ngay khi dữ liệu có, không poll.
 * @returns {Promise<Array>}
 */
export function waitForPlayerRounds(sessionId, playerKey, timeoutMs = 4000) {
    const node = playerKey === 'player1' ? 'rounds_p1' : 'rounds_p2';
    const roundsRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/${node}`);
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            unsub();
            resolve([]); // timeout — trả về rỗng
        }, timeoutMs);

        const unsub = onValue(roundsRef, (snap) => {
            const val = snap.val();
            if (!val) return; // chưa có, đợi tiếp
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            unsub();
            // RTDB chuyển mảng JS thành object {0:..., 1:...}; sentinel {_empty:true} nghĩa là 0 rounds
            if (val._empty) { resolve([]); return; }
            const arr = Array.isArray(val) ? val : Object.values(val);
            resolve(arr);
        });
    });
}

// ==================== DISCONNECT ====================

/**
 * Đăng ký onDisconnect: khi HS mất kết nối, RTDB server tự set disconnectedAt.
 * Gọi ngay khi vào match. Tự clear disconnectedAt cũ (trường hợp vừa reconnect).
 * @returns {Promise<Function>} cancelDisconnect — gọi khi rời match bình thường để hủy trigger
 */
export async function registerDisconnect(sessionId, playerKey) {
    const disconnectedRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta/${playerKey}/disconnectedAt`);
    // Clear disconnectedAt cũ nếu có (player vừa reconnect / mount lại)
    await set(disconnectedRef, null);
    const handler = onDisconnect(disconnectedRef);
    handler.set(Date.now());
    return () => handler.cancel();
}

// ==================== LISTENERS ====================

/**
 * Listen danh sách phòng đang mở (HS dùng để thấy phòng nào có thể vào)
 * @param {Function} callback - nhận object { gameId: { title, openedAt } } hoặc null
 * @returns {Function} unsubscribe
 */
export function listenToOpenLobbies(callback) {
    const openRef = ref(realtimeDb, OPEN_LOBBIES_PATH);
    onValue(openRef, (snap) => callback(snap.val()));
    return () => off(openRef);
}

/**
 * Listen toàn bộ lobby (admin dùng, HS dùng)
 */
export function listenToLobby(gameId, callback) {
    const lobbyRef = ref(realtimeDb, `${LOBBIES_PATH}/${gameId}`);
    onValue(lobbyRef, (snap) => callback(snap.val()));
    return () => off(lobbyRef);
}

/**
 * Listen chỉ node players trong lobby (tiết kiệm băng thông hơn listenToLobby)
 */
export function listenToLobbyPlayers(gameId, callback) {
    const playersRef = ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/players`);
    onValue(playersRef, (snap) => callback(snap.val()));
    return () => off(playersRef);
}

/**
 * Listen chỉ node challenges trong lobby
 */
export function listenToLobbyChallenges(gameId, callback) {
    const challengesRef = ref(realtimeDb, `${LOBBIES_PATH}/${gameId}/challenges`);
    onValue(challengesRef, (snap) => callback(snap.val()));
    return () => off(challengesRef);
}

/**
 * Listen meta của session (cả 2 players + admin spectator)
 */
export function listenToSessionMeta(sessionId, callback) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    onValue(metaRef, (snap) => callback(snap.val()));
    return () => off(metaRef);
}

/**
 * Listen câu hỏi riêng của 1 player (q_p1 hoặc q_p2)
 */
export function listenToPlayerQuestion(sessionId, playerKey, callback) {
    const qNode = playerKey === 'player1' ? 'q_p1' : 'q_p2';
    const qRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/${qNode}`);
    onValue(qRef, (snap) => callback(snap.val()));
    return () => off(qRef);
}

/**
 * Lấy snapshot 1 lần của session meta (không listen liên tục)
 */
export async function getSessionMeta(sessionId) {
    const snap = await get(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`));
    return snap.val();
}
