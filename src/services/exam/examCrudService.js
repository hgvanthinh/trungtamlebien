import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { storage } from '../../config/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { uploadFile } from '../storageService';
import { calculateDynamicPoints } from '../../utils/examScoring';

// ============ EXAM MANAGEMENT ============

/**
 * Tạo đề thi mới (upload hoặc manual)
 */
export const createExam = async (examData) => {
  try {
    const examsRef = collection(db, 'exams');
    const docRef = await addDoc(examsRef, {
      ...examData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, examId: docRef.id };
  } catch (error) {
    console.error('Error creating exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Upload đề thi file (PDF/ảnh/DOCX) - with compression metadata
 */
export const uploadExamFile = async (file, examTitle, createdBy, metadata = {}) => {
  try {
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) return uploadResult;

    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    const examData = {
      title: examTitle,
      description: '',
      classIds: [],
      type: 'upload',
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,
      createdBy: createdBy || '',
      isPublished: false,
      originalSize: metadata.originalSize || file.size,
      processedSize: metadata.processedSize || file.size,
      compressionRatio: metadata.compressionRatio || '0',
      converted: metadata.converted || false,
      originalType: metadata.originalType || file.type,
    };

    return await createExam(examData);
  } catch (error) {
    console.error('Error uploading exam file:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tạo đề trắc nghiệm mới (upload file + đáp án)
 */
export const createMultipleChoiceExam = async (file, examTitle, createdBy, metadata = {}, answerKey = {}, totalQuestions = 0) => {
  try {
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) return uploadResult;

    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    const examData = {
      title: examTitle,
      description: '',
      classIds: [],
      type: 'multiple_choice',
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,
      createdBy: createdBy || '',
      isPublished: false,
      answerKey: answerKey,
      totalQuestions: totalQuestions,
      totalPoints: totalQuestions,
      originalSize: metadata.originalSize || file.size,
      processedSize: metadata.processedSize || file.size,
      compressionRatio: metadata.compressionRatio || '0',
      converted: metadata.converted || false,
      originalType: metadata.originalType || file.type,
    };

    return await createExam(examData);
  } catch (error) {
    console.error('Error creating multiple choice exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tạo đề thi hỗn hợp (ABCD + Đúng/Sai + Trả lời ngắn)
 */
export const createMixedExam = async (
  file,
  title,
  createdBy,
  metadata = {},
  questionTypes,
  answerKey,
  settings = {}
) => {
  try {
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) return uploadResult;

    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    const questionCounts = {
      abcd: questionTypes.abcd?.count || 0,
      trueFalse: questionTypes.trueFalse?.count || 0,
      shortAnswer: questionTypes.shortAnswer?.count || 0
    };

    // Lấy budget tùy chỉnh từ GV (mặc định 3-4-3 nếu không có)
    const sectionBudgets = {
      abcd: questionTypes.abcd?.budget ?? 3,
      trueFalse: questionTypes.trueFalse?.budget ?? 4,
      shortAnswer: questionTypes.shortAnswer?.budget ?? 3,
    };

    const dynamicPoints = calculateDynamicPoints(questionCounts, sectionBudgets);

    const questionTypesConfig = {
      abcd: {
        enabled: questionCounts.abcd > 0,
        count: questionCounts.abcd,
        maxCount: 12,
        budget: sectionBudgets.abcd,
        pointsPerQuestion: dynamicPoints.abcd,
        basePoints: 0.25
      },
      trueFalse: {
        enabled: questionCounts.trueFalse > 0,
        count: questionCounts.trueFalse,
        maxCount: 4,
        budget: sectionBudgets.trueFalse,
        pointsPerQuestion: dynamicPoints.trueFalse,
        basePoints: 1.0,
        subItemsPerQuestion: 4
      },
      shortAnswer: {
        enabled: questionCounts.shortAnswer > 0,
        count: questionCounts.shortAnswer,
        maxCount: 6,
        budget: sectionBudgets.shortAnswer,
        pointsPerQuestion: dynamicPoints.shortAnswer,
        basePoints: 0.5
      }
    };

    const totalQuestions = questionCounts.abcd + questionCounts.trueFalse + questionCounts.shortAnswer;

    const examData = {
      title,
      description: '',
      classIds: [],
      type: 'mixed_exam',
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType,
      createdBy: createdBy || '',
      isPublished: false,
      questionTypes: questionTypesConfig,
      answerKey,
      shortAnswerSettings: {
        caseSensitive: settings.caseSensitive || false,
        trimWhitespace: settings.trimWhitespace !== false,
        normalizeSpaces: settings.normalizeSpaces !== false
      },
      totalPoints: dynamicPoints.total,
      totalQuestions,
      originalSize: metadata.originalSize || file.size,
      processedSize: metadata.processedSize || file.size,
      compressionRatio: metadata.compressionRatio || '0',
      converted: metadata.converted || false,
      originalType: metadata.originalType || file.type
    };

    return await createExam(examData);
  } catch (error) {
    console.error('Error creating mixed exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy tất cả đề thi - OPTIMIZED with pagination
 */
export const getAllExams = async (pageSize = 50, lastDoc = null) => {
  try {
    const examsRef = collection(db, 'exams');

    let q;
    if (lastDoc) {
      q = query(examsRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
    } else {
      q = query(examsRef, orderBy('createdAt', 'desc'), limit(pageSize));
    }

    const snapshot = await getDocs(q);
    const exams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const hasMore = snapshot.docs.length === pageSize;

    return { success: true, exams, lastDoc: lastVisible, hasMore };
  } catch (error) {
    console.error('Error getting exams:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy tất cả đề thi (không pagination) - backward compatibility
 * @deprecated Nên dùng getAllExams() với pagination
 */
export const getAllExamsNoPagination = async () => {
  try {
    const examsRef = collection(db, 'exams');
    const q = query(examsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const exams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { success: true, exams };
  } catch (error) {
    console.error('Error getting exams:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy đề thi theo ID
 */
export const getExamById = async (examId) => {
  try {
    const examRef = doc(db, 'exams', examId);
    const examDoc = await getDoc(examRef);

    if (!examDoc.exists()) {
      return { success: false, error: 'Exam not found' };
    }

    return { success: true, exam: { id: examDoc.id, ...examDoc.data() } };
  } catch (error) {
    console.error('Error getting exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy đề thi của lớp (cho học sinh)
 */
export const getExamsForClass = async (classId) => {
  try {
    const { where } = await import('firebase/firestore');
    const examsRef = collection(db, 'exams');
    const q = query(
      examsRef,
      where('classIds', 'array-contains', classId),
      where('isPublished', '==', true)
    );
    const snapshot = await getDocs(q);

    const exams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    exams.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    return { success: true, exams };
  } catch (error) {
    console.error('Error getting class exams:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật đề thi
 */
export const updateExam = async (examId, updates) => {
  try {
    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, { ...updates, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    console.error('Error updating exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật đề thi upload (chỉ upload lại file, không đổi tên)
 */
export const updateUploadExam = async (examId, file, metadata = {}) => {
  try {
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) return uploadResult;

    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    const updates = {
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,
      originalSize: metadata.originalSize || file.size,
      processedSize: metadata.processedSize || file.size,
      compressionRatio: metadata.compressionRatio || '0',
      converted: metadata.converted || false,
      originalType: metadata.originalType || file.type,
    };

    return await updateExam(examId, updates);
  } catch (error) {
    console.error('Error updating upload exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật đề trắc nghiệm (upload lại file và/hoặc cập nhật đáp án)
 */
export const updateMultipleChoiceExam = async (examId, file, metadata = {}, answerKey = null, totalQuestions = null) => {
  try {
    const updates = {};

    if (file) {
      const uploadResult = await uploadFile('exams', file);
      if (!uploadResult.success) return uploadResult;

      const fileType = file.type.includes('pdf') ? 'pdf' : 'image';
      updates.fileUrl = uploadResult.url;
      updates.fileName = file.name;
      updates.fileType = fileType;
      updates.originalSize = metadata.originalSize || file.size;
      updates.processedSize = metadata.processedSize || file.size;
      updates.compressionRatio = metadata.compressionRatio || '0';
      updates.converted = metadata.converted || false;
      updates.originalType = metadata.originalType || file.type;
    }

    if (answerKey !== null) updates.answerKey = answerKey;
    if (totalQuestions !== null) {
      updates.totalQuestions = totalQuestions;
      updates.totalPoints = totalQuestions;
    }

    return await updateExam(examId, updates);
  } catch (error) {
    console.error('Error updating multiple choice exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật đề thi hỗn hợp
 */
export const updateMixedExam = async (
  examId,
  file = null,
  metadata = {},
  questionTypes = null,
  answerKey = null,
  settings = null
) => {
  try {
    const updates = {};

    if (file) {
      const uploadResult = await uploadFile('exams', file);
      if (!uploadResult.success) return uploadResult;

      const fileType = file.type.includes('pdf') ? 'pdf' : 'image';
      updates.fileUrl = uploadResult.url;
      updates.fileName = file.name;
      updates.fileType = fileType;
      updates.originalSize = metadata.originalSize || file.size;
      updates.processedSize = metadata.processedSize || file.size;
      updates.compressionRatio = metadata.compressionRatio || '0';
      updates.converted = metadata.converted || false;
      updates.originalType = metadata.originalType || file.type;
    }

    if (questionTypes) {
      const questionCounts = {
        abcd: questionTypes.abcd?.count || 0,
        trueFalse: questionTypes.trueFalse?.count || 0,
        shortAnswer: questionTypes.shortAnswer?.count || 0
      };

      // Lấy budget tùy chỉnh từ GV (mặc định 3-4-3 nếu không có)
      const sectionBudgets = {
        abcd: questionTypes.abcd?.budget ?? 3,
        trueFalse: questionTypes.trueFalse?.budget ?? 4,
        shortAnswer: questionTypes.shortAnswer?.budget ?? 3,
      };

      const dynamicPoints = calculateDynamicPoints(questionCounts, sectionBudgets);

      updates.questionTypes = {
        abcd: {
          enabled: questionCounts.abcd > 0,
          count: questionCounts.abcd,
          maxCount: 12,
          budget: sectionBudgets.abcd,
          pointsPerQuestion: dynamicPoints.abcd,
          basePoints: 0.25
        },
        trueFalse: {
          enabled: questionCounts.trueFalse > 0,
          count: questionCounts.trueFalse,
          maxCount: 4,
          budget: sectionBudgets.trueFalse,
          pointsPerQuestion: dynamicPoints.trueFalse,
          basePoints: 1.0,
          subItemsPerQuestion: 4
        },
        shortAnswer: {
          enabled: questionCounts.shortAnswer > 0,
          count: questionCounts.shortAnswer,
          maxCount: 6,
          budget: sectionBudgets.shortAnswer,
          pointsPerQuestion: dynamicPoints.shortAnswer,
          basePoints: 0.5
        }
      };

      updates.totalPoints = dynamicPoints.total;
      updates.totalQuestions = questionCounts.abcd + questionCounts.trueFalse + questionCounts.shortAnswer;
    }

    if (answerKey !== null) updates.answerKey = answerKey;

    if (settings !== null) {
      updates.shortAnswerSettings = {
        caseSensitive: settings.caseSensitive || false,
        trimWhitespace: settings.trimWhitespace !== false,
        normalizeSpaces: settings.normalizeSpaces !== false
      };
    }

    return await updateExam(examId, updates);
  } catch (error) {
    console.error('Error updating mixed exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Xóa đề thi
 */
export const deleteExam = async (examId) => {
  try {
    const examRef = doc(db, 'exams', examId);
    const examDoc = await getDoc(examRef);

    if (examDoc.exists()) {
      const examData = examDoc.data();

      if (examData.fileUrl && examData.fileUrl.includes('firebasestorage')) {
        try {
          const urlParts = examData.fileUrl.split('/o/')[1];
          if (urlParts) {
            const filePath = decodeURIComponent(urlParts.split('?')[0]);
            const fileRef = ref(storage, filePath);
            await deleteObject(fileRef);
          }
        } catch (storageError) {
          console.warn('Warning: Could not delete exam file from Storage:', storageError.message);
        }
      }
    }

    const questionsRef = collection(db, 'exams', examId, 'questions');
    const questionsSnapshot = await getDocs(questionsRef);
    for (const questionDoc of questionsSnapshot.docs) {
      await deleteDoc(questionDoc.ref);
    }

    await deleteDoc(examRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting exam:', error);
    return { success: false, error: error.message };
  }
};

// ============ QUESTION MANAGEMENT ============

/**
 * Thêm câu hỏi vào đề thi
 */
export const addQuestion = async (examId, questionData) => {
  try {
    const questionsRef = collection(db, 'exams', examId, 'questions');
    const docRef = await addDoc(questionsRef, questionData);

    const examRef = doc(db, 'exams', examId);
    const examDoc = await getDoc(examRef);

    if (examDoc.exists()) {
      const currentTotal = examDoc.data().totalQuestions || 0;
      const currentPoints = examDoc.data().totalPoints || 0;

      await updateDoc(examRef, {
        totalQuestions: currentTotal + 1,
        totalPoints: currentPoints + (questionData.points || 0),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, questionId: docRef.id };
  } catch (error) {
    console.error('Error adding question:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy tất cả câu hỏi của đề thi
 */
export const getExamQuestions = async (examId) => {
  try {
    const questionsRef = collection(db, 'exams', examId, 'questions');
    const q = query(questionsRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    const questions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { success: true, questions };
  } catch (error) {
    console.error('Error getting questions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật câu hỏi
 */
export const updateQuestion = async (examId, questionId, updates) => {
  try {
    const questionRef = doc(db, 'exams', examId, 'questions', questionId);
    await updateDoc(questionRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating question:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Xóa câu hỏi
 */
export const deleteQuestion = async (examId, questionId) => {
  try {
    const questionRef = doc(db, 'exams', examId, 'questions', questionId);
    const questionDoc = await getDoc(questionRef);

    if (questionDoc.exists()) {
      const points = questionDoc.data().points || 0;
      await deleteDoc(questionRef);

      const examRef = doc(db, 'exams', examId);
      const examDoc = await getDoc(examRef);

      if (examDoc.exists()) {
        const currentTotal = examDoc.data().totalQuestions || 0;
        const currentPoints = examDoc.data().totalPoints || 0;

        await updateDoc(examRef, {
          totalQuestions: Math.max(0, currentTotal - 1),
          totalPoints: Math.max(0, currentPoints - points),
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting question:', error);
    return { success: false, error: error.message };
  }
};
