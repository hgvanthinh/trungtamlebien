import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';

/**
 * Upload item image to Firebase Storage
 * @param {File} file - Image file
 * @param {string} itemId - Item ID for organizing storage
 * @returns {Promise<string>} - Download URL
 */
export const uploadItemImage = async (file, itemId) => {
    try {
        const timestamp = Date.now();
        const fileName = `${itemId}_${timestamp}_${file.name}`;
        const storageRef = ref(storage, `store-items/${fileName}`);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading item image:', error);
        throw error;
    }
};

/**
 * Delete item image from Firebase Storage
 * @param {string} imageUrl - Image URL to delete
 */
export const deleteItemImage = async (imageUrl) => {
    try {
        if (!imageUrl) return;

        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error) {
        console.error('Error deleting item image:', error);
        // Don't throw - image might already be deleted
    }
};

/**
 * Create a new store item
 * @param {Object} itemData - Item data
 * @returns {Promise<Object>} - Created item with ID
 */
export const createStoreItem = async (itemData) => {
    try {
        const docRef = await addDoc(collection(db, 'storeItems'), {
            ...itemData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        return {
            id: docRef.id,
            ...itemData
        };
    } catch (error) {
        console.error('Error creating store item:', error);
        throw error;
    }
};

/**
 * Update an existing store item
 * @param {string} itemId - Item ID
 * @param {Object} updates - Updated data
 */
export const updateStoreItem = async (itemId, updates) => {
    try {
        const itemRef = doc(db, 'storeItems', itemId);
        await updateDoc(itemRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating store item:', error);
        throw error;
    }
};

/**
 * Delete a store item and remove from all student inventories
 * @param {string} itemId - Item ID
 */
export const deleteStoreItem = async (itemId) => {
    try {
        // Get item to delete image and check category
        const itemDoc = await getDoc(doc(db, 'storeItems', itemId));
        if (itemDoc.exists()) {
            const itemData = itemDoc.data();

            // Delete image if exists
            if (itemData.imageUrl) {
                await deleteItemImage(itemData.imageUrl);
            }

            // If this is an avatar-border, reset activeAvatarBorder for all users using it
            if (itemData.category === 'avatar-border' && itemData.imageUrl) {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('activeAvatarBorder', '==', itemData.imageUrl)
                );
                const usersSnapshot = await getDocs(usersQuery);
                const resetPromises = usersSnapshot.docs.map(userDoc =>
                    updateDoc(userDoc.ref, { activeAvatarBorder: null })
                );
                await Promise.all(resetPromises);
            }
        }

        // Delete from all student inventories
        const inventoriesQuery = query(
            collection(db, 'inventories'),
            where('itemId', '==', itemId)
        );
        const inventorySnapshot = await getDocs(inventoriesQuery);
        const deletePromises = inventorySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // Delete item document
        await deleteDoc(doc(db, 'storeItems', itemId));
    } catch (error) {
        console.error('Error deleting store item:', error);
        throw error;
    }
};

/**
 * Get all store items
 * @returns {Promise<Array>} - Array of store items
 */
export const getAllStoreItems = async () => {
    try {
        const q = query(
            collection(db, 'storeItems'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting store items:', error);
        throw error;
    }
};

/**
 * Get available store items (for students)
 * @returns {Promise<Array>} - Array of available items
 */
export const getAvailableStoreItems = async () => {
    try {
        const q = query(
            collection(db, 'storeItems'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting available store items:', error);
        throw error;
    }
};

/**
 * Get a single store item by ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} - Item data
 */
export const getStoreItem = async (itemId) => {
    try {
        const itemDoc = await getDoc(doc(db, 'storeItems', itemId));
        if (itemDoc.exists()) {
            return {
                id: itemDoc.id,
                ...itemDoc.data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting store item:', error);
        throw error;
    }
};
