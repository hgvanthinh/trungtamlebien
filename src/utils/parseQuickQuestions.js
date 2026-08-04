/**
 * Parse text dán nhanh nhiều câu trắc nghiệm ABCD.
 * Mẫu mỗi câu (cách nhau dòng trống):
 *   Câu: Nội dung
 *   A. Đáp án 1 ... D. Đáp án 4
 *   Đáp án: B
 * Chấp nhận "Câu 1:", "Cau:", "A)", "a." linh hoạt.
 *
 * @param {string} text - Nội dung dán vào
 * @returns {{ questions: Array, errors: string[] }}
 */
export const parseQuickQuestions = (text) => {
    const lines = (text || '').split(/\r?\n/);

    // Gom block theo dòng trống, nhớ số dòng bắt đầu (1-based)
    const blocks = [];
    let current = null;
    lines.forEach((raw, i) => {
        if (raw.trim() === '') {
            current = null;
            return;
        }
        if (!current) {
            current = { startLine: i + 1, lines: [] };
            blocks.push(current);
        }
        current.lines.push({ lineNo: i + 1, text: raw.trim() });
    });

    const questions = [];
    const errors = [];

    blocks.forEach((block, bIdx) => {
        let questionText = '';
        const answers = []; // { letter, text }
        let correctLetter = null;
        let blockError = null;

        for (const { lineNo, text: line } of block.lines) {
            // "Đáp án: B" / "Dap an B"
            const correctMatch = line.match(/^[đd][áa]p\s*[áa]n\s*[:.\s]\s*([A-Da-d])\s*\.?$/i)
                || line.match(/^[đd][áa]p\s*[áa]n\s*[:.\s]*([A-Da-d])\s*$/i);
            if (correctMatch) {
                correctLetter = correctMatch[1].toUpperCase();
                continue;
            }
            // "A. xxx" / "B) xxx" / "c: xxx"
            const answerMatch = line.match(/^([A-Da-d])\s*[.):]\s*(.+)$/);
            if (answerMatch) {
                answers.push({ letter: answerMatch[1].toUpperCase(), text: answerMatch[2].trim() });
                continue;
            }
            // "Câu: xxx" / "Câu 1: xxx" / "Cau 12. xxx"
            const questionMatch = line.match(/^c[âa]u\s*\d*\s*[:.]\s*(.+)$/i);
            if (questionMatch) {
                if (questionText) {
                    blockError = `Dòng ${lineNo}: block có 2 dòng "Câu:" — thiếu dòng trống ngăn cách giữa 2 câu?`;
                    break;
                }
                questionText = questionMatch[1].trim();
                continue;
            }
            // Dòng thường: nối tiếp nội dung câu hỏi (câu nhiều dòng)
            if (answers.length === 0 && correctLetter === null) {
                questionText = questionText ? `${questionText}\n${line}` : line;
            } else if (answers.length > 0) {
                // Nối tiếp đáp án cuối (đáp án xuống dòng)
                answers[answers.length - 1].text += ` ${line}`;
            }
        }

        const blockLabel = `Câu #${bIdx + 1} (dòng ${block.startLine})`;
        if (blockError) {
            errors.push(`${blockLabel}: ${blockError}`);
            return;
        }
        if (!questionText) {
            errors.push(`${blockLabel}: không tìm thấy nội dung câu hỏi (dòng "Câu: ...")`);
            return;
        }
        if (answers.length !== 4) {
            errors.push(`${blockLabel}: cần đúng 4 đáp án A-D, đọc được ${answers.length}`);
            return;
        }
        if (!correctLetter) {
            errors.push(`${blockLabel}: thiếu dòng "Đáp án: X"`);
            return;
        }
        if (!answers.some(a => a.letter === correctLetter)) {
            errors.push(`${blockLabel}: đáp án đúng "${correctLetter}" không khớp đáp án nào`);
            return;
        }

        questions.push({
            questionText,
            questionImage: '',
            answers: answers.map(a => ({ text: a.text, isCorrect: a.letter === correctLetter }))
        });
    });

    return { questions, errors };
};

export default parseQuickQuestions;
