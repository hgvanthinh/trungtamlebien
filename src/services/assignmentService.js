import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Giao bài cho lớp
 */
export const assignExamToClass = async (assignmentData) => {
    try {
        const assignmentsRef = collection(db, 'assignments');
        const docRef = await addDoc(assignmentsRef, {
            ...assignmentData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return { success: true, assignmentId: docRef.id };
    } catch (error) {
        console.error('Error assigning exam:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Lấy danh sách bài đã giao
 */
export const getAllAssignments = async () => {
    try {
        const assignmentsRef = collection(db, 'assignments');
        const q = query(assignmentsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const assignments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, assignments };
    } catch (error) {
        console.error('Error getting assignments:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Lấy bài giao theo examId
 */
export const getAssignmentsByExam = async (examId) => {
    try {
        const assignmentsRef = collection(db, 'assignments');
        const q = query(assignmentsRef, where('examId', '==', examId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const assignments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, assignments };
    } catch (error) {
        console.error('Error getting assignments by exam:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Lấy bài giao cho học sinh (theo classIds của học sinh)
 */
export const getAssignmentsForStudent = async (studentClassIds) => {
    try {
        if (!studentClassIds || studentClassIds.length === 0) {
            return { success: true, assignments: [] };
        }

        const assignmentsRef = collection(db, 'assignments');
        const q = query(assignmentsRef, where('classId', 'in', studentClassIds));
        const snapshot = await getDocs(q);

        const now = new Date();
        const assignments = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(assignment => {
                // Chỉ lấy bài chưa hết hạn
                const deadline = assignment.deadline?.toDate();
                return deadline && deadline > now;
            });

        return { success: true, assignments };
    } catch (error) {
        console.error('Error getting assignments for student:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Xóa bài giao
 */
export const deleteAssignment = async (assignmentId) => {
    try {
        const assignmentRef = doc(db, 'assignments', assignmentId);
        await deleteDoc(assignmentRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting assignment:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Cập nhật bài giao
 */
export const updateAssignment = async (assignmentId, assignmentData) => {
    try {
        const assignmentRef = doc(db, 'assignments', assignmentId);
        await updateDoc(assignmentRef, {
            ...assignmentData,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating assignment:', error);
        return { success: false, error: error.message };
    }
};
