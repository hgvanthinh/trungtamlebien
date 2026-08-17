import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { callMoneyFunction } from './moneyApi';

/**
 * Purchase an item and add to inventory
 *
 * Server tự đọc GIÁ và LOẠI TIỀN từ storeItems rồi mới trừ — client không gửi
 * giá lên nữa, nên không thể tự khai giá 0. itemData chỉ còn dùng để dựng lại
 * object hiển thị ngay sau khi mua, không ảnh hưởng tới số tiền bị trừ.
 *
 * @param {string} _userId - giữ cho tương thích, server lấy uid từ token
 * @param {string} itemId - Item ID
 * @param {Object} itemData - Item data (chỉ dùng cho hiển thị)
 * @returns {Promise<Object>} - Purchase result
 */
export const purchaseItem = async (_userId, itemId, itemData = {}) => {
    const data = await callMoneyFunction('purchaseItem', { itemId });

    return {
        success: true,
        newCoins: data.newCoins,
        newGold: data.newGold,
        inventoryItem: {
            id: data.inventoryItemId,
            userId: _userId,
            itemId,
            itemName: itemData.name || '',
            itemDescription: itemData.description || '',
            itemCategory: itemData.category || '',
            itemImageUrl: itemData.imageUrl || '',
            purchasePrice: itemData.price,
            purchaseCurrency: itemData.currency,
            purchasedAt: Timestamp.now()
        }
    };
};

/**
 * Get user's inventory
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of inventory items
 */
export const getUserInventory = async (userId) => {
    try {
        const q = query(
            collection(db, 'inventories'),
            where('userId', '==', userId),
            orderBy('purchasedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting user inventory:', error);
        throw error;
    }
};

/**
 * Check if user owns a specific item
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @returns {Promise<boolean>} - True if user owns the item
 */
export const userOwnsItem = async (userId, itemId) => {
    try {
        const q = query(
            collection(db, 'inventories'),
            where('userId', '==', userId),
            where('itemId', '==', itemId)
        );

        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking item ownership:', error);
        throw error;
    }
};

/**
 * Get inventory item details
 * @param {string} inventoryId - Inventory item ID
 * @returns {Promise<Object>} - Inventory item data
 */
export const getInventoryItem = async (inventoryId) => {
    try {
        const itemDoc = await getDoc(doc(db, 'inventories', inventoryId));
        if (itemDoc.exists()) {
            return {
                id: itemDoc.id,
                ...itemDoc.data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting inventory item:', error);
        throw error;
    }
};

/**
 * Get inventory statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Inventory statistics
 */
export const getInventoryStats = async (userId) => {
    try {
        const inventory = await getUserInventory(userId);

        const totalItems = inventory.length;
        const totalSpentCoins = inventory
            .filter(item => item.purchaseCurrency === 'coins')
            .reduce((sum, item) => sum + item.purchasePrice, 0);
        const totalSpentGold = inventory
            .filter(item => item.purchaseCurrency === 'gold')
            .reduce((sum, item) => sum + item.purchasePrice, 0);

        return {
            totalItems,
            totalSpentCoins,
            totalSpentGold
        };
    } catch (error) {
        console.error('Error getting inventory stats:', error);
        throw error;
    }
};

/**
 * Delete an item from user's inventory
 * @param {string} userId - User ID
 * @param {string} inventoryItemId - Inventory item ID
 * @param {Object} itemData - Item data (imageUrl, category)
 * @returns {Promise<void>}
 */
export const deleteInventoryItem = async (userId, inventoryItemId, itemData) => {
    try {
        // If this is an avatar-border and user is currently using it, reset activeAvatarBorder
        if (itemData.category === 'avatar-border' && itemData.imageUrl) {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.activeAvatarBorder === itemData.imageUrl) {
                    await updateDoc(userRef, { activeAvatarBorder: null });
                }
            }
        }

        // Delete the inventory item
        await deleteDoc(doc(db, 'inventories', inventoryItemId));
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        throw error;
    }
};
