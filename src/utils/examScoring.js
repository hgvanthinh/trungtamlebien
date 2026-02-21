/**
 * Exam Scoring Utilities
 * Provides functions for calculating dynamic points and grading mixed exams
 */

/**
 * Calculate dynamic points per question for each type
 * Section budgets are ALWAYS fixed at ABCD=3pt, TrueFalse=4pt, ShortAnswer=3pt (ratio 3-4-3)
 * Points per question = section budget / number of questions in that section
 * Total score = sum of budgets for active sections (max 10 when all 3 types present)
 *
 * @param {Object} questionCounts - Number of questions per type
 * @param {number} questionCounts.abcd - ABCD multiple choice count (0-12)
 * @param {number} questionCounts.trueFalse - True/False count (0-4)
 * @param {number} questionCounts.shortAnswer - Short answer count (0-6)
 * @returns {Object} Points per question for each type + total max score
 */
export function calculateDynamicPoints(questionCounts) {
  const { abcd = 0, trueFalse = 0, shortAnswer = 0 } = questionCounts;

  // Fixed section budgets — tỉ lệ 3-4-3 không đổi dù số câu thay đổi
  const sectionBudgets = {
    abcd: 3,        // Luôn 3đ cho toàn bộ phần ABCD
    trueFalse: 4,   // Luôn 4đ cho toàn bộ phần Đúng/Sai
    shortAnswer: 3  // Luôn 3đ cho toàn bộ phần Tự luận ngắn
  };

  // Prevent division by zero
  if (abcd === 0 && trueFalse === 0 && shortAnswer === 0) {
    return {
      abcd: 0,
      trueFalse: 0,
      shortAnswer: 0,
      total: 0
    };
  }

  // Points per question = section budget ÷ count (active sections only)
  return {
    abcd: abcd > 0 ? sectionBudgets.abcd / abcd : 0,
    trueFalse: trueFalse > 0 ? sectionBudgets.trueFalse / trueFalse : 0,
    shortAnswer: shortAnswer > 0 ? sectionBudgets.shortAnswer / shortAnswer : 0,
    // Total = sum of budgets for active sections
    total: (abcd > 0 ? sectionBudgets.abcd : 0)
      + (trueFalse > 0 ? sectionBudgets.trueFalse : 0)
      + (shortAnswer > 0 ? sectionBudgets.shortAnswer : 0)
  };
}

/**
 * Get the max possible score for a given set of question types
 * @param {Object} questionTypes - exam.questionTypes object
 * @returns {number} Max score
 */
export function getMaxScore(questionTypes = {}) {
  const sectionBudgets = { abcd: 3, trueFalse: 4, shortAnswer: 3 };
  let max = 0;
  if (questionTypes.abcd?.enabled) max += sectionBudgets.abcd;
  if (questionTypes.trueFalse?.enabled) max += sectionBudgets.trueFalse;
  if (questionTypes.shortAnswer?.enabled) max += sectionBudgets.shortAnswer;
  return max;
}

/**
 * Calculate points for a True/False question based on number of correct sub-items
 * Uses weighted scoring: 4/4=100%, 3/4=50%, 2/4=25%, 1/4=10%, 0/4=0%
 *
 * @param {number} correctCount - Number of correct sub-items (0-4)
 * @param {number} pointsPerQuestion - Total points available for this question
 * @returns {number} Points earned for this question
 */
export function calculateTrueFalsePoints(correctCount, pointsPerQuestion) {
  // Weighted scoring rules
  const weights = {
    4: 1.0,   // 4/4 correct = 100% of points
    3: 0.5,   // 3/4 correct = 50% of points
    2: 0.25,  // 2/4 correct = 25% of points
    1: 0.1,   // 1/4 correct = 10% of points
    0: 0      // 0/4 correct = 0 points
  };

  // Ensure correctCount is valid (0-4)
  const validCount = Math.max(0, Math.min(4, correctCount));

  return weights[validCount] * pointsPerQuestion;
}

/**
 * Normalize a short answer text based on settings
 *
 * @param {string} text - The text to normalize
 * @param {Object} settings - Normalization settings
 * @param {boolean} settings.trimWhitespace - Remove leading/trailing spaces
 * @param {boolean} settings.normalizeSpaces - Collapse multiple spaces to single space
 * @param {boolean} settings.caseSensitive - Preserve case (if false, converts to lowercase)
 * @returns {string} Normalized text
 */
export function normalizeAnswer(text, settings = {}) {
  const {
    trimWhitespace = true,
    normalizeSpaces = true,
    caseSensitive = false
  } = settings;

  if (typeof text !== 'string') {
    return '';
  }

  let normalized = text;

  // Trim whitespace
  if (trimWhitespace) {
    normalized = normalized.trim();
  }

  // Normalize multiple spaces to single space
  if (normalizeSpaces) {
    normalized = normalized.replace(/\s+/g, ' ');
  }

  // Convert to lowercase if case-insensitive
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Check if a student's short answer matches any acceptable answer
 *
 * @param {string} studentAnswer - The student's answer
 * @param {string[]} correctAnswers - Array of acceptable answers
 * @param {Object} settings - Normalization settings
 * @returns {boolean} True if answer is correct
 */
export function isShortAnswerCorrect(studentAnswer, correctAnswers, settings = {}) {
  if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
    return false;
  }

  const normalizedStudent = normalizeAnswer(studentAnswer, settings);

  return correctAnswers.some(correctAns => {
    const normalizedCorrect = normalizeAnswer(correctAns, settings);
    return normalizedStudent === normalizedCorrect;
  });
}

/**
 * Validate question counts against maximum limits
 *
 * @param {Object} counts - Question counts per type
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateQuestionCounts(counts) {
  const errors = [];
  const { abcd = 0, trueFalse = 0, shortAnswer = 0 } = counts;

  // Maximum limits
  const maxLimits = {
    abcd: 12,
    trueFalse: 4,
    shortAnswer: 6
  };

  // Check if at least one question type has questions
  if (abcd === 0 && trueFalse === 0 && shortAnswer === 0) {
    errors.push('Phải có ít nhất 1 loại câu hỏi');
  }

  // Check maximum limits
  if (abcd > maxLimits.abcd) {
    errors.push(`Trắc nghiệm ABCD: Tối đa ${maxLimits.abcd} câu (hiện tại: ${abcd})`);
  }
  if (trueFalse > maxLimits.trueFalse) {
    errors.push(`Đúng/Sai: Tối đa ${maxLimits.trueFalse} câu (hiện tại: ${trueFalse})`);
  }
  if (shortAnswer > maxLimits.shortAnswer) {
    errors.push(`Trả lời ngắn: Tối đa ${maxLimits.shortAnswer} câu (hiện tại: ${shortAnswer})`);
  }

  // Check for negative values
  if (abcd < 0 || trueFalse < 0 || shortAnswer < 0) {
    errors.push('Số câu hỏi không được âm');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate total score from all question types
 *
 * @param {Object} scores - Score breakdown by type
 * @returns {number} Total score (rounded to 2 decimal places)
 */
export function calculateTotalScore(scores) {
  const {
    abcd = { points: 0 },
    trueFalse = { points: 0 },
    shortAnswer = { points: 0 }
  } = scores;

  const total =
    (abcd.points || 0) +
    (trueFalse.points || 0) +
    (shortAnswer.points || 0);

  // Round to 2 decimal places
  return Math.round(total * 100) / 100;
}

/**
 * Format points for display (2 decimal places)
 *
 * @param {number} points - Points value
 * @returns {string} Formatted points string
 */
export function formatPoints(points) {
  if (typeof points !== 'number' || isNaN(points)) {
    return '0.00';
  }
  return points.toFixed(2);
}

/**
 * Get question type limits and defaults
 *
 * @returns {Object} Configuration for each question type
 */
export function getQuestionTypeConfig() {
  return {
    abcd: {
      maxCount: 12,
      basePoints: 0.25,
      label: 'Trắc nghiệm ABCD',
      shortLabel: 'ABCD'
    },
    trueFalse: {
      maxCount: 4,
      basePoints: 1.0,
      subItemsPerQuestion: 4,
      label: 'Đúng/Sai',
      shortLabel: 'Đ/S'
    },
    shortAnswer: {
      maxCount: 6,
      basePoints: 0.5,
      label: 'Trả lời ngắn',
      shortLabel: 'TLN'
    }
  };
}
