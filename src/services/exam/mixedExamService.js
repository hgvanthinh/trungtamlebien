import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getExamById } from './examCrudService';
import {
  calculateTrueFalsePoints,
  isShortAnswerCorrect,
  calculateTotalScore,
  getMaxScore
} from '../../utils/examScoring';

// ============ MIXED EXAM GRADING & SUBMISSION ============

/**
 * Chấm điểm đề thi hỗn hợp (pure function, không Firestore)
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

        let correctCount = 0;
        ['a', 'b', 'c', 'd'].forEach(subItem => {
          const studentChoice = studentAnswer[subItem] === true;
          const correctChoice = correctAnswer[subItem] === true;
          if (studentChoice === correctChoice) correctCount++;
        });

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
        scores.trueFalse.breakdown.push({ question: i, correctCount, points });
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
export const submitMixedExam = async (examId, studentAnswers, studentInfo) => {
  try {
    const examResult = await getExamById(examId);
    if (!examResult.success) return examResult;

    const exam = examResult.exam;

    const gradingResult = gradeMixedExam(exam, studentAnswers);
    if (!gradingResult.success) return gradingResult;

    const submissionData = {
      examId,
      studentUid: studentInfo.studentUid,
      studentName: studentInfo.studentName,
      classId: studentInfo.classId || '',
      assignmentId: studentInfo.assignmentId || null,
      answers: gradingResult.gradedAnswers,
      scores: gradingResult.scores,
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
