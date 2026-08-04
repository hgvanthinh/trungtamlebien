import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteQuestionImage } from './storageService';

/**
 * CRUD Kho câu hỏi (collection `questionBank`, admin quản lý).
 * Mỗi doc = 1 câu hỏi độc lập, có thể chọn để đưa vào bài Đấu Trí 1v1.
 *
 * Schema doc — dùng chung format câu hỏi của versusGames để copy thẳng được:
 * {
 *   type: 'abcd' | 'true_false' | 'short_answer',
 *   inputMode: 'text' | 'image',             // 'image' = đề nằm trong ảnh, GV chỉ chấm đáp án
 *   questionText, questionImage?,
 *   // abcd:
 *   answers: [{ text, isCorrect }]           // 4 đáp án, 1 đúng
 *   //   inputMode 'image': answers vẫn 4 phần tử nhưng text rỗng, chỉ đánh dấu isCorrect
 *   // true_false:
 *   statements: [{ text, isTrue }]
 *   //   inputMode 'image': statements là a/b/c/d, text rỗng, chỉ đánh dấu isTrue
 *   // short_answer:
 *   correctAnswer, alternativeAnswers: []
 *
 *   grade, difficulty,                       // metadata lọc (trung tâm chỉ dạy Toán nên không có field môn)
 *   createdBy, createdAt, updatedAt
 * }
 */

const COLLECTION = 'questionBank';

export const QUESTION_TYPES = {
    abcd: '🅰️ Trắc nghiệm A-B-C-D',
    true_false: '✅ Đúng / Sai',
    short_answer: '✍️ Trả lời ngắn'
};

export const DIFFICULTIES = {
    easy: 'Dễ',
    medium: 'Trung bình',
    hard: 'Khó'
};

export const GRADES = [6, 7, 8, 9, 10, 11, 12];

/**
 * Chuẩn hóa câu hỏi trước khi ghi Firestore (bỏ field thừa theo loại).
 * @param {Object} q - Câu hỏi thô từ form
 * @returns {Object} - Câu hỏi đã chuẩn hóa
 */
export const normalizeQuestion = (q) => {
    const type = q.type || 'abcd';
    const inputMode = q.inputMode === 'image' ? 'image' : 'text';
    const base = {
        type,
        inputMode,
        questionText: (q.questionText || '').trim(),
        grade: q.grade ?? null,
        difficulty: q.difficulty || 'medium'
    };
    if (inputMode === 'image' || q.questionImage?.trim()) {
        base.questionImage = (q.questionImage || '').trim();
    }

    if (type === 'true_false') {
        return {
            ...base,
            statements: (q.statements || []).map(s => ({
                text: (s.text || '').trim(),
                isTrue: !!s.isTrue
            }))
        };
    }

    if (type === 'short_answer') {
        return {
            ...base,
            correctAnswer: (q.correctAnswer || '').trim(),
            alternativeAnswers: (q.alternativeAnswers || [])
                .map(a => (a || '').trim())
                .filter(Boolean)
        };
    }

    return {
        ...base,
        answers: (q.answers || []).map(a => ({
            text: (a.text || '').trim(),
            isCorrect: !!a.isCorrect
        }))
    };
};

/**
 * Bóc phần câu hỏi thuần (bỏ metadata kho) để nhúng vào bài đấu versus.
 * @param {Object} q - Doc câu hỏi từ kho
 * @returns {Object} - Câu hỏi đúng format versusGames.questions[]
 */
export const toVersusQuestion = (q) => {
    const type = q.type || 'abcd';
    const isImage = q.inputMode === 'image';
    // Câu dạng ảnh: đề nằm trong ảnh, phần text chỉ là nhãn để HS bấm chọn
    const questionText = q.questionText?.trim() || (isImage ? 'Xem đề trong ảnh' : '');

    if (type === 'true_false') {
        const out = {
            type: 'true_false',
            questionText,
            statements: (q.statements || []).map((s, i) => ({
                text: s.text?.trim() || `Ý ${String.fromCharCode(97 + i)})`,
                isTrue: !!s.isTrue
            }))
        };
        if (q.questionImage) out.questionImage = q.questionImage;
        return out;
    }

    if (type === 'short_answer') {
        const out = {
            type: 'short_answer',
            questionText,
            correctAnswer: q.correctAnswer,
            alternativeAnswers: q.alternativeAnswers || []
        };
        if (q.questionImage) out.questionImage = q.questionImage;
        return out;
    }

    // abcd: versus dùng câu không có field `type`
    const out = {
        questionText,
        answers: (q.answers || []).map((a, i) => ({
            text: a.text?.trim() || String.fromCharCode(65 + i),
            isCorrect: !!a.isCorrect
        }))
    };
    if (q.questionImage) out.questionImage = q.questionImage;
    return out;
};

/**
 * Kiểm tra hợp lệ một câu hỏi.
 * @param {Object} q - Câu hỏi cần kiểm tra
 * @returns {string|null} - Thông báo lỗi, null nếu hợp lệ
 */
export const validateQuestion = (q) => {
    const isImage = q.inputMode === 'image';

    // Chế độ ảnh: đề nằm trong ảnh nên không bắt buộc nhập text
    if (isImage) {
        if (!q.questionImage?.trim()) return 'Chưa tải lên ảnh câu hỏi';
    } else if (!q.questionText?.trim()) {
        return 'Chưa nhập nội dung câu hỏi';
    }

    const type = q.type || 'abcd';
    if (type === 'abcd') {
        if (!q.answers || q.answers.length !== 4) return 'Cần đủ 4 đáp án';
        if (!isImage && q.answers.some(a => !a.text?.trim())) return 'Đáp án không được để trống';
        if (q.answers.filter(a => a.isCorrect).length !== 1) return 'Phải chọn đúng 1 đáp án đúng';
    } else if (type === 'true_false') {
        if (!q.statements || q.statements.length === 0) return 'Cần ít nhất 1 mệnh đề';
        if (!isImage && q.statements.some(s => !s.text?.trim())) return 'Mệnh đề không được để trống';
    } else if (type === 'short_answer') {
        if (!q.correctAnswer?.trim()) return 'Chưa nhập đáp án đúng';
    }
    return null;
};

/**
 * Xóa ảnh khỏi Storage, nhưng chỉ khi không còn câu hỏi nào dùng ảnh đó.
 * GV có thể nhân bản câu hỏi nên hai doc khác nhau vẫn có thể trỏ chung một URL —
 * xóa thẳng sẽ làm hỏng ảnh của câu còn lại.
 *
 * Lỗi khi xóa file chỉ log, không throw: dọn rác thất bại không được phép
 * làm hỏng thao tác chính (lưu / xóa câu hỏi) mà người dùng vừa thực hiện.
 *
 * @param {string} imageUrl - URL ảnh cần dọn
 * @param {string|null} ignoreQuestionId - Bỏ qua doc này khi đếm tham chiếu
 *        (dùng khi doc vẫn còn trong Firestore lúc kiểm tra, hoặc chính nó vừa đổi ảnh)
 * @returns {Promise<boolean>} - true nếu đã xóa file, false nếu giữ lại
 */
export const cleanupQuestionImage = async (imageUrl, ignoreQuestionId = null) => {
    if (!imageUrl?.trim()) return false;

    try {
        // Còn doc nào khác trỏ tới ảnh này thì giữ file lại
        const q = query(
            collection(db, COLLECTION),
            where('questionImage', '==', imageUrl),
            limit(5)
        );
        const snapshot = await getDocs(q);
        const stillUsed = snapshot.docs.some(d => d.id !== ignoreQuestionId);
        if (stillUsed) return false;

        await deleteQuestionImage(imageUrl);
        return true;
    } catch (error) {
        console.error('Error cleaning up question image:', error);
        return false;
    }
};

/**
 * Dọn nhiều ảnh cùng lúc (dùng khi xóa hàng loạt câu hỏi).
 * @param {Array<string>} imageUrls - Danh sách URL ảnh
 * @returns {Promise<void>}
 */
export const cleanupQuestionImages = async (imageUrls) => {
    const unique = [...new Set((imageUrls || []).filter(Boolean))];
    // Chạy tuần tự để không bắn hàng loạt request Storage cùng lúc
    for (const url of unique) {
        await cleanupQuestionImage(url);
    }
};

/**
 * Lấy toàn bộ câu hỏi trong kho (mới nhất trước).
 * @returns {Promise<Array>} - Danh sách câu hỏi
 */
export const getQuestions = async () => {
    try {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error getting questions:', error);
        throw error;
    }
};

/**
 * Thêm 1 câu hỏi vào kho.
 * @param {Object} data - Dữ liệu câu hỏi
 * @param {string} createdBy - uid người tạo
 * @returns {Promise<string>} - ID doc vừa tạo
 */
export const createQuestion = async (data, createdBy = null) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION), {
            ...normalizeQuestion(data),
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating question:', error);
        throw error;
    }
};

/**
 * Thêm nhiều câu hỏi cùng lúc (dán nhanh).
 * @param {Array<Object>} list - Danh sách câu hỏi
 * @param {string} createdBy - uid người tạo
 * @returns {Promise<number>} - Số câu đã thêm
 */
export const createQuestionsBatch = async (list, createdBy = null) => {
    if (!list || list.length === 0) return 0;
    try {
        // Firestore giới hạn 500 thao tác/batch
        const chunks = [];
        for (let i = 0; i < list.length; i += 400) chunks.push(list.slice(i, i + 400));

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(q => {
                batch.set(doc(collection(db, COLLECTION)), {
                    ...normalizeQuestion(q),
                    createdBy,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });
            await batch.commit();
        }
        return list.length;
    } catch (error) {
        console.error('Error batch creating questions:', error);
        throw error;
    }
};

/**
 * Cập nhật câu hỏi. Nếu ảnh bị đổi/gỡ, ảnh cũ được dọn khỏi Storage.
 * @param {string} questionId - ID câu hỏi
 * @param {Object} data - Dữ liệu mới
 * @returns {Promise<void>}
 */
export const updateQuestion = async (questionId, data) => {
    try {
        const docRef = doc(db, COLLECTION, questionId);
        const before = await getDoc(docRef);
        const oldImage = before.exists() ? before.data().questionImage : null;

        const normalized = normalizeQuestion(data);
        await updateDoc(docRef, {
            ...normalized,
            updatedAt: serverTimestamp()
        });

        // Ảnh cũ khác ảnh mới -> không còn ai dùng thì xóa file
        if (oldImage && oldImage !== normalized.questionImage) {
            await cleanupQuestionImage(oldImage, questionId);
        }
    } catch (error) {
        console.error('Error updating question:', error);
        throw error;
    }
};

/**
 * Xóa 1 câu hỏi kèm ảnh của nó (nếu không câu nào khác dùng chung).
 * @param {string} questionId - ID câu hỏi
 * @returns {Promise<void>}
 */
export const deleteQuestion = async (questionId) => {
    try {
        const docRef = doc(db, COLLECTION, questionId);
        const before = await getDoc(docRef);
        const imageUrl = before.exists() ? before.data().questionImage : null;

        await deleteDoc(docRef);

        // Xóa doc trước rồi mới dọn ảnh, nên lúc này doc đã biến mất khỏi kết quả đếm
        if (imageUrl) await cleanupQuestionImage(imageUrl);
    } catch (error) {
        console.error('Error deleting question:', error);
        throw error;
    }
};

/**
 * Xóa nhiều câu hỏi cùng lúc, kèm dọn ảnh của chúng khỏi Storage.
 * @param {Array<string>} ids - Danh sách ID
 * @returns {Promise<void>}
 */
export const deleteQuestionsBatch = async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
        // Gom ảnh trước khi xóa doc — sau khi xóa thì không đọc lại được nữa
        const snapshots = await Promise.all(
            ids.map(id => getDoc(doc(db, COLLECTION, id)).catch(() => null))
        );
        const imageUrls = snapshots
            .filter(s => s?.exists())
            .map(s => s.data().questionImage)
            .filter(Boolean);

        const chunks = [];
        for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400));

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(id => batch.delete(doc(db, COLLECTION, id)));
            await batch.commit();
        }

        await cleanupQuestionImages(imageUrls);
    } catch (error) {
        console.error('Error batch deleting questions:', error);
        throw error;
    }
};
