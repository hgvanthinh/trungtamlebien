import { QUESTION_TYPES, DIFFICULTIES, GRADES } from '../../services/questionBankService';

const selectCls = "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";

/**
 * Thanh lọc câu hỏi (tìm kiếm + loại + khối + độ khó).
 * @param {Object} filters - State filter hiện tại
 * @param {Function} onChange - Nhận filter mới
 */
export default function QuestionFilters({ filters, onChange }) {
    const patch = (updates) => onChange({ ...filters, ...updates });

    return (
        <div className="flex flex-wrap gap-2 items-center">
            <input
                type="text"
                className={`${selectCls} flex-1 min-w-[200px]`}
                placeholder="🔍 Tìm theo nội dung câu hỏi hoặc đáp án..."
                value={filters.search || ''}
                onChange={e => patch({ search: e.target.value })}
            />
            <select className={selectCls} value={filters.type || ''} onChange={e => patch({ type: e.target.value })}>
                <option value="">Mọi loại câu</option>
                {Object.entries(QUESTION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={selectCls} value={filters.grade || ''} onChange={e => patch({ grade: e.target.value })}>
                <option value="">Mọi khối</option>
                {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
            </select>
            <select className={selectCls} value={filters.difficulty || ''} onChange={e => patch({ difficulty: e.target.value })}>
                <option value="">Mọi độ khó</option>
                {Object.entries(DIFFICULTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </div>
    );
}
