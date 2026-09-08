import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * CRUD thư mục kho câu hỏi (collection `questionFolders`, admin quản lý).
 * Thư mục do người dùng tự tạo để nhóm câu hỏi theo chủ đề/chuyên đề tùy ý —
 * cấu trúc PHẲNG (không lồng nhau) cho đơn giản và dễ lọc.
 *
 * Schema doc:
 * {
 *   name: string,            // tên thư mục, ví dụ "Hàm số bậc hai"
 *   icon: string,            // 1 emoji làm nhãn
 *   order: number,           // thứ tự hiển thị (nhỏ trước)
 *   createdBy, createdAt, updatedAt
 * }
 *
 * Câu hỏi trỏ về thư mục qua field `folderId` (null = chưa phân loại).
 */

const COLLECTION = 'questionFolders';
const QUESTION_COLLECTION = 'questionBank';

/** Id ảo cho nhóm "Chưa phân loại" — không tồn tại doc thật trong Firestore. */
export const UNFILED_ID = '__unfiled__';

export const DEFAULT_FOLDER_ICON = '📁';

/** Emoji gợi ý sẵn khi tạo thư mục. */
export const FOLDER_ICON_PRESETS = [
    '📁', '📐', '📊', '🔢', '📈', '🧮', '📏', '🎯',
    '⭐', '🔥', '🧠', '💡', '📚', '✏️', '🏆', '🧪'
];

/**
 * Lấy toàn bộ thư mục, sắp theo `order` rồi tên.
 * @returns {Promise<Array>} - Danh sách thư mục
 */
export const getFolders = async () => {
    try {
        const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error getting question folders:', error);
        throw error;
    }
};

/**
 * Tạo thư mục mới, tự xếp xuống cuối danh sách.
 * @param {Object} data - { name, icon }
 * @param {string} createdBy - uid người tạo
 * @param {number} nextOrder - thứ tự muốn gán (mặc định đẩy xuống cuối)
 * @returns {Promise<string>} - ID doc vừa tạo
 */
export const createFolder = async (data, createdBy = null, nextOrder = null) => {
    try {
        const order = nextOrder ?? Date.now();
        const docRef = await addDoc(collection(db, COLLECTION), {
            name: (data.name || '').trim(),
            icon: data.icon || DEFAULT_FOLDER_ICON,
            order,
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating question folder:', error);
        throw error;
    }
};

/**
 * Cập nhật thông tin thư mục.
 * @param {string} folderId - ID thư mục
 * @param {Object} data - Các field muốn đổi { name, icon, order }
 * @returns {Promise<void>}
 */
export const updateFolder = async (folderId, data) => {
    try {
        const payload = { updatedAt: serverTimestamp() };
        if (data.name !== undefined) payload.name = (data.name || '').trim();
        if (data.icon !== undefined) payload.icon = data.icon || DEFAULT_FOLDER_ICON;
        if (data.order !== undefined) payload.order = data.order;
        await updateDoc(doc(db, COLLECTION, folderId), payload);
    } catch (error) {
        console.error('Error updating question folder:', error);
        throw error;
    }
};

/**
 * Gỡ `folderId` khỏi mọi câu hỏi thuộc thư mục (đưa về "Chưa phân loại").
 * Tách riêng để dùng lại khi xóa thư mục.
 * @param {string} folderId - ID thư mục
 * @returns {Promise<number>} - Số câu đã gỡ
 */
export const detachQuestionsFromFolder = async (folderId) => {
    const snapshot = await getDocs(query(
        collection(db, QUESTION_COLLECTION),
        where('folderId', '==', folderId)
    ));
    const ids = snapshot.docs.map(d => d.id);
    if (ids.length === 0) return 0;

    // Firestore giới hạn 500 thao tác/batch
    for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach(id => {
            batch.update(doc(db, QUESTION_COLLECTION, id), {
                folderId: null,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    }
    return ids.length;
};

/**
 * Xóa thư mục. Câu hỏi bên trong KHÔNG bị xóa — chỉ trở về "Chưa phân loại",
 * vì mất câu hỏi nguy hiểm hơn nhiều so với mất một nhãn phân loại.
 * @param {string} folderId - ID thư mục
 * @returns {Promise<number>} - Số câu đã được đưa về chưa phân loại
 */
export const deleteFolder = async (folderId) => {
    try {
        const detached = await detachQuestionsFromFolder(folderId);
        await deleteDoc(doc(db, COLLECTION, folderId));
        return detached;
    } catch (error) {
        console.error('Error deleting question folder:', error);
        throw error;
    }
};

/**
 * Lưu lại thứ tự mới của toàn bộ danh sách thư mục (sau khi kéo thả / đổi chỗ).
 * @param {Array<string>} orderedIds - ID thư mục theo thứ tự mong muốn
 * @returns {Promise<void>}
 */
export const reorderFolders = async (orderedIds) => {
    if (!orderedIds || orderedIds.length === 0) return;
    try {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
            batch.update(doc(db, COLLECTION, id), { order: index });
        });
        await batch.commit();
    } catch (error) {
        console.error('Error reordering question folders:', error);
        throw error;
    }
};

/**
 * Đếm số câu hỏi trong mỗi thư mục (tính tại client từ danh sách đã tải).
 * @param {Array} questions - Danh sách câu hỏi
 * @returns {Object} - { [folderId]: count, [UNFILED_ID]: count }
 */
export const countQuestionsByFolder = (questions) => {
    const counts = { [UNFILED_ID]: 0 };
    (questions || []).forEach(q => {
        const key = q.folderId || UNFILED_ID;
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
};
