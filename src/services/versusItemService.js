import {
    collection,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Vật phẩm dùng trong trận Đấu Trí 1v1.
 * Vật phẩm là store item có `category: 'versus-item'`; khi mua, inventoryService
 * copy `itemCategory` vào doc inventory nhưng KHÔNG copy field `effect`,
 * nên phải đọc lại `storeItems/{itemId}` để lấy effect (có cache trong module).
 */

// icon là tên Material Symbols
export const VERSUS_ITEM_EFFECTS = {
    double_step: { label: 'Nhân đôi bước', icon: 'bolt', description: 'Câu tiếp theo trả lời đúng sẽ tiến 2 bước' },
    fifty_fifty: { label: '50/50', icon: 'filter_2', description: 'Loại bỏ 2 đáp án sai (chỉ câu 4 đáp án)' }
};

// Cache itemId → effect (tra từ storeItems, tránh đọc lặp)
const effectCache = new Map();

/**
 * Lấy effect của một store item (có cache)
 * @param {string} itemId - ID store item
 * @returns {Promise<string|null>} - Tên effect hoặc null
 */
const getItemEffect = async (itemId) => {
    if (effectCache.has(itemId)) return effectCache.get(itemId);

    try {
        const itemDoc = await getDoc(doc(db, 'storeItems', itemId));
        const effect = itemDoc.exists() ? (itemDoc.data().effect || null) : null;
        effectCache.set(itemId, effect);
        return effect;
    } catch (error) {
        console.error('Error getting item effect:', error);
        return null;
    }
};

/**
 * Lấy vật phẩm versus trong túi đồ của user, gom theo effect
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { double_step: [inventoryDocId,...], fifty_fifty: [...] }
 */
export const getVersusItems = async (userId) => {
    try {
        const result = {};
        Object.keys(VERSUS_ITEM_EFFECTS).forEach(effect => {
            result[effect] = [];
        });

        const q = query(
            collection(db, 'inventories'),
            where('userId', '==', userId),
            where('itemCategory', '==', 'versus-item')
        );

        const snapshot = await getDocs(q);
        for (const invDoc of snapshot.docs) {
            const effect = await getItemEffect(invDoc.data().itemId);
            // Bỏ qua item không xác định effect
            if (effect && result[effect]) {
                result[effect].push(invDoc.id);
            }
        }

        return result;
    } catch (error) {
        console.error('Error getting versus items:', error);
        throw error;
    }
};

/**
 * Tiêu hao 1 vật phẩm versus (xóa doc inventory)
 * @param {string} inventoryDocId - ID doc inventory
 * @returns {Promise<void>}
 */
export const consumeVersusItem = async (inventoryDocId) => {
    try {
        await deleteDoc(doc(db, 'inventories', inventoryDocId));
    } catch (error) {
        console.error('Error consuming versus item:', error);
        throw error;
    }
};
