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
    Timestamp,
    runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Purchase an item and add to inventory
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @param {Object} itemData - Item data (name, price, currency, imageUrl)
 * @returns {Promise<Object>} - Purchase result
 */
export const purchaseItem = async (userId, itemId, itemData) => {
    try {
        return await runTransaction(db, async (transaction) => {
            // Get user document
            const userRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();
            const currentCoins = userData.coins || 0;
            const currentGold = userData.gold || 0;

            // Check if user has enough currency
            if (itemData.currency === 'coins') {
                if (currentCoins < itemData.price) {
                    throw new Error('Không đủ Xu để mua món hàng này');
                }
            } else if (itemData.currency === 'gold') {
                if (currentGold < itemData.price) {
                    throw new Error('Không đủ Đồng Vàng để mua món hàng này');
                }
            }

            // Deduct currency
            const updates = {};
            if (itemData.currency === 'coins') {
                updates.coins = currentCoins - itemData.price;
            } else {
                updates.gold = currentGold - itemData.price;
            }

            transaction.update(userRef, updates);

            // Add to inventory
            const inventoryRef = collection(db, 'inventories');
            const inventoryData = {
                userId,
                itemId,
                itemName: itemData.name,
                itemDescription: itemData.description || '',
                itemCategory: itemData.category || '',
                itemImageUrl: itemData.imageUrl || '',
                purchasePrice: itemData.price,
                purchaseCurrency: itemData.currency,
                purchasedAt: Timestamp.now()
            };

            // Use addDoc outside transaction (will be committed with transaction)
            const newInventoryRef = doc(inventoryRef);
            transaction.set(newInventoryRef, inventoryData);

            return {
                success: true,
                newCoins: itemData.currency === 'coins' ? updates.coins : currentCoins,
                newGold: itemData.currency === 'gold' ? updates.gold : currentGold,
                inventoryItem: {
                    id: newInventoryRef.id,
                    ...inventoryData
                }
            };
        });
    } catch (error) {
        console.error('Error purchasing item:', error);
        throw error;
    }
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
