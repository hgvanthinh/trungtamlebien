import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit as fsLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Lịch sử trận Đấu Trường — CHỈ ADMIN dùng được.
 *
 * Đọc thẳng `arenaSessions`, nơi chứa đề ĐẦY ĐỦ (còn đáp án) và bảng xếp hạng.
 * firestore.rules chặn học sinh đọc collection này, nên mọi hàm ở đây gọi từ
 * phía HS đều sẽ bị từ chối — đó là chủ ý, không phải lỗi.
 *
 * Dùng cho hai việc:
 * 1. Xem lại trận đã xong: ai được mấy điểm, đề gồm những câu nào.
 * 2. Xem trước đề của trận ĐANG CHẠY, để thầy kịp chuẩn bị giảng lại cho cả phòng.
 */

/**
 * Danh sách trận gần đây.
 *
 * @param {Object} opts
 * @param {string} [opts.roomId] - lọc theo một phòng
 * @param {string} [opts.mode] - 'live' | 'practice'
 * @param {number} [opts.max] - số bản ghi tối đa
 * @returns {Promise<Array>}
 */
export const getArenaHistory = async ({ roomId = null, mode = null, max = 50 } = {}) => {
    const clauses = [];
    if (roomId) clauses.push(where('roomId', '==', roomId));
    if (mode) clauses.push(where('mode', '==', mode));

    // Trận thi đấu cũ (trước khi có chế độ luyện tập) không có field `mode`,
    // nên khi lọc 'live' phải bù thêm những bản ghi thiếu field đó.
    const q = query(
        collection(db, 'arenaSessions'),
        ...clauses,
        orderBy('createdAt', 'desc'),
        fsLimit(max)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Chi tiết một trận: đề đầy đủ (có đáp án) + bảng xếp hạng.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export const getArenaSessionDetail = async (sessionId) => {
    const snap = await getDoc(doc(db, 'arenaSessions', sessionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
};

/**
 * Nhãn ngắn cho loại câu, dùng chung ở các bảng của admin.
 */
export const QUESTION_TYPE_LABELS = {
    abcd: 'Trắc nghiệm',
    true_false: 'Đúng-Sai',
    short_answer: 'Điền đáp án',
};

/**
 * Đáp án đúng của một câu, rút gọn thành chuỗi đọc được.
 * Dùng cho bảng xem trước đề — thầy liếc là thấy ngay, không phải mở từng câu.
 *
 * @param {Object} q - câu hỏi bản đầy đủ (có đáp án)
 * @returns {string}
 */
export const describeCorrectAnswer = (q) => {
    if (!q) return '';

    if (q.type === 'true_false') {
        return (q.statements || [])
            .map((st, i) => `${String.fromCharCode(97 + i)}) ${st.isTrue ? 'Đúng' : 'Sai'}`)
            .join(' · ');
    }

    if (q.type === 'short_answer') {
        const alts = q.alternativeAnswers || [];
        return alts.length ? `${q.correctAnswer} (hoặc: ${alts.join(', ')})` : q.correctAnswer || '';
    }

    const idx = (q.answers || []).findIndex((a) => a.isCorrect);
    if (idx < 0) return '';
    return `${String.fromCharCode(65 + idx)}. ${q.answers[idx]?.text || ''}`;
};
