import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { storage } from '../config/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { uploadFile } from './storageService';
import {
  calculateDynamicPoints,
  calculateTrueFalsePoints,
  isShortAnswerCorrect,
  calculateTotalScore,
  getMaxScore
} from '../utils/examScoring';

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
    // Upload file to Storage
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) {
      return uploadResult;
    }

    // Detect file type
    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    // Create exam document
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

      // Compression metadata
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
 * @param {File} file - File đề thi (PDF/ảnh/DOCX)
 * @param {string} examTitle - Tên đề thi
 * @param {string} createdBy - UID người tạo
 * @param {Object} metadata - Metadata file (compression info)
 * @param {Object} answerKey - Đáp án đúng { 1: 'A', 2: 'B', ... }
 * @param {number} totalQuestions - Tổng số câu hỏi
 */
export const createMultipleChoiceExam = async (file, examTitle, createdBy, metadata = {}, answerKey = {}, totalQuestions = 0) => {
  try {
    // Upload file to Storage
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) {
      return uploadResult;
    }

    // Detect file type
    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    // Create exam document
    const examData = {
      title: examTitle,
      description: '',
      classIds: [],
      type: 'multiple_choice', // Loại mới: trắc nghiệm có file
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,
      createdBy: createdBy || '',
      isPublished: false,

      // Answer key
      answerKey: answerKey, // { 1: 'A', 2: 'B', ... }
      totalQuestions: totalQuestions,
      totalPoints: totalQuestions, // Mỗi câu 1 điểm

      // Compression metadata
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
 * Lấy tất cả đề thi - OPTIMIZED with pagination
 * @param {number} pageSize - Số lượng exams mỗi page (default: 50)
 * @param {DocumentSnapshot} lastDoc - Document cuối cùng của page trước (cho pagination)
 */
export const getAllExams = async (pageSize = 50, lastDoc = null) => {
  try {
    const examsRef = collection(db, 'exams');

    let q;
    if (lastDoc) {
      // Load page tiếp theo
      q = query(
        examsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      // Load page đầu tiên
      q = query(examsRef, orderBy('createdAt', 'desc'), limit(pageSize));
    }

    const snapshot = await getDocs(q);

    const exams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Return last document cho pagination
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
 * DEPRECATED: Nên dùng getAllExams() với pagination
 */
export const getAllExamsNoPagination = async () => {
  try {
    const examsRef = collection(db, 'exams');
    const q = query(examsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const exams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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
 * Cập nhật đề thi
 */
export const updateExam = async (examId, updates) => {
  try {
    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Xóa đề thi
 */
export const deleteExam = async (examId) => {
  try {
    // Lấy thông tin đề thi để xóa file trên Storage
    const examRef = doc(db, 'exams', examId);
    const examDoc = await getDoc(examRef);

    if (examDoc.exists()) {
      const examData = examDoc.data();

      // Xóa file đề thi trên Storage (nếu có)
      if (examData.fileUrl && examData.fileUrl.includes('firebasestorage')) {
        try {
          const urlParts = examData.fileUrl.split('/o/')[1];
          if (urlParts) {
            const filePath = decodeURIComponent(urlParts.split('?')[0]);
            const fileRef = ref(storage, filePath);
            await deleteObject(fileRef);
          }
        } catch (storageError) {
          // Không block việc xóa đề thi nếu xóa file thất bại
          console.warn('Warning: Could not delete exam file from Storage:', storageError.message);
        }
      }
    }

    // Delete all questions first
    const questionsRef = collection(db, 'exams', examId, 'questions');
    const questionsSnapshot = await getDocs(questionsRef);

    for (const questionDoc of questionsSnapshot.docs) {
      await deleteDoc(questionDoc.ref);
    }

    // Delete exam document
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

    // Update total questions and points in exam
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

    const questions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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

      // Delete question
      await deleteDoc(questionRef);

      // Update exam totals
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

// ============ STUDENT SUBMISSIONS ============

/**
 * Nộp bài làm cho đề thi upload (PDF/ảnh) - học sinh upload file bài làm
 */
export const submitUploadExam = async (examId, studentUid, studentName, classId, fileData, assignmentId = null) => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');

    // Chỉ check duplicate nếu KHÔNG có assignmentId (cho phép làm lại bài được giao)
    if (!assignmentId) {
      const q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        return { success: false, error: 'Bạn đã nộp bài thi này rồi' };
      }
    }

    // Create submission with file data
    // Build submission object - only include fields that have values
    const submissionData = {
      examId,
      studentUid,
      studentName,
      classId,
      status: 'submitted', // Immediately mark as submitted for upload type
      submittedAt: serverTimestamp(),

      // File information - Support both single file and multiple files
      fileType: fileData.fileType,

      // Compression metadata
      originalSize: fileData.originalSize,
      processedSize: fileData.processedSize,
      compressionRatio: fileData.compressionRatio,
      converted: fileData.converted || false,

      // Grading (needs manual grading by teacher)
      autoGradedScore: 0,
      manualGradedScore: 0,
      totalScore: 0,
      maxScore: 0, // Teacher will set this

      createdAt: serverTimestamp(),
    };

    // Handle multiple files or single file
    if (fileData.files && Array.isArray(fileData.files) && fileData.files.length > 0) {
      // Multiple files (new format)
      submissionData.files = fileData.files;
      submissionData.totalFiles = fileData.totalFiles || fileData.files.length;
      // Keep first file URL as primary for backward compatibility
      submissionData.fileUrl = fileData.files[0].fileUrl;
      submissionData.fileName = fileData.files[0].fileName;
    } else {
      // Single file (legacy format)
      submissionData.fileUrl = fileData.fileUrl;
      submissionData.fileName = fileData.fileName;
    }

    // Thêm assignmentId nếu có
    if (assignmentId) {
      submissionData.assignmentId = assignmentId;
    }

    // Only add originalType if file was converted
    if (fileData.originalType) {
      submissionData.originalType = fileData.originalType;
    }

    const docRef = await addDoc(submissionsRef, submissionData);

    return { success: true, submissionId: docRef.id };
  } catch (error) {
    console.error('Error submitting upload exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tạo submission mới khi học sinh bắt đầu làm bài (cho đề manual)
 */
export const createSubmission = async (examId, studentUid, studentName, classId, assignmentId = null) => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');

    // Chỉ check duplicate nếu KHÔNG có assignmentId (cho phép làm lại bài được giao)
    if (!assignmentId) {
      const q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        return { success: false, error: 'Bạn đã làm bài thi này rồi' };
      }
    }

    const submissionData = {
      examId,
      studentUid,
      studentName,
      classId,
      status: 'in_progress',
      submittedAt: null,
      autoGradedScore: 0,
      manualGradedScore: 0,
      totalScore: 0,
      maxScore: 0,
      answers: {},
      duration: 0,
      createdAt: serverTimestamp(),
    };

    // Thêm assignmentId nếu có
    if (assignmentId) {
      submissionData.assignmentId = assignmentId;
    }

    const docRef = await addDoc(submissionsRef, submissionData);

    return { success: true, submissionId: docRef.id };
  } catch (error) {
    console.error('Error creating submission:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lưu câu trả lời (auto-save khi học sinh làm bài)
 */
export const saveAnswer = async (submissionId, questionId, answer) => {
  try {
    const submissionRef = doc(db, 'examSubmissions', submissionId);
    await updateDoc(submissionRef, {
      [`answers.${questionId}`]: answer,
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving answer:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Nộp bài và tự động chấm
 */
export const submitExam = async (submissionId, duration) => {
  try {
    const submissionRef = doc(db, 'examSubmissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      return { success: false, error: 'Submission not found' };
    }

    const submissionData = submissionDoc.data();
    const examId = submissionData.examId;

    // Get exam questions for grading
    const questionsResult = await getExamQuestions(examId);
    if (!questionsResult.success) {
      return questionsResult;
    }

    const questions = questionsResult.questions;
    const answers = submissionData.answers || {};

    let autoGradedScore = 0;
    let maxScore = 0;
    const gradedAnswers = {};

    // Auto-grade questions
    for (const question of questions) {
      maxScore += question.points || 0;
      const answer = answers[question.id];

      if (!answer) {
        gradedAnswers[question.id] = { isCorrect: false };
        continue;
      }

      let isCorrect = false;

      switch (question.type) {
        case 'multiple_choice':
          isCorrect = answer.selected === question.correctAnswer;
          break;

        case 'true_false':
          isCorrect = answer.selected === question.correctAnswer;
          break;

        case 'short_answer':
          const studentAnswer = (answer.text || '').trim();
          const correctAnswers = question.correctAnswers || [];

          if (question.caseSensitive) {
            isCorrect = correctAnswers.includes(studentAnswer);
          } else {
            isCorrect = correctAnswers.some(
              (correct) => correct.toLowerCase() === studentAnswer.toLowerCase()
            );
          }

          // Check LaTeX answer if enabled
          if (!isCorrect && question.acceptLatex && answer.latex) {
            isCorrect = correctAnswers.some((correct) => correct === answer.latex);
          }
          break;

        case 'essay':
          // Cannot auto-grade essay questions
          gradedAnswers[question.id] = {
            ...answer,
            requiresManualGrading: true,
          };
          continue;
      }

      if (isCorrect && question.type !== 'essay') {
        autoGradedScore += question.points || 0;
      }

      gradedAnswers[question.id] = { ...answer, isCorrect };
    }

    // Update submission
    await updateDoc(submissionRef, {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      duration,
      answers: gradedAnswers,
      autoGradedScore,
      maxScore,
      totalScore: autoGradedScore, // Will be updated after manual grading
    });

    return {
      success: true,
      autoGradedScore,
      maxScore,
    };
  } catch (error) {
    console.error('Error submitting exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy submissions của học sinh
 */
export const getStudentSubmissions = async (studentUid) => {
  // Validate studentUid
  if (!studentUid) {
    console.warn('getStudentSubmissions called with undefined studentUid');
    return { success: true, submissions: [] };
  }

  try {
    const submissionsRef = collection(db, 'examSubmissions');
    const q = query(
      submissionsRef,
      where('studentUid', '==', studentUid),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting student submissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy tất cả submissions của 1 đề thi (cho giáo viên)
 */
export const getExamSubmissions = async (examId) => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');
    const q = query(
      submissionsRef,
      where('examId', '==', examId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting exam submissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Chấm điểm thủ công câu tự luận
 */
export const gradeEssayQuestion = async (submissionId, questionId, score, feedback) => {
  try {
    const submissionRef = doc(db, 'examSubmissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      return { success: false, error: 'Submission not found' };
    }

    const submissionData = submissionDoc.data();
    const answers = submissionData.answers || {};

    // Update essay answer with manual score
    answers[questionId] = {
      ...answers[questionId],
      manualScore: score,
      feedback: feedback || '',
    };

    // Calculate total manual score
    let manualGradedScore = 0;
    for (const answer of Object.values(answers)) {
      if (answer.manualScore !== undefined) {
        manualGradedScore += answer.manualScore;
      }
    }

    // Update submission
    await updateDoc(submissionRef, {
      answers,
      manualGradedScore,
      totalScore: (submissionData.autoGradedScore || 0) + manualGradedScore,
      status: 'graded',
    });

    return { success: true };
  } catch (error) {
    console.error('Error grading essay:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy đề thi của lớp (cho học sinh)
 */
export const getExamsForClass = async (classId) => {
  try {
    const examsRef = collection(db, 'exams');
    const q = query(
      examsRef,
      where('classIds', 'array-contains', classId),
      where('isPublished', '==', true)
      // Note: Removed orderBy to avoid composite index requirement
      // Will sort on client side if needed
    );
    const snapshot = await getDocs(q);

    const exams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt on client side
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

// ============ GRADING & ADMIN FUNCTIONS ============

/**
 * Get all submissions (for admin grading page)
 */
export const getAllSubmissions = async () => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');
    const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);

    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting all submissions:', error);
    return { success: false, error: error.message, submissions: [] };
  }
};

/**
 * Update submission grade and feedback
 */
export const updateSubmissionGrade = async (submissionId, gradeData) => {
  try {
    const submissionRef = doc(db, 'examSubmissions', submissionId);
    await updateDoc(submissionRef, {
      ...gradeData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating submission grade:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Nộp bài trắc nghiệm dạng mới (HS chọn đáp án từ form)
 * @param {string} examId - ID đề thi
 * @param {string} studentUid - UID học sinh
 * @param {string} studentName - Tên học sinh
 * @param {string} classId - ID lớp
 * @param {Object} studentAnswers - Đáp án HS chọn { 1: 'A', 2: 'B', ... }
 * @param {string} assignmentId - ID bài giao (optional)
 */
export const submitMultipleChoiceExam = async (examId, studentUid, studentName, classId, studentAnswers, assignmentId = null) => {
  try {
    // Lấy thông tin đề thi để có đáp án đúng
    const examResult = await getExamById(examId);
    if (!examResult.success) {
      return { success: false, error: 'Không tìm thấy đề thi' };
    }

    const exam = examResult.exam;
    if (exam.type !== 'multiple_choice') {
      return { success: false, error: 'Đề thi không phải dạng trắc nghiệm' };
    }

    const answerKey = exam.answerKey || {};
    const totalQuestions = exam.totalQuestions || Object.keys(answerKey).length;

    // Chấm điểm tự động
    let correctCount = 0;
    const gradedAnswers = {};

    for (let i = 1; i <= totalQuestions; i++) {
      const studentAnswer = studentAnswers[i] || null;
      const correctAnswer = answerKey[i] || answerKey[i.toString()];
      const isCorrect = studentAnswer && studentAnswer.toUpperCase() === correctAnswer?.toUpperCase();

      gradedAnswers[i] = {
        selected: studentAnswer,
        correct: correctAnswer,
        isCorrect: isCorrect,
      };

      if (isCorrect) {
        correctCount++;
      }
    }

    // Tính điểm (mỗi câu 1 điểm, hoặc theo totalPoints của exam)
    const maxScore = exam.totalPoints || totalQuestions;
    const score = (correctCount / totalQuestions) * maxScore;

    const submissionsRef = collection(db, 'examSubmissions');

    // Check duplicate nếu không có assignmentId
    if (!assignmentId) {
      const q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        return { success: false, error: 'Bạn đã nộp bài thi này rồi' };
      }
    }

    // Tạo submission
    const submissionData = {
      examId,
      studentUid,
      studentName,
      classId,
      status: 'graded', // Tự động chấm xong
      submittedAt: serverTimestamp(),
      answers: gradedAnswers,
      correctCount,
      totalQuestions,
      autoGradedScore: score,
      maxScore,
      totalScore: score,
      createdAt: serverTimestamp(),
    };

    if (assignmentId) {
      submissionData.assignmentId = assignmentId;
    }

    const docRef = await addDoc(submissionsRef, submissionData);

    return {
      success: true,
      submissionId: docRef.id,
      correctCount,
      totalQuestions,
      score,
      maxScore,
    };
  } catch (error) {
    console.error('Error submitting multiple choice exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật đề thi upload (chỉ upload lại file, không đổi tên)
 */
export const updateUploadExam = async (examId, file, metadata = {}) => {
  try {
    // Upload new file to Storage
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) {
      return uploadResult;
    }

    // Detect file type
    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    // Update exam document (keep title unchanged)
    const updates = {
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: fileType,

      // Update compression metadata
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

    // Upload new file if provided
    if (file) {
      const uploadResult = await uploadFile('exams', file);
      if (!uploadResult.success) {
        return uploadResult;
      }

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

    // Update answer key if provided
    if (answerKey !== null) {
      updates.answerKey = answerKey;
    }

    // Update total questions if provided
    if (totalQuestions !== null) {
      updates.totalQuestions = totalQuestions;
      updates.totalPoints = totalQuestions; // Mỗi câu 1 điểm
    }

    return await updateExam(examId, updates);
  } catch (error) {
    console.error('Error updating multiple choice exam:', error);
    return { success: false, error: error.message };
  }
};

// ============ MIXED EXAM (ABCD + TRUE/FALSE + SHORT ANSWER) ============

/**
 * Tạo đề thi hỗn hợp (ABCD + Đúng/Sai + Trả lời ngắn)
 * @param {File} file - File đề thi
 * @param {string} title - Tên đề thi
 * @param {string} createdBy - UID người tạo
 * @param {Object} metadata - Metadata file
 * @param {Object} questionTypes - Cấu hình các loại câu hỏi
 * @param {Object} answerKey - Đáp án theo từng loại
 * @param {Object} settings - Cài đặt cho short answer
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
    // Upload file to Storage
    const uploadResult = await uploadFile('exams', file);
    if (!uploadResult.success) {
      return uploadResult;
    }

    // Detect file type
    const fileType = file.type.includes('pdf') ? 'pdf' : 'image';

    // Calculate dynamic points for each question type
    const questionCounts = {
      abcd: questionTypes.abcd?.count || 0,
      trueFalse: questionTypes.trueFalse?.count || 0,
      shortAnswer: questionTypes.shortAnswer?.count || 0
    };

    const dynamicPoints = calculateDynamicPoints(questionCounts);

    // Build question type config with calculated points
    const questionTypesConfig = {
      abcd: {
        enabled: questionCounts.abcd > 0,
        count: questionCounts.abcd,
        maxCount: 12,
        pointsPerQuestion: dynamicPoints.abcd,
        basePoints: 0.25
      },
      trueFalse: {
        enabled: questionCounts.trueFalse > 0,
        count: questionCounts.trueFalse,
        maxCount: 4,
        pointsPerQuestion: dynamicPoints.trueFalse,
        basePoints: 1.0,
        subItemsPerQuestion: 4
      },
      shortAnswer: {
        enabled: questionCounts.shortAnswer > 0,
        count: questionCounts.shortAnswer,
        maxCount: 6,
        pointsPerQuestion: dynamicPoints.shortAnswer,
        basePoints: 0.5
      }
    };

    // Calculate total questions
    const totalQuestions = questionCounts.abcd + questionCounts.trueFalse + questionCounts.shortAnswer;

    // Create exam document
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

      // Question configuration
      questionTypes: questionTypesConfig,

      // Answer keys
      answerKey,

      // Short answer settings
      shortAnswerSettings: {
        caseSensitive: settings.caseSensitive || false,
        trimWhitespace: settings.trimWhitespace !== false,
        normalizeSpaces: settings.normalizeSpaces !== false
      },

      // Totals — tối đa bằng tổng ngân sách các section có mặt (3-4-3)
      totalPoints: (questionCounts.abcd > 0 ? 3 : 0)
        + (questionCounts.trueFalse > 0 ? 4 : 0)
        + (questionCounts.shortAnswer > 0 ? 3 : 0),
      totalQuestions,

      // Compression metadata
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

    // Upload new file if provided
    if (file) {
      const uploadResult = await uploadFile('exams', file);
      if (!uploadResult.success) {
        return uploadResult;
      }

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

    // Update question types and recalculate points
    if (questionTypes) {
      const questionCounts = {
        abcd: questionTypes.abcd?.count || 0,
        trueFalse: questionTypes.trueFalse?.count || 0,
        shortAnswer: questionTypes.shortAnswer?.count || 0
      };

      const dynamicPoints = calculateDynamicPoints(questionCounts);

      updates.questionTypes = {
        abcd: {
          enabled: questionCounts.abcd > 0,
          count: questionCounts.abcd,
          maxCount: 12,
          pointsPerQuestion: dynamicPoints.abcd,
          basePoints: 0.25
        },
        trueFalse: {
          enabled: questionCounts.trueFalse > 0,
          count: questionCounts.trueFalse,
          maxCount: 4,
          pointsPerQuestion: dynamicPoints.trueFalse,
          basePoints: 1.0,
          subItemsPerQuestion: 4
        },
        shortAnswer: {
          enabled: questionCounts.shortAnswer > 0,
          count: questionCounts.shortAnswer,
          maxCount: 6,
          pointsPerQuestion: dynamicPoints.shortAnswer,
          basePoints: 0.5
        }
      };

      updates.totalQuestions = questionCounts.abcd + questionCounts.trueFalse + questionCounts.shortAnswer;
    }

    // Update answer key
    if (answerKey !== null) {
      updates.answerKey = answerKey;
    }

    // Update settings
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
 * Chấm điểm đề thi hỗn hợp
 * @param {Object} exam - Dữ liệu đề thi
 * @param {Object} studentAnswers - Câu trả lời của học sinh
 * @returns {Object} Kết quả chấm điểm
 */
export const gradeMixedExam = (exam, studentAnswers) => {
  try {
    const scores = {
      abcd: { correct: 0, total: 0, points: 0 },
      trueFalse: { points: 0, breakdown: [] },
      shortAnswer: { correct: 0, total: 0, points: 0 }
    };

    const gradedAnswers = {
      abcd: {},
      trueFalse: {},
      shortAnswer: {}
    };

    // 1. Grade ABCD Multiple Choice
    if (exam.questionTypes.abcd.enabled) {
      const pointsPerQuestion = exam.questionTypes.abcd.pointsPerQuestion;
      const answerKey = exam.answerKey.abcd || {};

      for (let i = 1; i <= exam.questionTypes.abcd.count; i++) {
        const studentAnswer = studentAnswers.abcd?.[i];
        const correctAnswer = answerKey[i];
        const isCorrect = studentAnswer && studentAnswer.toUpperCase() === correctAnswer?.toUpperCase();

        gradedAnswers.abcd[i] = {
          selected: studentAnswer || null,
          correct: correctAnswer,
          isCorrect
        };

        scores.abcd.total++;
        if (isCorrect) {
          scores.abcd.correct++;
          scores.abcd.points += pointsPerQuestion;
        }
      }
    }

    // 2. Grade True/False with weighted scoring
    if (exam.questionTypes.trueFalse.enabled) {
      const pointsPerQuestion = exam.questionTypes.trueFalse.pointsPerQuestion;
      const answerKey = exam.answerKey.trueFalse || {};

      for (let i = 1; i <= exam.questionTypes.trueFalse.count; i++) {
        const studentAnswer = studentAnswers.trueFalse?.[i] || {};
        const correctAnswer = answerKey[i] || {};

        // Count correct sub-items
        let correctCount = 0;
        ['a', 'b', 'c', 'd'].forEach(subItem => {
          const studentChoice = studentAnswer[subItem] === true;
          const correctChoice = correctAnswer[subItem] === true;
          if (studentChoice === correctChoice) {
            correctCount++;
          }
        });

        // Apply weighted scoring
        const points = calculateTrueFalsePoints(correctCount, pointsPerQuestion);

        gradedAnswers.trueFalse[i] = {
          answers: {
            a: studentAnswer.a === true,
            b: studentAnswer.b === true,
            c: studentAnswer.c === true,
            d: studentAnswer.d === true
          },
          correct: correctAnswer,
          correctCount,
          points
        };

        scores.trueFalse.points += points;
        scores.trueFalse.breakdown.push({
          question: i,
          correctCount,
          points
        });
      }
    }

    // 3. Grade Short Answer
    if (exam.questionTypes.shortAnswer.enabled) {
      const pointsPerQuestion = exam.questionTypes.shortAnswer.pointsPerQuestion;
      const answerKey = exam.answerKey.shortAnswer || {};
      const settings = exam.shortAnswerSettings || {};

      for (let i = 1; i <= exam.questionTypes.shortAnswer.count; i++) {
        const studentAnswer = studentAnswers.shortAnswer?.[i] || '';
        const correctAnswers = answerKey[i] || [];

        const isCorrect = isShortAnswerCorrect(studentAnswer, correctAnswers, settings);

        gradedAnswers.shortAnswer[i] = {
          answer: studentAnswer,
          correct: correctAnswers,
          isCorrect
        };

        scores.shortAnswer.total++;
        if (isCorrect) {
          scores.shortAnswer.correct++;
          scores.shortAnswer.points += pointsPerQuestion;
        }
      }
    }

    // 4. Calculate total score
    const totalScore = calculateTotalScore(scores);

    // maxScore = tổng ngân sách section có mặt (tỉ lệ 3-4-3)
    const maxScore = getMaxScore(exam.questionTypes);

    return {
      success: true,
      gradedAnswers,
      scores,
      totalScore,
      maxScore
    };
  } catch (error) {
    console.error('Error grading mixed exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Nộp bài thi hỗn hợp
 * @param {string} examId - ID đề thi
 * @param {Object} studentAnswers - Câu trả lời của học sinh
 * @param {Object} studentInfo - Thông tin học sinh
 */
export const submitMixedExam = async (
  examId,
  studentAnswers,
  studentInfo
) => {
  try {
    // Get exam
    const examResult = await getExamById(examId);
    if (!examResult.success) {
      return examResult;
    }

    const exam = examResult.exam;

    // Grade the exam
    const gradingResult = gradeMixedExam(exam, studentAnswers);
    if (!gradingResult.success) {
      return gradingResult;
    }

    // Create submission document
    const submissionData = {
      examId,
      studentUid: studentInfo.studentUid,
      studentName: studentInfo.studentName,
      classId: studentInfo.classId || '',
      assignmentId: studentInfo.assignmentId || null,

      // Graded answers
      answers: gradingResult.gradedAnswers,

      // Score breakdown
      scores: gradingResult.scores,

      // Totals
      status: 'graded',
      autoGradedScore: gradingResult.totalScore,
      totalScore: gradingResult.totalScore,
      maxScore: gradingResult.maxScore,

      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    const submissionsRef = collection(db, 'examSubmissions');
    const docRef = await addDoc(submissionsRef, submissionData);

    return {
      success: true,
      submissionId: docRef.id,
      totalScore: gradingResult.totalScore,
      maxScore: gradingResult.maxScore,
      scores: gradingResult.scores
    };
  } catch (error) {
    console.error('Error submitting mixed exam:', error);
    return { success: false, error: error.message };
  }
};

