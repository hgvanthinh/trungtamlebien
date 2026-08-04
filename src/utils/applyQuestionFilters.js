/**
 * Lọc câu hỏi trong kho theo bộ filter hiện tại.
 * @param {Array} questions - Danh sách câu hỏi
 * @param {Object} filters - { search, type, grade, difficulty }
 * @returns {Array} - Danh sách đã lọc
 */
export const applyQuestionFilters = (questions, filters) => {
    const keyword = (filters.search || '').trim().toLowerCase();

    return questions.filter(q => {
        if (filters.type && (q.type || 'abcd') !== filters.type) return false;
        if (filters.grade && String(q.grade ?? '') !== String(filters.grade)) return false;
        if (filters.difficulty && (q.difficulty || 'medium') !== filters.difficulty) return false;

        if (keyword) {
            const haystack = [
                q.questionText,
                q.correctAnswer,
                ...(q.answers || []).map(a => a.text),
                ...(q.statements || []).map(s => s.text),
                ...(q.alternativeAnswers || [])
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(keyword)) return false;
        }
        return true;
    });
};

export default applyQuestionFilters;
