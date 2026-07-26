import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * CRUD bộ đề Đấu Trí 1v1 (collection `versusGames`, admin tạo).
 *
 * Schema doc:
 * {
 *   title, winSteps, freezeDuration, shuffleAnswers, maxMatches,
 *   matchesPlayed: 0, questions: [], createdAt, updatedAt
 * }
 *
 * Câu hỏi có 3 dạng:
 * - abcd (mặc định, không có field type):
 *   { questionText, questionImage?, answers: [{ text, isCorrect }] } — 4 đáp án, 1 đúng
 * - true_false:
 *   { type: 'true_false', questionText, statements: [{ text, isTrue }] }
 * - short_answer:
 *   { type: 'short_answer', questionText, correctAnswer, alternativeAnswers: [] }
 */

/**
 * Tạo bộ đề mới (admin)
 * @param {Object} data - Dữ liệu bộ đề (title, winSteps, freezeDuration, shuffleAnswers, maxMatches, questions)
 * @returns {Promise<string>} - ID doc vừa tạo
 */
export const createVersusGame = async (data) => {
    try {
        const docRef = await addDoc(collection(db, 'versusGames'), {
            ...data,
            matchesPlayed: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating versus game:', error);
        throw error;
    }
};

/**
 * Lấy tất cả bộ đề (mới nhất trước)
 * @returns {Promise<Array>} - Danh sách bộ đề
 */
export const getVersusGames = async () => {
    try {
        const q = query(
            collection(db, 'versusGames'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting versus games:', error);
        throw error;
    }
};

/**
 * Lấy chi tiết một bộ đề
 * @param {string} gameId - ID bộ đề
 * @returns {Promise<Object|null>} - Dữ liệu bộ đề hoặc null nếu không tồn tại
 */
export const getVersusGame = async (gameId) => {
    try {
        const gameDoc = await getDoc(doc(db, 'versusGames', gameId));
        if (gameDoc.exists()) {
            return {
                id: gameDoc.id,
                ...gameDoc.data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting versus game:', error);
        throw error;
    }
};

/**
 * Cập nhật bộ đề (admin)
 * @param {string} gameId - ID bộ đề
 * @param {Object} updates - Các field cần cập nhật
 * @returns {Promise<void>}
 */
export const updateVersusGame = async (gameId, updates) => {
    try {
        await updateDoc(doc(db, 'versusGames', gameId), {
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating versus game:', error);
        throw error;
    }
};

/**
 * Xóa bộ đề (admin)
 * @param {string} gameId - ID bộ đề
 * @returns {Promise<void>}
 */
export const deleteVersusGame = async (gameId) => {
    try {
        await deleteDoc(doc(db, 'versusGames', gameId));
    } catch (error) {
        console.error('Error deleting versus game:', error);
        throw error;
    }
};
