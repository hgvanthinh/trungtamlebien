import { useState } from 'react';
import {
    DIFFICULTIES,
    GRADES,
    createQuestionsBatch
} from '../../services/questionBankService';
import { parseQuickQuestions } from '../../utils/parseQuickQuestions';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Toast from '../common/Toast';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

const SAMPLE = `Câu: Nội dung câu hỏi
A. Đáp án 1
B. Đáp án 2
C. Đáp án 3
D. Đáp án 4
Đáp án: B`;

/**
 * Modal dán nhanh nhiều câu ABCD vào kho, gắn chung metadata môn/khối/độ khó.
 * @param {Object} defaults - Metadata mặc định { grade, difficulty }
 * @param {string} createdBy - uid người tạo
 * @param {Function} onSaved - gọi sau khi lưu thành công, nhận message
 * @param {Function} onClose - gọi khi đóng modal
 */
export default function QuestionQuickPasteModal({
    defaults = {},
    createdBy = null,
    onSaved,
    onClose
}) {
    const [text, setText] = useState('');
    const [result, setResult] = useState(null); // { questions, errors }
    const [grade, setGrade] = useState(defaults.grade ?? '');
    const [difficulty, setDifficulty] = useState(defaults.difficulty || 'medium');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const handleParse = () => setResult(parseQuickQuestions(text));

    const handleSave = async () => {
        if (!result || result.questions.length === 0) return;
        try {
            setSaving(true);
            const list = result.questions.map(q => ({
                ...q,
                type: 'abcd',
                grade: grade === '' ? null : Number(grade),
                difficulty
            }));
            const count = await createQuestionsBatch(list, createdBy);
            onSaved?.(`Đã thêm ${count} câu hỏi vào kho!`);
        } catch (err) {
            setToast({ type: 'error', message: 'Lỗi khi lưu: ' + err.message });
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        📋 Dán nhanh nhiều câu trắc nghiệm
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Khối lớp (áp cho tất cả)</label>
                            <select className={inputCls} value={grade} onChange={e => setGrade(e.target.value)}>
                                <option value="">— Chưa chọn —</option>
                                {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Độ khó</label>
                            <select className={inputCls} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                                {Object.entries(DIFFICULTIES).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            Dán nhiều câu ABCD theo mẫu, các câu cách nhau <b>dòng trống</b>:
                        </p>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg p-3 overflow-x-auto">{SAMPLE}</pre>
                    </div>

                    <textarea
                        rows={10}
                        className={`${inputCls} font-mono text-sm`}
                        placeholder="Dán nội dung câu hỏi vào đây..."
                        value={text}
                        onChange={e => { setText(e.target.value); setResult(null); }}
                    />

                    <Button variant="secondary" size="sm" icon="manage_search" onClick={handleParse} disabled={!text.trim()}>
                        Đọc thử
                    </Button>

                    {result && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                ✅ Đọc được {result.questions.length} câu hợp lệ
                            </p>
                            {result.errors.length > 0 && (
                                <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                    {result.errors.map((err, i) => <p key={i}>⚠️ {err}</p>)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Hủy</Button>
                    <Button
                        icon="playlist_add"
                        loading={saving}
                        onClick={handleSave}
                        disabled={saving || !result || result.questions.length === 0}
                    >
                        {saving ? 'Đang lưu...' : `Thêm ${result?.questions.length || 0} câu vào kho`}
                    </Button>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
