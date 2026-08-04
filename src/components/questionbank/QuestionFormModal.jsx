import { useState, useRef } from 'react';
import { prepareQuestionImage, uploadQuestionImage } from '../../services/storageService';
import {
    QUESTION_TYPES,
    DIFFICULTIES,
    GRADES,
    validateQuestion,
    createQuestion,
    updateQuestion
} from '../../services/questionBankService';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Toast from '../common/Toast';
import { MathEditor } from '../math';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

const makeEmpty = (type, inputMode = 'text') => {
    const base = { questionText: '', questionImage: '', inputMode };

    if (type === 'true_false') {
        // Dạng ảnh: đề thi thường có 4 ý a) b) c) d), tạo sẵn cho GV chỉ việc tick
        const count = inputMode === 'image' ? 4 : 1;
        return {
            ...base,
            type: 'true_false',
            statements: Array.from({ length: count }, () => ({ text: '', isTrue: true }))
        };
    }
    if (type === 'short_answer') {
        return { ...base, type: 'short_answer', correctAnswer: '', alternativeAnswers: [] };
    }
    return {
        ...base,
        type: 'abcd',
        answers: [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
        ]
    };
};

/**
 * Modal soạn / sửa một câu hỏi trong kho.
 * @param {Object|null} question - null = tạo mới, khác null = sửa (cần question.id)
 * @param {string} defaultType - Loại câu hỏi mặc định khi tạo mới
 * @param {string} defaultInputMode - 'text' (gõ tay) hoặc 'image' (tải ảnh đề)
 * @param {Object} defaults - Metadata mặc định { grade, difficulty }
 * @param {string} createdBy - uid người tạo
 * @param {Function} onSaved - gọi sau khi lưu thành công
 * @param {Function} onClose - gọi khi đóng modal
 */
export default function QuestionFormModal({
    question = null,
    defaultType = 'abcd',
    defaultInputMode = 'text',
    defaults = {},
    createdBy = null,
    onSaved,
    onClose
}) {
    const isEdit = !!question?.id;

    const [form, setForm] = useState(() => {
        if (question) {
            const mode = question.inputMode || (question.questionImage && !question.questionText ? 'image' : 'text');
            return { ...makeEmpty(question.type || 'abcd', mode), ...question, inputMode: mode };
        }
        return {
            ...makeEmpty(defaultType, defaultInputMode),
            grade: defaults.grade ?? null,
            difficulty: defaults.difficulty || 'medium'
        };
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Có ảnh mới chọn đang chờ upload hay không (dùng để render, blob nằm ở ref)
    const [hasPendingImage, setHasPendingImage] = useState(false);
    const [toast, setToast] = useState(null);
    const fileInputRef = useRef(null);
    // Blob ảnh đã nén, đang chờ upload khi bấm lưu (null = không đổi ảnh)
    const pendingBlobRef = useRef(null);

    const patch = (updates) => setForm(prev => ({ ...prev, ...updates }));

    const isImageMode = form.inputMode === 'image';

    // Đổi loại câu hỏi: giữ lại nội dung + ảnh + metadata, reset phần đáp án
    const changeType = (type) => {
        setForm(prev => ({
            ...makeEmpty(type, prev.inputMode),
            questionText: prev.questionText,
            questionImage: prev.questionImage,
            grade: prev.grade,
            difficulty: prev.difficulty
        }));
    };

    // Đổi chế độ nhập: giữ nguyên loại câu, ảnh và metadata
    const changeInputMode = (mode) => {
        setForm(prev => {
            if (prev.inputMode === mode) return prev;
            return {
                ...makeEmpty(prev.type || 'abcd', mode),
                questionText: prev.questionText,
                questionImage: prev.questionImage,
                    grade: prev.grade,
                difficulty: prev.difficulty
            };
        });
    };

    // ===== Ảnh đề =====
    // Ảnh chỉ được nén và xem trước tại máy; chỉ upload lên Storage khi bấm lưu.
    // Nhờ vậy đổi ảnh liên tục hay tắt máy giữa chừng đều không để lại rác.

    /** Thu hồi blob: URL cục bộ để giải phóng bộ nhớ */
    const revokePreview = (url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };

    const handlePickImage = async (file) => {
        if (!file) return;
        setUploading(true);
        const result = await prepareQuestionImage(file);
        setUploading(false);

        if (result.success) {
            revokePreview(form.questionImage);
            pendingBlobRef.current = result.blob;
            setHasPendingImage(true);
            patch({ questionImage: result.previewUrl });
            setToast({
                type: 'success',
                message: `Đã chọn ảnh (${Math.round(result.size / 1024)}KB) — bấm lưu để tải lên`
            });
        } else {
            setToast({ type: 'error', message: result.error });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveImage = () => {
        revokePreview(form.questionImage);
        pendingBlobRef.current = null;
        setHasPendingImage(false);
        patch({ questionImage: '' });
    };

    const handleClose = () => {
        revokePreview(form.questionImage);
        pendingBlobRef.current = null;
        onClose?.();
    };

    // Dán ảnh trực tiếp từ clipboard (Ctrl+V sau khi cắt màn hình)
    const handlePaste = (e) => {
        const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
        if (!item) return;
        e.preventDefault();
        handlePickImage(item.getAsFile());
    };

    // ===== abcd =====
    const updateAnswer = (index, text) => {
        setForm(prev => ({
            ...prev,
            answers: prev.answers.map((a, i) => i === index ? { ...a, text } : a)
        }));
    };

    const setCorrectAnswer = (index) => {
        setForm(prev => ({
            ...prev,
            answers: prev.answers.map((a, i) => ({ ...a, isCorrect: i === index }))
        }));
    };

    // ===== true_false =====
    const updateStatement = (index, updates) => {
        setForm(prev => ({
            ...prev,
            statements: prev.statements.map((s, i) => i === index ? { ...s, ...updates } : s)
        }));
    };

    const addStatement = () => {
        setForm(prev => ({ ...prev, statements: [...prev.statements, { text: '', isTrue: true }] }));
    };

    const removeStatement = (index) => {
        setForm(prev => ({ ...prev, statements: prev.statements.filter((_, i) => i !== index) }));
    };

    // ===== short_answer =====
    const updateAlt = (index, text) => {
        setForm(prev => ({
            ...prev,
            alternativeAnswers: prev.alternativeAnswers.map((a, i) => i === index ? text : a)
        }));
    };

    const addAlt = () => {
        setForm(prev => ({ ...prev, alternativeAnswers: [...(prev.alternativeAnswers || []), ''] }));
    };

    const removeAlt = (index) => {
        setForm(prev => ({
            ...prev,
            alternativeAnswers: prev.alternativeAnswers.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        const error = validateQuestion(form);
        if (error) {
            setToast({ type: 'error', message: error });
            return;
        }

        try {
            setSaving(true);

            // Ảnh mới chọn giờ mới thực sự lên Storage
            let payload = form;
            if (pendingBlobRef.current) {
                const uploaded = await uploadQuestionImage(pendingBlobRef.current);
                if (!uploaded.success) {
                    setToast({ type: 'error', message: uploaded.error });
                    setSaving(false);
                    return;
                }
                revokePreview(form.questionImage);
                payload = { ...form, questionImage: uploaded.url };
                // Ảnh đã lên Storage, đổi preview sang URL thật để lỡ lưu hụt còn dùng lại
                pendingBlobRef.current = null;
                setHasPendingImage(false);
                patch({ questionImage: uploaded.url });
            }

            if (isEdit) {
                await updateQuestion(question.id, payload);
            } else {
                await createQuestion(payload, createdBy);
            }
            onSaved?.(isEdit ? 'Đã cập nhật câu hỏi!' : 'Đã thêm câu hỏi vào kho!');
        } catch (err) {
            setToast({ type: 'error', message: 'Lỗi khi lưu câu hỏi: ' + err.message });
            setSaving(false);
        }
    };

    const type = form.type || 'abcd';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {isEdit ? '✏️ Sửa câu hỏi' : '➕ Thêm câu hỏi vào kho'}
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" onPaste={handlePaste}>
                    {/* Chế độ nhập */}
                    <div>
                        <label className={labelCls}>Cách nhập đề</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => changeInputMode('text')}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${!isImageMode
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                ⌨️ Gõ nội dung
                            </button>
                            <button
                                type="button"
                                onClick={() => changeInputMode('image')}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${isImageMode
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                🖼️ Tải ảnh đề
                            </button>
                        </div>
                        {isImageMode && (
                            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                Đề nằm trong ảnh — bạn chỉ cần chọn dạng câu và tick đáp án đúng.
                            </p>
                        )}
                    </div>

                    {/* Loại câu hỏi */}
                    <div>
                        <label className={labelCls}>Loại câu hỏi</label>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(QUESTION_TYPES).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => changeType(value)}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${type === value
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Khối lớp</label>
                            <select
                                className={inputCls}
                                value={form.grade ?? ''}
                                onChange={e => patch({ grade: e.target.value ? Number(e.target.value) : null })}
                            >
                                <option value="">— Chưa chọn —</option>
                                {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Độ khó</label>
                            <select
                                className={inputCls}
                                value={form.difficulty || 'medium'}
                                onChange={e => patch({ difficulty: e.target.value })}
                            >
                                {Object.entries(DIFFICULTIES).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Nội dung câu hỏi */}
                    {isImageMode ? (
                        <div>
                            <label className={labelCls}>Ảnh câu hỏi *</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => handlePickImage(e.target.files?.[0])}
                            />

                            {form.questionImage ? (
                                <div className="space-y-2">
                                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-2 overflow-x-auto">
                                        <img
                                            src={form.questionImage}
                                            alt="Ảnh câu hỏi"
                                            className="max-h-72 mx-auto rounded-lg"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon="swap_horiz"
                                            loading={uploading}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            Đổi ảnh khác
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon="delete"
                                            onClick={handleRemoveImage}
                                            className="text-red-600 dark:text-red-400"
                                        >
                                            Xóa ảnh
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full py-10 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 disabled:opacity-60"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                                            <span className="text-sm font-semibold">Đang xử lý ảnh...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="add_photo_alternate" className="text-4xl" />
                                            <span className="text-sm font-semibold">Bấm để chọn ảnh câu hỏi</span>
                                            <span className="text-xs">hoặc cắt màn hình rồi dán trực tiếp (Ctrl+V)</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <div className="mt-3">
                                <label className={labelCls}>Ghi chú / mã câu hỏi (không bắt buộc)</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="VD: Câu 5 - Đề ôn tập chương 1"
                                    value={form.questionText}
                                    onChange={e => patch({ questionText: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className={labelCls}>Nội dung câu hỏi *</label>
                            <MathEditor
                                value={form.questionText}
                                onChange={v => patch({ questionText: v })}
                                placeholder="VD: Cho hàm số $y=f(x)$ có đồ thị như hình. Mệnh đề nào đúng?"
                                rows={3}
                                variant="outlined"
                                size="medium"
                                showPreview
                            />
                        </div>
                    )}

                    {/* abcd */}
                    {type === 'abcd' && (
                        isImageMode ? (
                            <div>
                                <label className={labelCls}>Đáp án đúng *</label>
                                <div className="flex flex-wrap gap-2">
                                    {form.answers.map((a, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setCorrectAnswer(i)}
                                            className={`w-14 h-14 rounded-xl font-bold text-lg transition-all ${a.isCorrect
                                                ? 'bg-green-500 text-white shadow-lg scale-105'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {String.fromCharCode(65 + i)}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    Bấm chọn phương án đúng của câu trong ảnh.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className={labelCls}>4 đáp án (chọn đáp án đúng)</label>
                                    <div className="space-y-2">
                                        {form.answers.map((a, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <input
                                                    type="radio"
                                                    name="correct-answer"
                                                    checked={a.isCorrect}
                                                    onChange={() => setCorrectAnswer(i)}
                                                    className="w-4 h-4 mt-10 text-green-600 shrink-0"
                                                    title="Đáp án đúng"
                                                />
                                                <span className="w-6 mt-9 font-bold text-gray-500 dark:text-gray-400 shrink-0">
                                                    {String.fromCharCode(65 + i)}.
                                                </span>
                                                <div className={`flex-1 min-w-0 rounded-lg ${a.isCorrect ? 'ring-2 ring-green-400 dark:ring-green-600 p-1' : ''}`}>
                                                    <MathEditor
                                                        value={a.text}
                                                        onChange={v => updateAnswer(i, v)}
                                                        placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                                                        rows={1}
                                                        variant="outlined"
                                                        size="small"
                                                        showPreview
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Ảnh minh họa (URL, không bắt buộc)</label>
                                    <input
                                        type="text"
                                        className={inputCls}
                                        placeholder="https://..."
                                        value={form.questionImage || ''}
                                        onChange={e => patch({ questionImage: e.target.value })}
                                    />
                                </div>
                            </>
                        )
                    )}

                    {/* true_false - dạng ảnh: chỉ tick Đúng/Sai cho từng ý */}
                    {type === 'true_false' && isImageMode && (
                        <div>
                            <label className={labelCls}>Đáp án từng ý *</label>
                            <div className="space-y-2">
                                {form.statements.map((s, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="w-8 font-bold text-gray-700 dark:text-gray-300 shrink-0">
                                            {String.fromCharCode(97 + i)})
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateStatement(i, { isTrue: true })}
                                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${s.isTrue
                                                    ? 'bg-green-500 text-white shadow'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                ✓ Đúng
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateStatement(i, { isTrue: false })}
                                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!s.isTrue
                                                    ? 'bg-red-500 text-white shadow'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                ✗ Sai
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeStatement(i)}
                                            disabled={form.statements.length <= 1}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-30"
                                            title="Xóa ý"
                                        >
                                            <Icon name="delete" size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={addStatement}
                                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <Icon name="add" size={16} /> Thêm ý
                            </button>
                            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                Tick Đúng/Sai cho từng ý a), b), c), d) theo đề trong ảnh.
                            </p>
                        </div>
                    )}

                    {/* true_false - dạng gõ tay */}
                    {type === 'true_false' && !isImageMode && (
                        <div>
                            <label className={labelCls}>Các mệnh đề (bật/tắt Đúng-Sai)</label>
                            <div className="space-y-2">
                                {form.statements.map((s, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <MathEditor
                                                value={s.text}
                                                onChange={v => updateStatement(i, { text: v })}
                                                placeholder={`Mệnh đề ${i + 1}`}
                                                rows={1}
                                                variant="outlined"
                                                size="small"
                                                showPreview
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => updateStatement(i, { isTrue: !s.isTrue })}
                                            className={`shrink-0 mt-9 px-3 py-2 rounded-lg font-bold text-sm transition-colors ${s.isTrue
                                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                                }`}
                                        >
                                            {s.isTrue ? '✓ Đúng' : '✗ Sai'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeStatement(i)}
                                            disabled={form.statements.length <= 1}
                                            className="shrink-0 mt-9 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-30"
                                            title="Xóa mệnh đề"
                                        >
                                            <Icon name="delete" size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={addStatement}
                                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <Icon name="add" size={16} /> Thêm mệnh đề
                            </button>
                        </div>
                    )}

                    {/* short_answer */}
                    {type === 'short_answer' && (
                        <>
                            <div>
                                <label className={labelCls}>Đáp án đúng *</label>
                                <MathEditor
                                    value={form.correctAnswer}
                                    onChange={v => patch({ correctAnswer: v })}
                                    placeholder="VD: Hà Nội"
                                    rows={1}
                                    variant="outlined"
                                    size="small"
                                    showPreview
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Đáp án thay thế (không bắt buộc)</label>
                                <div className="space-y-2">
                                    {(form.alternativeAnswers || []).map((alt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                className={inputCls}
                                                placeholder={`Đáp án thay thế ${i + 1}`}
                                                value={alt}
                                                onChange={e => updateAlt(i, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeAlt(i)}
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
                                    onClick={addAlt}
                                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <Icon name="add" size={16} /> Thêm đáp án thay thế
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={handleClose} disabled={saving}>
                        Hủy
                    </Button>
                    <Button icon="save" loading={saving} onClick={handleSave} disabled={saving || uploading}>
                        {saving
                            ? (hasPendingImage ? 'Đang tải ảnh lên...' : 'Đang lưu...')
                            : (isEdit ? 'Cập nhật' : 'Thêm vào kho')}
                    </Button>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
