import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getExamQuestions } from './examCrudService';

// ============ STUDENT SUBMISSIONS ============

/**
 * Nộp bài làm cho đề thi upload (PDF/ảnh) - học sinh upload file bài làm
 */
export const submitUploadExam = async (examId, studentUid, studentName, classId, fileData, assignmentId = null) => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');

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

    const submissionData = {
      examId,
      studentUid,
      studentName,
      classId,
      status: 'submitted',
      submittedAt: serverTimestamp(),
      fileType: fileData.fileType,
      originalSize: fileData.originalSize,
      processedSize: fileData.processedSize,
      compressionRatio: fileData.compressionRatio,
      converted: fileData.converted || false,
      autoGradedScore: 0,
      manualGradedScore: 0,
      totalScore: 0,
      maxScore: 0,
      createdAt: serverTimestamp(),
    };

    if (fileData.files && Array.isArray(fileData.files) && fileData.files.length > 0) {
      submissionData.files = fileData.files;
      submissionData.totalFiles = fileData.totalFiles || fileData.files.length;
      submissionData.fileUrl = fileData.files[0].fileUrl;
      submissionData.fileName = fileData.files[0].fileName;
    } else {
      submissionData.fileUrl = fileData.fileUrl;
      submissionData.fileName = fileData.fileName;
    }

    if (assignmentId) submissionData.assignmentId = assignmentId;
    if (fileData.originalType) submissionData.originalType = fileData.originalType;

    const docRef = await addDoc(submissionsRef, submissionData);
    return { success: true, submissionId: docRef.id };
  } catch (error) {
    console.error('Error submitting upload exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy submission đang làm (in_progress) của học sinh
 */
export const getInProgressSubmission = async (examId, studentUid, assignmentId = null) => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');
    let q;
    if (assignmentId) {
      q = query(
        submissionsRef,
        where('assignmentId', '==', assignmentId),
        where('studentUid', '==', studentUid),
        where('status', '==', 'in_progress'),
        limit(1)
      );
    } else {
      q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid),
        where('status', '==', 'in_progress'),
        limit(1)
      );
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error getting in_progress submission:', error);
    return null;
  }
};

/**
 * Tạo submission mới khi học sinh bắt đầu làm bài (cho đề manual)
 */
export const createSubmission = async (examId, studentUid, studentName, classId, assignmentId = null) => {
  try {
    const inProgress = await getInProgressSubmission(examId, studentUid, assignmentId);
    if (inProgress) {
      return {
        success: true,
        submissionId: inProgress.id,
        answers: inProgress.answers || {},
        duration: inProgress.duration || 0,
        isResumed: true
      };
    }

    const submissionsRef = collection(db, 'examSubmissions');

    if (!assignmentId) {
      const q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(q);
      const hasCompleted = existingSnapshot.docs.some(doc => doc.data().status !== 'in_progress');
      if (hasCompleted) {
        return { success: false, error: 'Bạn đã hoàn thành bài thi này rồi' };
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

    if (assignmentId) submissionData.assignmentId = assignmentId;

    const docRef = await addDoc(submissionsRef, submissionData);
    return { success: true, submissionId: docRef.id, answers: {}, duration: 0 };
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
 * Nộp bài và tự động chấm (đề manual)
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

    const questionsResult = await getExamQuestions(examId);
    if (!questionsResult.success) return questionsResult;

    const questions = questionsResult.questions;
    const answers = submissionData.answers || {};

    let autoGradedScore = 0;
    let maxScore = 0;
    const gradedAnswers = {};

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

        case 'short_answer': {
          const studentAnswer = (answer.text || '').trim();
          const correctAnswers = question.correctAnswers || [];

          if (question.caseSensitive) {
            isCorrect = correctAnswers.includes(studentAnswer);
          } else {
            isCorrect = correctAnswers.some(
              (correct) => correct.toLowerCase() === studentAnswer.toLowerCase()
            );
          }

          if (!isCorrect && question.acceptLatex && answer.latex) {
            isCorrect = correctAnswers.some((correct) => correct === answer.latex);
          }
          break;
        }

        case 'essay':
          gradedAnswers[question.id] = { ...answer, requiresManualGrading: true };
          continue;
      }

      if (isCorrect && question.type !== 'essay') {
        autoGradedScore += question.points || 0;
      }

      gradedAnswers[question.id] = { ...answer, isCorrect };
    }

    await updateDoc(submissionRef, {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      duration,
      answers: gradedAnswers,
      autoGradedScore,
      maxScore,
      totalScore: autoGradedScore,
    });

    return { success: true, autoGradedScore, maxScore };
  } catch (error) {
    console.error('Error submitting exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Nộp bài trắc nghiệm dạng mới (HS chọn đáp án từ form)
 */
export const submitMultipleChoiceExam = async (examId, studentUid, studentName, classId, studentAnswers, assignmentId = null) => {
  try {
    const { getExamById } = await import('./examCrudService');
    const examResult = await getExamById(examId);
    if (!examResult.success) return { success: false, error: 'Không tìm thấy đề thi' };

    const exam = examResult.exam;
    if (exam.type !== 'multiple_choice') return { success: false, error: 'Đề thi không phải dạng trắc nghiệm' };

    const answerKey = exam.answerKey || {};
    const totalQuestions = exam.totalQuestions || Object.keys(answerKey).length;

    let correctCount = 0;
    const gradedAnswers = {};

    for (let i = 1; i <= totalQuestions; i++) {
      const studentAnswer = studentAnswers[i] || null;
      const correctAnswer = answerKey[i] || answerKey[i.toString()];
      const isCorrect = studentAnswer && studentAnswer.toUpperCase() === correctAnswer?.toUpperCase();

      gradedAnswers[i] = { selected: studentAnswer, correct: correctAnswer, isCorrect };
      if (isCorrect) correctCount++;
    }

    const maxScore = exam.totalPoints || totalQuestions;
    const score = (correctCount / totalQuestions) * maxScore;

    const submissionsRef = collection(db, 'examSubmissions');

    if (!assignmentId) {
      const q = query(
        submissionsRef,
        where('examId', '==', examId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(q);
      if (!existingSnapshot.empty) return { success: false, error: 'Bạn đã nộp bài thi này rồi' };
    }

    const submissionData = {
      examId,
      studentUid,
      studentName,
      classId,
      status: 'graded',
      submittedAt: serverTimestamp(),
      answers: gradedAnswers,
      correctCount,
      totalQuestions,
      autoGradedScore: score,
      maxScore,
      totalScore: score,
      createdAt: serverTimestamp(),
    };

    if (assignmentId) submissionData.assignmentId = assignmentId;

    const docRef = await addDoc(submissionsRef, submissionData);
    return { success: true, submissionId: docRef.id, correctCount, totalQuestions, score, maxScore };
  } catch (error) {
    console.error('Error submitting multiple choice exam:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy submissions của học sinh
 */
export const getStudentSubmissions = async (studentUid) => {
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
    const submissions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    const submissions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting exam submissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Đếm số bài HS đã nộp của 1 đề (bỏ qua bài đang làm dở).
 * Dùng để cảnh báo GV khi sửa đề đã có người làm.
 */
export const countGradedSubmissions = async (examId) => {
  if (!examId) return { success: true, count: 0 };

  try {
    const submissionsRef = collection(db, 'examSubmissions');
    const q = query(submissionsRef, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const count = snapshot.docs.filter(
      (doc) => doc.data().status !== 'in_progress'
    ).length;
    return { success: true, count };
  } catch (error) {
    console.error('Error counting submissions:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

/**
 * Get all submissions (for admin grading page)
 */
export const getAllSubmissions = async () => {
  try {
    const submissionsRef = collection(db, 'examSubmissions');
    const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);
    const submissions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    await updateDoc(submissionRef, { ...gradeData, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    console.error('Error updating submission grade:', error);
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

    answers[questionId] = {
      ...answers[questionId],
      manualScore: score,
      feedback: feedback || '',
    };

    let manualGradedScore = 0;
    for (const answer of Object.values(answers)) {
      if (answer.manualScore !== undefined) {
        manualGradedScore += answer.manualScore;
      }
    }

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
