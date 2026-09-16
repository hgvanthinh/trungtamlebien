/**
 * Arena Session Service
 * Quản lý phòng chờ và trận đấu Đấu Trường (nhiều người chơi) trên Firebase Realtime Database.
 *
 * KHÁC BIỆT CỐT LÕI SO VỚI ĐẤU TRÍ 1v1:
 * 1. Đáp án KHÔNG BAO GIỜ xuống RTDB. Đề đầy đủ (có đáp án) nằm ở Firestore
 *    `arenaSessions/{sessionId}` mà HS không đọc được; RTDB chỉ có bản đã lược đáp án.
 *    Chấm điểm do Cloud Function `finalizeArenaMatch` làm, công bố cuối trận.
 * 2. Timer đồng bộ toàn phòng bằng DEADLINE TUYỆT ĐỐI (`questionEndsAt`), so với
 *    thời gian server (`serverNow()` từ /.info/serverTimeOffset), không phải Date.now() thô.
 * 3. Không có "leader" đẩy câu. Mọi client đều gọi advanceArenaPhase khi hết giờ;
 *    runTransaction với guard idempotent đảm bảo chỉ lần đầu có tác dụng.
 *
 * Cấu trúc RTDB:
 *
 * arena_open_rooms/{roomId}: { title, grade, folderName, status, playerCount, openedAt }
 * arena_active_rooms/{adminUid}/{roomId}: true
 *
 * arena_lobbies/{roomId}/
 *   status: 'open'|'countdown'|'running'|'finished'|'closed'
 *   teacherId, hostUid, hostMode: 'admin'|'student', allowStudentHost
 *   folderId, folderName, grade, minPlayers, maxPlayers
 *   sessionId, countdownEndsAt, openedAt, lastActivityAt
 *   players/{uid}: { name, avatar, borderUrl, grade, joinedAt, online }
 *
 * arena_sessions/{sessionId}/
 *   meta: { roomId, status, questionIndex, phase, questionEndsAt, phaseEndsAt,
 *           startedAt, totalQuestions, playerCount }
 *   questions/{0..4}: đề ĐÃ LƯỢC ĐÁP ÁN
 *   answers/{uid}/{qIndex}: { choice, tf, text, submittedAt, elapsedMs }
 *   effects/{uid}: { used, frozenUntil, frozenBy, doubleOn, fifty, hintTf }
 *   presence/{uid}: boolean
 *   results: { ranking, gradedAt }   ← Cloud Function ghi
 */

import {
    ref,
    set,
    get,
    update,
    remove,
    onValue,
    push,
    runTransaction,
    onDisconnect,
} from 'firebase/database';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { realtimeDb, db } from '../config/firebase';
import { serverNowSync } from '../hooks/useServerTime';
import {
    getArenaSettings,
    getQuestionSeconds,
} from './arenaSettingsService';

/**
 * Hai chế độ phòng:
 * - LIVE: cả phòng thi cùng lúc, chủ phòng bấm bắt đầu (chế độ gốc).
 * - PRACTICE: phòng mở thường trực, HS vào lúc nào cũng được, làm một mình với
 *   đề random. Không chờ ai, không vật phẩm, xong là biết đáp án ngay.
 */
export const ARENA_MODE = {
    LIVE: 'live',
    PRACTICE: 'practice',
};

const ROOMS_PATH = 'arena_lobbies';
const SESSIONS_PATH = 'arena_sessions';
const ACTIVE_ROOMS_PATH = 'arena_active_rooms';
const OPEN_ROOMS_PATH = 'arena_open_rooms';

// ==================== PHÒNG (ADMIN) ====================

/**
 * Lấy danh sách roomId đang mở của admin, tự dọn pointer của phòng đã đóng.
 * @param {string} teacherId - adminUid
 * @param {string|null} onlyMode - chỉ đếm phòng thuộc chế độ này ('live'|'practice')
 * @returns {Promise<string[]>}
 */
export async function getActiveRooms(teacherId, onlyMode = null) {
    const snap = await get(ref(realtimeDb, `${ACTIVE_ROOMS_PATH}/${teacherId}`));
    if (!snap.exists()) return [];

    const ids = Object.keys(snap.val());
    const checks = await Promise.all(
        ids.map(async (id) => {
            const roomSnap = await get(ref(realtimeDb, `${ROOMS_PATH}/${id}`));
            const room = roomSnap.val();
            const status = room?.status;
            // Phòng đang chạy trận vẫn tính là đang chiếm slot
            const live = status === 'open' || status === 'countdown' || status === 'running';
            const mode = room?.mode || ARENA_MODE.LIVE;
            return { id, active: live && (!onlyMode || mode === onlyMode), live };
        })
    );

    const stale = checks.filter((c) => !c.live);
    if (stale.length) {
        await Promise.all(
            stale.map(async (c) => {
                await remove(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${c.id}`));
                await remove(ref(realtimeDb, `${ACTIVE_ROOMS_PATH}/${teacherId}/${c.id}`));
            })
        );
    }

    return checks.filter((c) => c.active).map((c) => c.id);
}

/**
 * Admin mở phòng Đấu Trường mới.
 * @param {Object} params
 * @param {string} params.teacherId - adminUid
 * @param {string} params.title - tên phòng hiển thị cho HS
 * @param {string} params.folderId - thư mục kho câu hỏi làm nguồn đề
 * @param {string} params.folderName - tên thư mục (hiển thị)
 * @param {number|null} params.grade - khối được phép chơi (null = mọi khối)
 * @param {boolean} params.allowStudentHost - cho phép HS vào đầu tiên làm chủ phòng
 * @returns {Promise<{ ok: boolean, roomId?: string, reason?: string }>}
 */
export async function openArenaRoom({
    teacherId,
    title,
    folderId,
    folderName = '',
    grade = null,
    allowStudentHost = false,
    mode = ARENA_MODE.LIVE,
}) {
    const settings = await getArenaSettings();

    // Hạn mức phòng chỉ áp cho phòng THI ĐẤU. Phòng luyện tập mở thường trực
    // cho HS tự vào, nếu tính chung thì mở vài phòng luyện là hết slot thi đấu.
    if (mode === ARENA_MODE.LIVE) {
        const openIds = await getActiveRooms(teacherId, ARENA_MODE.LIVE);
        if (openIds.length >= (settings.maxOpenRooms ?? 3)) {
            return { ok: false, reason: 'limit_reached' };
        }
    }

    // Kiểm tra thư mục có đủ câu theo cơ cấu trước khi mở phòng,
    // để admin biết ngay thay vì lỗi lúc HS đã vào đông.
    const availability = await checkFolderAvailability(folderId, settings);
    if (!availability.ok) {
        return { ok: false, reason: 'not_enough_questions', detail: availability };
    }

    const roomId = push(ref(realtimeDb, ROOMS_PATH)).key;
    const now = Date.now();
    const safeGrade = Number(grade) > 0 ? Number(grade) : null;

    await set(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), {
        status: 'open',
        mode,
        teacherId,
        hostUid: teacherId,
        hostMode: 'admin',
        allowStudentHost: !!allowStudentHost,
        title,
        folderId,
        folderName,
        grade: safeGrade,
        minPlayers: settings.minPlayers,
        maxPlayers: settings.maxPlayers,
        sessionId: null,
        countdownEndsAt: null,
        playerCount: 0,
        openedAt: now,
        lastActivityAt: now,
        players: {},
    });

    await set(ref(realtimeDb, `${ACTIVE_ROOMS_PATH}/${teacherId}/${roomId}`), true);
    await set(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${roomId}`), {
        title,
        mode,
        grade: safeGrade,
        folderName,
        status: 'open',
        playerCount: 0,
        openedAt: now,
    });

    // Lưu cấu hình bền để admin mở lại phòng tương tự
    try {
        await setDoc(doc(db, 'arenaRooms', roomId), {
            title,
            mode,
            folderId,
            folderName,
            grade: safeGrade,
            allowStudentHost: !!allowStudentHost,
            teacherId,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        // Không chặn việc mở phòng nếu ghi Firestore lỗi — RTDB mới là nguồn vận hành
        console.error('Error saving arena room config:', error);
    }

    return { ok: true, roomId };
}

/**
 * Admin đóng phòng (HS trong phòng sẽ bị đẩy ra)
 */
export async function closeArenaRoom(roomId, teacherId) {
    await set(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/status`), 'closed');
    await remove(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${roomId}`));
    if (teacherId) {
        await remove(ref(realtimeDb, `${ACTIVE_ROOMS_PATH}/${teacherId}/${roomId}`));
    }
}

/**
 * Admin mở lại phòng sau khi trận đã xong (hoặc trận treo).
 *
 * Xoá sạch danh sách người chơi cũ — kể cả người rớt mạng chưa kịp rời — để
 * phòng không còn hiện "đang thi đấu" với những cái tên không còn ở đó.
 * Cloud Function cũng tự làm việc này sau khi chấm xong; nút này là lối thoát
 * thủ công cho trường hợp trận treo mà không ai kích hoạt được việc chấm.
 */
export async function reopenArenaRoom(roomId) {
    const snap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    if (!snap.exists()) return;
    const room = snap.val();

    await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), {
        status: 'open',
        sessionId: null,
        countdownEndsAt: null,
        players: null,
        playerCount: 0,
        hostUid: room.allowStudentHost ? room.teacherId || room.hostUid : room.hostUid,
        lastActivityAt: Date.now(),
    });

    try {
        await update(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${roomId}`), {
            status: 'open',
            playerCount: 0,
        });
    } catch {
        // Phòng không còn trong danh sách công khai
    }
}

/**
 * Admin xoá hẳn phòng + session liên quan (dọn RTDB)
 */
export async function deleteArenaRoom(roomId, teacherId) {
    const snap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/sessionId`));
    const sessionId = snap.val();
    if (sessionId) {
        await remove(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}`));
    }
    await remove(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    await remove(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${roomId}`));
    if (teacherId) {
        await remove(ref(realtimeDb, `${ACTIVE_ROOMS_PATH}/${teacherId}/${roomId}`));
    }
}

// ==================== PHÒNG (HỌC SINH) ====================

/**
 * HS vào phòng. Nếu phòng cho phép uỷ quyền và chưa có HS nào làm chủ,
 * người vào đầu tiên trở thành chủ phòng.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function joinArenaRoom(roomId, uid, { name, avatar, borderUrl, grade }) {
    const roomSnap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    if (!roomSnap.exists()) return { ok: false, reason: 'room_not_found' };

    const room = roomSnap.val();
    if (room.status !== 'open') return { ok: false, reason: 'room_not_open' };

    const players = room.players || {};
    const isRejoin = !!players[uid];
    if (!isRejoin && Object.keys(players).length >= (room.maxPlayers || 30)) {
        return { ok: false, reason: 'room_full' };
    }

    await set(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${uid}`), {
        name: name || 'Học sinh',
        avatar: avatar || '',
        borderUrl: borderUrl || '',
        grade: Number(grade) || null,
        joinedAt: Date.now(),
        online: true,
    });

    // Rớt mạng/đóng tab → tự đánh dấu offline (không xoá entry, để còn thấy tên trong bảng)
    onDisconnect(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${uid}/online`)).set(false);

    await syncRoomPlayerCount(roomId);
    await maybeClaimHost(roomId, uid);

    return { ok: true };
}

/**
 * HS rời phòng. Nếu là chủ phòng thì chuyển quyền cho người vào sớm nhất còn lại.
 *
 * Gọi cả khi rời giữa trận: nếu không, phòng giữ mãi tên người đã thoát và
 * danh sách phòng vẫn báo "đang thi đấu" dù không còn ai.
 */
export async function leaveArenaRoom(roomId, uid) {
    onDisconnect(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${uid}/online`)).cancel();
    try {
        await remove(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${uid}`));
    } catch {
        // phòng đã bị xoá — coi như đã rời
    }
    const remaining = await syncRoomPlayerCount(roomId);
    await reassignHostIfNeeded(roomId, uid);

    // Người cuối cùng rời đi → phòng cần được dọn. Việc dọn (ghi `status`) chỉ
    // Cloud Function làm được, nên chỉ báo lại để nơi gọi quyết định.
    return { wasLastPlayer: remaining === 0 };
}

/**
 * Đồng bộ playerCount (denormalize để danh sách phòng không phải tải cả node players).
 */
async function syncRoomPlayerCount(roomId) {
    const snap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players`));
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;

    // Cả hai lệnh đều có thể hỏng khi admin vừa đóng/xoá phòng — đó là tình huống
    // bình thường, không được để nó làm hỏng luồng vào/rời phòng của HS.
    try {
        await set(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/playerCount`), count);
    } catch {
        // phòng đã bị xoá
    }
    try {
        await update(ref(realtimeDb, `${OPEN_ROOMS_PATH}/${roomId}`), { playerCount: count });
    } catch {
        // phòng đã đóng, không cần cập nhật danh sách công khai
    }
    return count;
}

/**
 * HS vào đầu tiên nhận quyền chủ phòng, nếu phòng bật allowStudentHost.
 *
 * Transaction chạy trên ĐÚNG Ô `hostUid`, không phải cả node phòng: rules giới
 * hạn `players/{uid}` cho riêng chủ sở hữu, nên ghi vào node cha (kéo theo cả
 * players của người khác) sẽ bị từ chối.
 */
async function maybeClaimHost(roomId, uid) {
    const roomSnap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    const room = roomSnap.val();
    if (!room || !room.allowStudentHost) return;

    // Đã có HS làm chủ và người đó vẫn còn trong phòng → không giành quyền
    if (room.hostMode === 'student' && room.players?.[room.hostUid]) return;

    const hostRef = ref(realtimeDb, `${ROOMS_PATH}/${roomId}/hostUid`);
    const result = await runTransaction(hostRef, (current) => {
        // Người khác vừa giành mất trong lúc mình đọc → nhường
        if (current && current !== room.hostUid) return undefined;
        return uid;
    });

    if (result.committed) {
        await set(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/hostMode`), 'student');
    }
}

/**
 * Chủ phòng rời đi → chuyển quyền cho người vào sớm nhất còn lại.
 * Cũng chỉ ghi ô hostUid/hostMode, không ghi cả node phòng (xem lý do ở trên).
 */
async function reassignHostIfNeeded(roomId, leavingUid) {
    const roomSnap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    const room = roomSnap.val();
    if (!room || room.hostUid !== leavingUid) return;
    // Phòng do admin làm chủ thì admin vẫn giữ quyền dù không có mặt trong players
    if (room.hostMode === 'admin') return;
    // Rules chỉ cho đổi chủ phòng khi phòng còn đang chờ; trận đã chạy thì
    // chủ phòng không còn vai trò gì nữa nên cũng không cần chuyển.
    if (room.status !== 'open') return;

    const candidates = Object.entries(room.players || {})
        .filter(([id]) => id !== leavingUid)
        .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

    const hostRef = ref(realtimeDb, `${ROOMS_PATH}/${roomId}/hostUid`);

    if (candidates.length === 0) {
        // Không còn ai → trả quyền về cho giáo viên.
        // Giữ nguyên hostMode='student' để phòng vẫn cho HS kế tiếp giành quyền
        // (đổi về 'admin' sẽ khoá luôn cơ chế uỷ quyền của phòng này).
        await runTransaction(hostRef, (current) =>
            current === leavingUid ? room.teacherId : undefined
        );
        return;
    }

    await runTransaction(hostRef, (current) =>
        current === leavingUid ? candidates[0][0] : undefined
    );
}

// ==================== CHỌN ĐỀ ====================

/**
 * Kiểm tra thư mục có đủ câu theo cơ cấu (3 ABCD + 1 đúng-sai + 1 điền) không.
 * @returns {Promise<{ ok: boolean, counts: Object, need: Object }>}
 */
export async function checkFolderAvailability(folderId, settings = null) {
    const cfg = settings || (await getArenaSettings());
    const need = {
        abcd: cfg.abcdCount ?? 3,
        true_false: 1,
        short_answer: 1,
    };

    const questions = await fetchFolderQuestions(folderId);
    const counts = { abcd: 0, true_false: 0, short_answer: 0 };
    questions.forEach((q) => {
        const type = q.type || 'abcd';
        if (counts[type] !== undefined) counts[type] += 1;
    });

    const ok = Object.entries(need).every(([type, n]) => counts[type] >= n);
    return { ok, counts, need };
}

/**
 * Đọc toàn bộ câu hỏi của một thư mục kho đề.
 * CHỈ ADMIN gọi được (firestore.rules chặn HS đọc questionBank) — nên hàm này
 * chỉ chạy lúc admin mở phòng / host bắt đầu trận, không chạy phía HS thường.
 */
async function fetchFolderQuestions(folderId) {
    const q = query(collection(db, 'questionBank'), where('folderId', '==', folderId || null));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// LƯU Ý: việc chọn đề, xáo đáp án và lược đáp án nằm TRỌN ở Cloud Function
// `startArenaMatch` (functions/index.js). Trước đây có bản sao ở client nhưng đã
// bỏ: giữ hai bản sẽ dẫn tới sửa một nơi quên nơi kia, mà đây là đoạn quyết định
// đáp án nào được phép rời khỏi server.

// ==================== BẮT ĐẦU TRẬN ====================
//
// startArenaMatch KHÔNG nằm ở đây mà là Cloud Function
// (src/services/arenaRewardService.js → functions/index.js).
//
// Lý do: chủ phòng có thể là học sinh, mà (1) kho câu hỏi questionBank chỉ admin
// đọc được và (2) doc arenaSessions chứa đáp án nên client bị rules cấm ghi.
// Đặt việc tạo trận ở server cũng ngăn được việc tự bịa đề hay tự chọn đáp án.

// ==================== NHỊP TRẬN ====================

/**
 * Đẩy trận sang phase kế tiếp. AN TOÀN KHI NHIỀU CLIENT GỌI CÙNG LÚC.
 *
 * Guard idempotent: client nào tới sau thấy questionIndex/phase đã đổi thì
 * trả về nguyên trạng — RTDB không ghi khi giá trị không đổi.
 *
 * Deadline câu mới tính TỪ DEADLINE CŨ, không phải từ thời điểm gọi hàm.
 * Nếu tính từ now, mỗi vòng sẽ trôi thêm vài trăm ms do độ trễ mạng,
 * tích luỹ qua 5 câu thành lệch rõ giữa các máy.
 *
 * @param {string} sessionId
 * @param {number} expectedIndex - questionIndex mà client đang thấy
 * @param {string} expectedPhase - 'question' | 'interstitial'
 * @param {Object} settings
 */
export async function advanceArenaPhase(sessionId, expectedIndex, expectedPhase, settings) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);

    const result = await runTransaction(metaRef, (meta) => {
        if (!meta || meta.status !== 'running') return meta;
        if (meta.questionIndex !== expectedIndex || meta.phase !== expectedPhase) return meta;

        // Luyện tập một mình thì không có ai để chờ — bỏ luôn khoảng chuyển câu
        // (vốn chỉ sinh ra làm cửa sổ đặt cược x2 cho chế độ thi đấu).
        const interstitialMs =
            meta.mode === 'practice' ? 0 : (settings.interstitialSeconds ?? 5) * 1000;

        if (expectedPhase === 'question') {
            // Câu cuối vừa hết giờ → chuyển sang chờ chấm
            if (expectedIndex >= meta.totalQuestions - 1) {
                return { ...meta, phase: 'interstitial', status: 'grading', phaseEndsAt: meta.questionEndsAt };
            }
            return {
                ...meta,
                phase: 'interstitial',
                phaseEndsAt: meta.questionEndsAt + interstitialMs,
            };
        }

        // interstitial → câu kế tiếp
        const next = expectedIndex + 1;
        const nextSeconds = getQuestionSeconds(next, settings);
        return {
            ...meta,
            questionIndex: next,
            phase: 'question',
            questionStartsAt: meta.phaseEndsAt,
            questionEndsAt: meta.phaseEndsAt + nextSeconds * 1000,
            questionSeconds: nextSeconds,
            phaseEndsAt: null,
            // Cờ "rút ngắn" chỉ thuộc về câu vừa qua — không được dính sang câu mới
            endedEarly: null,
        };
    });

    return result.snapshot.val();
}

/**
 * Bắt kịp nhịp trận khi client vào muộn hoặc vừa mở lại tab.
 *
 * Nếu deadline đã trôi qua nhiều câu (cả phòng rớt mạng rồi quay lại),
 * gọi advance lặp cho tới khi bắt kịp hoặc trận chuyển sang chấm điểm.
 * Có giới hạn vòng lặp để không quay vô hạn nếu state hỏng.
 */
export async function catchUpArenaPhase(sessionId, settings) {
    for (let guard = 0; guard < 20; guard++) {
        const snap = await get(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`));
        const meta = snap.val();
        if (!meta || meta.status !== 'running') return meta;

        const now = serverNowSync();
        const deadline = meta.phase === 'question' ? meta.questionEndsAt : meta.phaseEndsAt;
        if (!deadline || now < deadline) return meta;

        await advanceArenaPhase(sessionId, meta.questionIndex, meta.phase, settings);
    }
    return null;
}

/**
 * Admin kết thúc trận cưỡng bức (dùng khi trận treo vì mọi người rớt mạng).
 */
export async function forceFinishArenaMatch(sessionId) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    await runTransaction(metaRef, (meta) => {
        if (!meta || meta.status === 'finished') return meta;
        return { ...meta, status: 'grading', forceStopped: true };
    });
}

// ==================== TRẢ LỜI ====================

/**
 * HS nộp câu trả lời. CHO PHÉP NỘP LẠI tới khi hết giờ câu đó —
 * lỡ tay chọn nhầm thì sửa được, bản ghi sau đè lên bản trước.
 *
 * `elapsedMs` luôn tính theo LẦN NỘP CUỐI, nên sửa đáp án đồng nghĩa với mất
 * lợi thế tốc độ khi so kè điểm bằng nhau — đó là cái giá của việc đổi ý.
 *
 * KHÔNG chấm ở đây. Client không biết đáp án; Cloud Function chấm cuối trận.
 *
 * @param {string} sessionId
 * @param {string} uid
 * @param {number} qIndex
 * @param {Object} answer - { choice } | { tf: {0:bool,...} } | { text }
 * @param {number} elapsedMs - thời gian suy nghĩ, dùng để phân hạng khi bằng điểm
 */
export async function submitArenaAnswer(sessionId, uid, qIndex, answer, elapsedMs) {
    const payload = {
        choice: answer.choice ?? null,
        tf: answer.tf ?? null,
        text: answer.text ?? null,
        submittedAt: serverNowSync(),
        elapsedMs: Math.max(0, Math.round(elapsedMs) || 0),
    };

    try {
        await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/answers/${uid}/${qIndex}`), payload);
        return true;
    } catch (error) {
        console.warn('Arena answer not saved:', error?.message);
        return false;
    }
}

/**
 * Rút ngắn câu hiện tại vì cả phòng đã trả lời xong.
 *
 * KHÔNG cắt ngay lập tức mà để lại `graceMs` giây ân hạn: đáp án nộp rồi vẫn
 * sửa được, nên cắt phựt một cái sẽ cướp mất cơ hội đổi ý của người vừa bấm.
 *
 * Không nhảy thẳng sang câu sau mà chỉ KÉO DEADLINE về gần: nhịp trận vẫn do
 * advanceArenaPhase quyết định như bình thường, nên mọi client cùng thấy một
 * mốc và không ai bị bỏ lỡ khoảng chuyển câu.
 *
 * Idempotent: deadline đã sớm hơn mốc mới thì huỷ giao dịch, nên nhiều client
 * cùng gọi cũng không đẩy câu đi sớm hơn nữa.
 *
 * @param {string} sessionId
 * @param {number} expectedIndex - câu mà client đang thấy
 * @param {number} graceMs - thời gian còn lại để đổi ý
 * @returns {Promise<boolean>} - true nếu chính lần gọi này rút ngắn deadline
 */
export async function endQuestionEarly(sessionId, expectedIndex, graceMs = 5000) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    const target = serverNowSync() + Math.max(0, graceMs);

    const result = await runTransaction(metaRef, (meta) => {
        if (!meta || meta.status !== 'running') return undefined;
        if (meta.phase !== 'question' || meta.questionIndex !== expectedIndex) return undefined;
        // Sắp hết giờ sẵn rồi → đừng kéo dài thêm
        if (!meta.questionEndsAt || meta.questionEndsAt <= target) return undefined;

        return { ...meta, questionEndsAt: target, endedEarly: true };
    });

    return result.committed;
}

// ==================== VẬT PHẨM ====================

/**
 * Đóng băng đề của 1 đối thủ trong 10 giây.
 *
 * Đây là ô DUY NHẤT mà một HS ghi vào node của HS khác (rules mở riêng
 * `frozenUntil`/`frozenBy`). Transaction để hai người cùng freeze một nạn nhân
 * không chồng lấn — người thứ hai bị từ chối và GIỮ LẠI lượt dùng.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function freezeOpponent(sessionId, targetUid, byUid, durationMs = 10000) {
    // Transaction chạy trên ĐÚNG Ô `frozenUntil`, không phải cả node effects/{targetUid}.
    // Rules chỉ mở ghi chéo cho hai ô frozenUntil/frozenBy; ghi vào node cha sẽ bị
    // đánh giá theo rule của node cha (auth.uid == $uid) và luôn bị từ chối.
    const frozenUntilRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${targetUid}/frozenUntil`);
    const now = serverNowSync();

    const result = await runTransaction(frozenUntilRef, (current) => {
        // Đang bị băng rồi → huỷ giao dịch, người dùng giữ lại lượt
        if (current && current > now) return undefined;
        return now + durationMs;
    });

    if (!result.committed) return { ok: false, reason: 'already_frozen' };

    // Ghi người gây ra (không quan trọng bằng frozenUntil nên không cần transaction)
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${targetUid}/frozenBy`), byUid);
    await markEffectUsed(sessionId, byUid, 'freeze');
    return { ok: true };
}

/**
 * Dùng lửa thiêu băng — gỡ trạng thái đóng băng của chính mình.
 * Nếu đang không bị băng thì huỷ giao dịch để không phí lượt.
 */
export async function burnIce(sessionId, uid) {
    // Ghi đúng ô frozenUntil để không đụng tới các ô fifty/hintTf mà rules cấm
    // client ghi (ghi cả node effects/{uid} sẽ kéo theo chúng và bị từ chối).
    const frozenUntilRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${uid}/frozenUntil`);
    const now = serverNowSync();

    const result = await runTransaction(frozenUntilRef, (current) => {
        if (!current || current <= now) return undefined;
        return 0;
    });

    if (!result.committed) return { ok: false, reason: 'not_frozen' };

    await markEffectUsed(sessionId, uid, 'fire');
    return { ok: true };
}

/**
 * Đặt cược nhân đôi điểm cho câu kế tiếp.
 * Chỉ ghi Ý ĐỊNH — Cloud Function mới quyết định có nhân đôi hay không
 * (kiểm tra lại loại câu và đúng/sai), nên client không lách được.
 */
export async function setDoubleBet(sessionId, uid, qIndex) {
    // Chốt lượt dùng bằng transaction trên ô `used/double` (ô lá, tự sở hữu),
    // rồi mới ghi doubleOn. Không ghi cả node effects/{uid} vì như vậy sẽ kéo
    // theo fifty/hintTf — hai ô rules cấm client ghi — và bị từ chối toàn bộ.
    const usedRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${uid}/used/double`);

    const result = await runTransaction(usedRef, (current) => (current ? undefined : true));
    if (!result.committed) return { ok: false, reason: 'already_used' };

    try {
        await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${uid}/doubleOn`), qIndex);
    } catch (error) {
        // Ghi ý định thất bại → trả lại lượt để HS không mất oan vật phẩm
        await remove(usedRef).catch(() => {});
        throw error;
    }

    return { ok: true };
}

/**
 * Đánh dấu đã dùng một vật phẩm (mỗi trận 1 lần / vật phẩm).
 */
async function markEffectUsed(sessionId, uid, effect) {
    await set(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${uid}/used/${effect}`), true);
}

// ==================== PRESENCE ====================

/**
 * Đánh dấu HS đang online trong trận, tự set false khi rớt mạng.
 * @returns {Function} - hàm huỷ (gọi khi rời trận chủ động)
 */
export function trackArenaPresence(sessionId, uid) {
    const presenceRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/presence/${uid}`);
    set(presenceRef, true).catch(() => {});
    onDisconnect(presenceRef).set(false);

    return () => {
        onDisconnect(presenceRef).cancel();
        set(presenceRef, false).catch(() => {});
    };
}

// ==================== LISTENERS ====================
//
// LƯU Ý: mọi listener trả về hàm unsubscribe của onValue.
// TUYỆT ĐỐI KHÔNG dùng off(ref) — nó huỷ mọi listener trên path đó,
// kể cả listener của component khác đang nghe cùng node.

/**
 * Nghe danh sách phòng đang mở
 */
export function listenToOpenArenaRooms(callback) {
    const roomsRef = ref(realtimeDb, OPEN_ROOMS_PATH);
    return onValue(
        roomsRef,
        (snap) => {
            const val = snap.val() || {};
            const rooms = Object.entries(val).map(([id, data]) => ({ id, ...data }));
            rooms.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
            callback(rooms);
        },
        (error) => {
            console.error('Error listening to open arena rooms:', error);
            callback([]);
        }
    );
}

/**
 * Nghe một phòng (players, status, host, sessionId)
 */
export function listenToArenaRoom(roomId, callback) {
    const roomRef = ref(realtimeDb, `${ROOMS_PATH}/${roomId}`);
    return onValue(
        roomRef,
        (snap) => callback(snap.exists() ? snap.val() : null),
        (error) => {
            console.error('Error listening to arena room:', error);
            callback(null);
        }
    );
}

/**
 * Nghe đồng hồ + tiến độ trận (node nhỏ, đổi liên tục — tách riêng khỏi questions)
 */
export function listenToArenaMeta(sessionId, callback) {
    const metaRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/meta`);
    return onValue(
        metaRef,
        (snap) => callback(snap.exists() ? snap.val() : null),
        (error) => {
            console.error('Error listening to arena meta:', error);
            callback(null);
        }
    );
}

/**
 * Nghe hiệu ứng vật phẩm của chính mình (đóng băng, 50/50, gợi ý)
 */
export function listenToArenaEffects(sessionId, uid, callback) {
    const fxRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/effects/${uid}`);
    return onValue(
        fxRef,
        (snap) => callback(snap.val() || {}),
        (error) => {
            console.error('Error listening to arena effects:', error);
            callback({});
        }
    );
}

/**
 * Nghe ai đã nộp câu nào (bảng theo dõi trong trận — KHÔNG hiện điểm)
 */
export function listenToArenaAnswers(sessionId, callback) {
    const ansRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/answers`);
    return onValue(
        ansRef,
        (snap) => callback(snap.val() || {}),
        (error) => {
            console.error('Error listening to arena answers:', error);
            callback({});
        }
    );
}

/**
 * Nghe bảng xếp hạng cuối trận (Cloud Function ghi sau khi chấm)
 */
export function listenToArenaResults(sessionId, callback) {
    const resultsRef = ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/results`);
    return onValue(
        resultsRef,
        (snap) => callback(snap.val() || null),
        (error) => {
            console.error('Error listening to arena results:', error);
            callback(null);
        }
    );
}

/**
 * Đọc đề (đã lược đáp án) một lần — đề không đổi trong trận nên không cần listener.
 */
export async function getArenaQuestions(sessionId) {
    const snap = await get(ref(realtimeDb, `${SESSIONS_PATH}/${sessionId}/questions`));
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.keys(val)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => val[k]);
}
