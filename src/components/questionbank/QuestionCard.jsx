import { QUESTION_TYPES, DIFFICULTIES } from '../../services/questionBankService';
import { MathText } from '../math';
import Icon from '../common/Icon';

const DIFFICULTY_STYLES = {
    easy: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    medium: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
    hard: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
};

/**
 * Hiển thị 1 câu hỏi trong kho (kèm đáp án).
 * @param {Object} question - Doc câu hỏi
 * @param {boolean} selectable - Bật checkbox chọn
 * @param {boolean} selected - Đang được chọn
 * @param {Function} onToggle - Bật/tắt chọn
 * @param {Function} onEdit - Sửa (ẩn nếu không truyền)
 * @param {Function} onDelete - Xóa (ẩn nếu không truyền)
 */
export default function QuestionCard({
    question,
    selectable = false,
    selected = false,
    onToggle,
    onEdit,
    onDelete
}) {
    const type = question.type || 'abcd';
    const isImage = question.inputMode === 'image';

    const renderAnswers = () => {
        if (type === 'true_false') {
            return (
                <ul className="space-y-1">
                    {(question.statements || []).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                            <span className={`shrink-0 font-bold ${s.isTrue ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {s.isTrue ? '✓' : '✗'}
                            </span>
                            <MathText
                                className="text-gray-700 dark:text-gray-300"
                                content={s.text?.trim() || `Ý ${String.fromCharCode(97 + i)})`}
                            />
                        </li>
                    ))}
                </ul>
            );
        }

        if (type === 'short_answer') {
            return (
                <div className="text-sm space-y-1">
                    <p className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold text-green-600 dark:text-green-400">Đáp án: </span>
                        <MathText content={question.correctAnswer} />
                    </p>
                    {(question.alternativeAnswers || []).length > 0 && (
                        <p className="text-gray-500 dark:text-gray-400">
                            Chấp nhận thêm: <MathText content={question.alternativeAnswers.join(', ')} />
                        </p>
                    )}
                </div>
            );
        }

        // Dạng ảnh: đáp án không có text, chỉ hiện chip A/B/C/D và tô đáp án đúng
        if (isImage) {
            return (
                <div className="flex flex-wrap gap-1.5">
                    {(question.answers || []).map((a, i) => (
                        <span
                            key={i}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${a.isCorrect
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                                }`}
                        >
                            {String.fromCharCode(65 + i)}
                        </span>
                    ))}
                </div>
            );
        }

        return (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {(question.answers || []).map((a, i) => (
                    <li
                        key={i}
                        className={`text-sm flex items-start gap-1.5 ${a.isCorrect
                            ? 'font-semibold text-green-700 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                            }`}
                    >
                        <span className="shrink-0">{String.fromCharCode(65 + i)}.</span>
                        <MathText content={a.text} />
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div
            className={`rounded-xl p-4 border transition-colors ${selected
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
                : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700'
                } ${selectable ? 'cursor-pointer hover:border-blue-300' : ''}`}
            onClick={selectable ? () => onToggle?.(question.id) : undefined}
        >
            <div className="flex items-start gap-3">
                {selectable && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggle?.(question.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
                    />
                )}

                <div className="flex-1 min-w-0">
                    {/* Badge metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {QUESTION_TYPES[type]}
                        </span>
                        {question.grade && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                                Khối {question.grade}
                            </span>
                        )}
                        {question.difficulty && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[question.difficulty] || DIFFICULTY_STYLES.medium}`}>
                                {DIFFICULTIES[question.difficulty] || question.difficulty}
                            </span>
                        )}
                        {isImage && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                                🖼️ Ảnh
                            </span>
                        )}
                    </div>

                    {question.questionText?.trim() && (
                        <MathText
                            as="div"
                            className="font-semibold text-gray-900 dark:text-white mb-2"
                            content={question.questionText}
                        />
                    )}

                    {question.questionImage && (
                        <div className="mb-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 overflow-x-auto">
                            <img
                                src={question.questionImage}
                                alt="Ảnh câu hỏi"
                                loading="lazy"
                                className="max-h-56 rounded"
                            />
                        </div>
                    )}

                    {renderAnswers()}
                </div>

                {(onEdit || onDelete) && (
                    <div className="flex items-center gap-1 shrink-0">
                        {onEdit && (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onEdit(question); }}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                                title="Sửa câu hỏi"
                            >
                                <Icon name="edit" size={18} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onDelete(question); }}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                title="Xóa câu hỏi"
                            >
                                <Icon name="delete" size={18} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
