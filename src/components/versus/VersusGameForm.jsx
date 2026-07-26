import { useState, useEffect } from 'react';
import { createVersusGame, updateVersusGame } from '../../services/versusGameService';
import { getVersusSettings, DEFAULT_VERSUS_SETTINGS } from '../../services/versusSettingsService';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Toast from '../common/Toast';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

const QUESTION_TYPE_LABELS = {
    abcd: '🅰️ Trắc nghiệm A-B-C-D',
    true_false: '✅ Đúng / Sai',
    short_answer: '✍️ Trả lời ngắn'
};

const makeAbcdQuestion = () => ({
    questionText: '',
    questionImage: '',
    answers: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
    ]
});

const makeTrueFalseQuestion = () => ({
    type: 'true_false',
    questionText: '',
    statements: [{ text: '', isTrue: true }]
});

const makeShortAnswerQuestion = () => ({
    type: 'short_answer',
    questionText: '',
    correctAnswer: '',
    alternativeAnswers: []
});

/**
 * Parse text dán nhanh nhiều câu abcd.
 * Mẫu mỗi câu (cách nhau dòng trống):
 *   Câu: Nội dung
 *   A. Đáp án 1 ... D. Đáp án 4
 *   Đáp án: B
 * Chấp nhận "Câu 1:", "Cau:", "A)", "a." linh hoạt.
 * @returns {{ questions: Array, errors: string[] }}
 */
const parseQuickQuestions = (text) => {
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
            } else {
                // Nối tiếp đáp án cuối (đáp án xuống dòng)
                if (answers.length > 0) {
                    answers[answers.length - 1].text += ` ${line}`;
                }
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

/**
 * Form tạo / sửa bài Đấu Trí 1v1.
 * @param {Object|null} game - null = tạo mới, khác null = sửa (cần game.id)
 * @param {Function} onSaved - gọi sau khi lưu thành công
 * @param {Function} onCancel - gọi khi bấm Hủy
 */
export default function VersusGameForm({ game = null, onSaved, onCancel }) {
    const isEdit = !!game;

    const [title, setTitle] = useState(game?.title || '');
    const [winSteps, setWinSteps] = useState(game?.winSteps ?? DEFAULT_VERSUS_SETTINGS.defaultWinSteps);
    const [freezeDuration, setFreezeDuration] = useState(game?.freezeDuration ?? 3);
    const [shuffleAnswers, setShuffleAnswers] = useState(game?.shuffleAnswers ?? true);
    const [maxMatches, setMaxMatches] = useState(game?.maxMatches ?? 20);
    const [questions, setQuestions] = useState(game?.questions ? game.questions.map(q => ({ ...q })) : []);

    const [showTypePicker, setShowTypePicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Dán nhanh
    const [showQuickPaste, setShowQuickPaste] = useState(false);
    const [quickText, setQuickText] = useState('');
    const [quickResult, setQuickResult] = useState(null); // { questions, errors }

    // Lấy default từ settings khi tạo mới
    useEffect(() => {
        if (isEdit) return;
        getVersusSettings()
            .then(s => {
                setWinSteps(s.defaultWinSteps ?? 10);
                setFreezeDuration(s.defaultFreezeDuration ?? 3);
                setMaxMatches(s.maxMatchesPerRoom ?? 20);
            })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== Thao tác danh sách câu hỏi =====

    const addQuestion = (type) => {
        setShowTypePicker(false);
        const q = type === 'true_false' ? makeTrueFalseQuestion()
            : type === 'short_answer' ? makeShortAnswerQuestion()
                : makeAbcdQuestion();
        setQuestions(prev => [...prev, q]);
    };

    const updateQuestion = (index, updates) => {
        setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...updates } : q));
    };

    const removeQuestion = (index) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    };

    const moveQuestion = (index, dir) => {
        setQuestions(prev => {
            const target = index + dir;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    // abcd helpers
    const updateAnswer = (qIndex, aIndex, text) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, answers: q.answers.map((a, j) => j === aIndex ? { ...a, text } : a) }
            : q
        ));
    };

    const setCorrectAnswer = (qIndex, aIndex) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, answers: q.answers.map((a, j) => ({ ...a, isCorrect: j === aIndex })) }
            : q
        ));
    };

    // true_false helpers
    const updateStatement = (qIndex, sIndex, updates) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, statements: q.statements.map((s, j) => j === sIndex ? { ...s, ...updates } : s) }
            : q
        ));
    };

    const addStatement = (qIndex) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, statements: [...q.statements, { text: '', isTrue: true }] }
            : q
        ));
    };

    const removeStatement = (qIndex, sIndex) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, statements: q.statements.filter((_, j) => j !== sIndex) }
            : q
        ));
    };

    // short_answer helpers
    const updateAltAnswer = (qIndex, aIndex, text) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, alternativeAnswers: q.alternativeAnswers.map((a, j) => j === aIndex ? text : a) }
            : q
        ));
    };

    const addAltAnswer = (qIndex) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, alternativeAnswers: [...(q.alternativeAnswers || []), ''] }
            : q
        ));
    };

    const removeAltAnswer = (qIndex, aIndex) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex
            ? { ...q, alternativeAnswers: q.alternativeAnswers.filter((_, j) => j !== aIndex) }
            : q
        ));
    };

    // ===== Dán nhanh =====

    const handleQuickParse = () => {
        setQuickResult(parseQuickQuestions(quickText));
    };

    const handleQuickAdd = () => {
        if (!quickResult || quickResult.questions.length === 0) return;
        setQuestions(prev => [...prev, ...quickResult.questions]);
        setToast({ type: 'success', message: `Đã thêm ${quickResult.questions.length} câu vào danh sách!` });
        setQuickText('');
        setQuickResult(null);
        setShowQuickPaste(false);
    };

    // ===== Validate & Lưu =====

    const validate = () => {
        if (!title.trim()) return 'Vui lòng nhập tên bài đấu';
        if (questions.length === 0) return 'Cần ít nhất 1 câu hỏi';

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const label = `Câu ${i + 1}`;
            if (!q.questionText?.trim()) return `${label}: chưa nhập nội dung câu hỏi`;

            const type = q.type || 'abcd';
            if (type === 'abcd') {
                if (!q.answers || q.answers.length !== 4) return `${label}: cần đủ 4 đáp án`;
                if (q.answers.some(a => !a.text?.trim())) return `${label}: đáp án không được để trống`;
                if (q.answers.filter(a => a.isCorrect).length !== 1) return `${label}: phải có đúng 1 đáp án đúng`;
            } else if (type === 'true_false') {
                if (!q.statements || q.statements.length === 0) return `${label}: cần ít nhất 1 mệnh đề`;
                if (q.statements.some(s => !s.text?.trim())) return `${label}: mệnh đề không được để trống`;
            } else if (type === 'short_answer') {
                if (!q.correctAnswer?.trim()) return `${label}: chưa nhập đáp án đúng`;
            }
        }
        return null;
    };

    const handleSave = async () => {
        const error = validate();
        if (error) {
            setToast({ type: 'error', message: error });
            return;
        }

        // Chuẩn hóa dữ liệu trước khi lưu
        const cleanQuestions = questions.map(q => {
            const type = q.type || 'abcd';
            if (type === 'true_false') {
                return {
                    type: 'true_false',
                    questionText: q.questionText.trim(),
                    statements: q.statements.map(s => ({ text: s.text.trim(), isTrue: !!s.isTrue }))
                };
            }
            if (type === 'short_answer') {
                return {
                    type: 'short_answer',
                    questionText: q.questionText.trim(),
                    correctAnswer: q.correctAnswer.trim(),
                    alternativeAnswers: (q.alternativeAnswers || []).map(a => a.trim()).filter(Boolean)
                };
            }
            const cleaned = {
                questionText: q.questionText.trim(),
                answers: q.answers.map(a => ({ text: a.text.trim(), isCorrect: !!a.isCorrect }))
            };
            if (q.questionImage?.trim()) cleaned.questionImage = q.questionImage.trim();
            return cleaned;
        });

        const data = {
            title: title.trim(),
            winSteps: Math.max(1, Number(winSteps) || 10),
            freezeDuration: Math.max(0, Number(freezeDuration) || 3),
            shuffleAnswers: !!shuffleAnswers,
            maxMatches: Math.max(1, Number(maxMatches) || 20),
            questions: cleanQuestions
        };

        try {
            setSaving(true);
            if (isEdit) {
                await updateVersusGame(game.id, data);
            } else {
                await createVersusGame(data);
            }
            onSaved?.();
        } catch (err) {
            setToast({ type: 'error', message: 'Lỗi khi lưu bài đấu: ' + err.message });
            setSaving(false);
        }
    };

    // ===== Render từng loại câu hỏi =====

    const renderAbcd = (q, qIndex) => (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>4 đáp án (chọn đáp án đúng)</label>
                <div className="space-y-2">
                    {q.answers.map((a, aIndex) => (
                        <div key={aIndex} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={a.isCorrect}
                                onChange={() => setCorrectAnswer(qIndex, aIndex)}
                                className="w-4 h-4 text-green-600 shrink-0"
                                title="Đáp án đúng"
                            />
                            <span className="w-6 font-bold text-gray-500 dark:text-gray-400 shrink-0">
                                {String.fromCharCode(65 + aIndex)}.
                            </span>
                            <input
                                type="text"
                                className={`${inputCls} ${a.isCorrect ? 'ring-2 ring-green-400 dark:ring-green-600' : ''}`}
                                placeholder={`Đáp án ${String.fromCharCode(65 + aIndex)}`}
                                value={a.text}
                                onChange={e => updateAnswer(qIndex, aIndex, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTrueFalse = (q, qIndex) => (
        <div>
            <label className={labelCls}>Các mệnh đề (bật/tắt Đúng-Sai)</label>
            <div className="space-y-2">
                {q.statements.map((s, sIndex) => (
                    <div key={sIndex} className="flex items-center gap-2">
                        <input
                            type="text"
                            className={inputCls}
                            placeholder={`Mệnh đề ${sIndex + 1}`}
                            value={s.text}
                            onChange={e => updateStatement(qIndex, sIndex, { text: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => updateStatement(qIndex, sIndex, { isTrue: !s.isTrue })}
                            className={`shrink-0 px-3 py-2 rounded-lg font-bold text-sm transition-colors ${s.isTrue
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                }`}
                        >
                            {s.isTrue ? '✓ Đúng' : '✗ Sai'}
                        </button>
                        <button
                            type="button"
                            onClick={() => removeStatement(qIndex, sIndex)}
                            disabled={q.statements.length <= 1}
                            className="shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-30"
                            title="Xóa mệnh đề"
                        >
                            <Icon name="delete" size={18} />
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={() => addStatement(qIndex)}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
                <Icon name="add" size={16} /> Thêm mệnh đề
            </button>
        </div>
    );

    const renderShortAnswer = (q, qIndex) => (
        <div className="space-y-3">
            <div>
                <label className={labelCls}>Đáp án đúng *</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="VD: Hà Nội"
                    value={q.correctAnswer}
                    onChange={e => updateQuestion(qIndex, { correctAnswer: e.target.value })}
                />
            </div>
            <div>
                <label className={labelCls}>Đáp án thay thế (chấp nhận thêm, không bắt buộc)</label>
                <div className="space-y-2">
                    {(q.alternativeAnswers || []).map((alt, aIndex) => (
                        <div key={aIndex} className="flex items-center gap-2">
                            <input
                                type="text"
                                className={inputCls}
                                placeholder={`Đáp án thay thế ${aIndex + 1}`}
                                value={alt}
                                onChange={e => updateAltAnswer(qIndex, aIndex, e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeAltAnswer(qIndex, aIndex)}
                                className="shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                title="Xóa"
                            >
                                <Icon name="delete" size={18} />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => addAltAnswer(qIndex)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                    <Icon name="add" size={16} /> Thêm đáp án thay thế
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Thông tin chung */}
            <div className="clay-card p-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
                    {isEdit ? '✏️ Sửa bài đấu' : '⚔️ Tạo bài đấu mới'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Tên bài đấu *</label>
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="VD: Đấu trí Tin học 8 - Bài 3"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className={labelCls}>Số bước để thắng</label>
                            <input type="number" min="1" className={inputCls} value={winSteps}
                                onChange={e => setWinSteps(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Đóng băng khi sai (giây)</label>
                            <input type="number" min="0" className={inputCls} value={freezeDuration}
                                onChange={e => setFreezeDuration(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Số trận tối đa</label>
                            <input type="number" min="1" className={inputCls} value={maxMatches}
                                onChange={e => setMaxMatches(e.target.value)} />
                        </div>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={shuffleAnswers}
                                    onChange={e => setShuffleAnswers(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Xáo trộn đáp án
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dán nhanh */}
            <div className="clay-card p-6">
                <button
                    type="button"
                    onClick={() => setShowQuickPaste(v => !v)}
                    className="w-full flex items-center justify-between font-bold text-lg text-gray-900 dark:text-white"
                >
                    <span className="flex items-center gap-2">
                        <Icon name="content_paste" size={22} /> Dán nhanh câu hỏi trắc nghiệm
                    </span>
                    <Icon name={showQuickPaste ? 'expand_less' : 'expand_more'} size={24} />
                </button>

                {showQuickPaste && (
                    <div className="mt-4 space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Dán nhiều câu ABCD theo mẫu, các câu cách nhau <b>dòng trống</b>:
                        </p>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg p-3 overflow-x-auto">
{`Câu: Nội dung câu hỏi
A. Đáp án 1
B. Đáp án 2
C. Đáp án 3
D. Đáp án 4
Đáp án: B`}
                        </pre>
                        <textarea
                            rows={8}
                            className={`${inputCls} font-mono text-sm`}
                            placeholder="Dán nội dung câu hỏi vào đây..."
                            value={quickText}
                            onChange={e => { setQuickText(e.target.value); setQuickResult(null); }}
                        />
                        <div className="flex gap-3 flex-wrap">
                            <Button variant="secondary" size="sm" icon="manage_search" onClick={handleQuickParse} disabled={!quickText.trim()}>
                                Đọc thử
                            </Button>
                            {quickResult && quickResult.questions.length > 0 && (
                                <Button size="sm" icon="playlist_add" onClick={handleQuickAdd}>
                                    Thêm {quickResult.questions.length} câu vào danh sách
                                </Button>
                            )}
                        </div>
                        {quickResult && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    ✅ Đọc được {quickResult.questions.length} câu hợp lệ
                                </p>
                                {quickResult.errors.length > 0 && (
                                    <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                        {quickResult.errors.map((err, i) => (
                                            <p key={i}>⚠️ {err}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Danh sách câu hỏi */}
            <div className="clay-card p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        📝 Danh sách câu hỏi ({questions.length})
                    </h3>
                    <div className="relative">
                        <Button size="sm" icon="add" onClick={() => setShowTypePicker(v => !v)}>
                            Thêm câu hỏi
                        </Button>
                        {showTypePicker && (
                            <div className="absolute right-0 top-full mt-2 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[240px] animate-scale-in">
                                {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => addQuestion(type)}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {questions.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-6">
                        Chưa có câu hỏi nào. Bấm "Thêm câu hỏi" hoặc dùng "Dán nhanh" ở trên.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q, qIndex) => {
                            const type = q.type || 'abcd';
                            return (
                                <div key={qIndex} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-3 gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            Câu {qIndex + 1}
                                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                                {QUESTION_TYPE_LABELS[type]}
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => moveQuestion(qIndex, -1)}
                                                disabled={qIndex === 0}
                                                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"
                                                title="Di chuyển lên"
                                            >
                                                <Icon name="arrow_upward" size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveQuestion(qIndex, 1)}
                                                disabled={qIndex === questions.length - 1}
                                                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-30"
                                                title="Di chuyển xuống"
                                            >
                                                <Icon name="arrow_downward" size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeQuestion(qIndex)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                                title="Xóa câu hỏi"
                                            >
                                                <Icon name="delete" size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className={labelCls}>Nội dung câu hỏi *</label>
                                        <textarea
                                            rows={2}
                                            className={inputCls}
                                            placeholder="Nhập nội dung câu hỏi..."
                                            value={q.questionText}
                                            onChange={e => updateQuestion(qIndex, { questionText: e.target.value })}
                                        />
                                    </div>

                                    {type === 'abcd' && renderAbcd(q, qIndex)}
                                    {type === 'true_false' && renderTrueFalse(q, qIndex)}
                                    {type === 'short_answer' && renderShortAnswer(q, qIndex)}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Nút hành động */}
            <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={onCancel} disabled={saving}>
                    Hủy
                </Button>
                <Button icon="save" loading={saving} onClick={handleSave}>
                    {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật bài đấu' : 'Tạo bài đấu')}
                </Button>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
