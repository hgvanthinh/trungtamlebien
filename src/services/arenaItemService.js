import {
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Vật phẩm dùng trong trận Đấu Trường (arena).
 *
 * KHÁC VỚI ĐẤU TRÍ 1v1: vật phẩm arena chính là 5 VIỀN AVATAR trong cửa hàng
 * (`category: 'avatar-border'`). Viền là đồ sưu tầm vĩnh viễn nên:
 * - Sở hữu viền ⇒ mỗi trận được dùng skill tương ứng 1 LẦN
 * - KHÔNG tiêu hao viền (không có hàm consume như versusItemService)
 *
 * Giống versus: inventoryService copy `itemCategory` vào doc inventory nhưng
 * KHÔNG copy `effect`, nên phải đọc lại `storeItems/{itemId}` (có cache).
 */

// icon là tên Material Symbols
export const ARENA_ITEM_EFFECTS = {
    freeze: {
        label: 'Đóng băng đề',
        icon: 'ac_unit',
        description: 'Che đề của 1 đối thủ trong 10 giây',
        target: 'opponent'
    },
    double: {
        label: 'Nhân đôi điểm',
        icon: 'bolt',
        description: 'Cược bất cứ lúc nào cho câu đang làm (hoặc câu sắp tới nếu đang chuyển câu): đúng thì được gấp đôi điểm. Không áp dụng câu đúng-sai.',
        target: 'self',
        qTypes: ['abcd', 'short_answer']
    },
    fifty: {
        label: '50/50',
        icon: 'filter_2',
        description: 'Loại bỏ 2 đáp án sai (chỉ câu 4 đáp án)',
        target: 'self',
        qTypes: ['abcd']
    },
    hint_tf: {
        label: 'Gợi ý Đúng-Sai',
        icon: 'lightbulb',
        description: 'Chọn 1 ý của câu đúng-sai để biết ý đó đúng hay sai',
        target: 'self',
        qTypes: ['true_false']
    },
    fire: {
        label: 'Lửa thiêu băng',
        icon: 'local_fire_department',
        description: 'Gỡ ngay lớp băng khi bị đóng băng đề',
        target: 'self'
    }
};

// Category của store item được coi là vật phẩm arena
export const ARENA_ITEM_CATEGORY = 'avatar-border';

// Cache itemId → effect (tra từ storeItems, tránh đọc lặp)
const effectCache = new Map();

export const clearArenaItemCache = () => {
    effectCache.clear();
};

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
        console.error('Error getting arena item effect:', error);
        return null;
    }
};

/**
 * Lấy danh sách effect arena mà user sở hữu (qua viền avatar trong kho).
 *
 * Trả về object dạng { freeze: true, fifty: true, ... } — chỉ cần biết CÓ hay KHÔNG,
 * vì vật phẩm không tiêu hao, số lượng viền trùng nhau không làm tăng lượt dùng.
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { [effect]: true }
 */
export const getArenaItems = async (userId) => {
    try {
        const result = {};

        const q = query(
            collection(db, 'inventories'),
            where('userId', '==', userId),
            where('itemCategory', '==', ARENA_ITEM_CATEGORY)
        );

        const snapshot = await getDocs(q);
        for (const invDoc of snapshot.docs) {
            const effect = await getItemEffect(invDoc.data().itemId);
            // Bỏ qua viền không gán effect (viền thuần trang trí)
            if (effect && ARENA_ITEM_EFFECTS[effect]) {
                result[effect] = true;
            }
        }

        return result;
    } catch (error) {
        console.error('Error getting arena items:', error);
        return {};
    }
};

/**
 * Vật phẩm có dùng được cho câu hỏi dạng này không
 * @param {string} effect - Tên effect
 * @param {string} questionType - 'abcd' | 'true_false' | 'short_answer'
 * @returns {boolean}
 */
export const isEffectUsableForType = (effect, questionType) => {
    const def = ARENA_ITEM_EFFECTS[effect];
    if (!def) return false;
    if (!def.qTypes) return true;
    return def.qTypes.includes(questionType);
};
