import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Lấy danh sách tất cả video
 */
export const getAllVideos = async () => {
    try {
        const videosRef = collection(db, 'videos');
        const q = query(videosRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const videos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, videos };
    } catch (error) {
        console.error('Error getting videos:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Tạo video mới
 */
export const createVideo = async (videoData) => {
    try {
        const videosRef = collection(db, 'videos');
        const docRef = await addDoc(videosRef, {
            ...videoData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return { success: true, videoId: docRef.id };
    } catch (error) {
        console.error('Error creating video:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Cập nhật video
 */
export const updateVideo = async (videoId, videoData) => {
    try {
        const videoRef = doc(db, 'videos', videoId);
        await updateDoc(videoRef, {
            ...videoData,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating video:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Xóa video
 */
export const deleteVideo = async (videoId) => {
    try {
        const videoRef = doc(db, 'videos', videoId);
        await deleteDoc(videoRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting video:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Trích xuất YouTube video ID từ URL
 */
export const extractYouTubeId = (url) => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};
