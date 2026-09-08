import {
    UNFILED_ID,
    countQuestionsByFolder
} from '../../services/questionFolderService';

/**
 * Một chip lọc. Tách ra ngoài để không bị khai báo lại mỗi lần render.
 * @param {Object} props - { id, label, count, active, onSelect }
 */
function Chip({ id, label, count, active, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(id)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${active
                ? 'ring-2 ring-blue-500 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
        >
            {label} <span className="opacity-70">({count})</span>
        </button>
    );
}

/**
 * Dải chip lọc theo thư mục — bản gọn của sidebar, dùng trong modal chọn câu hỏi.
 * @param {Array} folders - Danh sách thư mục
 * @param {Array} questions - Toàn bộ câu hỏi (để đếm)
 * @param {string} activeId - Thư mục đang chọn ('' = tất cả)
 * @param {Function} onSelect - Đổi thư mục đang chọn
 */
export default function FolderChips({ folders = [], questions = [], activeId = '', onSelect }) {
    const counts = countQuestionsByFolder(questions);

    return (
        <>
            <Chip id="" label="🗂️ Tất cả" count={questions.length} active={activeId === ''} onSelect={onSelect} />
            {folders.map(f => (
                <Chip
                    key={f.id}
                    id={f.id}
                    label={`${f.icon || '📁'} ${f.name}`}
                    count={counts[f.id] || 0}
                    active={activeId === f.id}
                    onSelect={onSelect}
                />
            ))}
            <Chip
                id={UNFILED_ID}
                label="📥 Chưa phân loại"
                count={counts[UNFILED_ID] || 0}
                active={activeId === UNFILED_ID}
                onSelect={onSelect}
            />
        </>
    );
}
