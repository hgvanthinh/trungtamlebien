import { useState, useEffect, useMemo } from 'react';
import { getQuestions, toVersusQuestion } from '../../services/questionBankService';
import QuestionCard from './QuestionCard';
import QuestionFilters from './QuestionFilters';
import { applyQuestionFilters } from '../../utils/applyQuestionFilters';
import Icon from '../common/Icon';
import Button from '../common/Button';

const EMPTY_FILTERS = { search: '', type: '', grade: '', difficulty: '' };

/**
 * Modal chọn nhiều câu hỏi từ kho để nhúng vào bài đấu.
 * @param {Function} onPick - nhận mảng câu hỏi (đã convert sang format versus)
 * @param {Function} onClose - đóng modal
 */
export default function QuestionPickerModal({ onPick, onClose }) {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        getQuestions()
            .then(setQuestions)
            .catch(() => setError('Lỗi khi tải kho câu hỏi'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(
        () => applyQuestionFilters(questions, filters),
        [questions, filters]
    );

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every(q => selectedIds.includes(q.id));

    const toggleSelectAll = () => {
        const ids = filtered.map(q => q.id);
        setSelectedIds(prev => allFilteredSelected
            ? prev.filter(id => !ids.includes(id))
            : [...new Set([...prev, ...ids])]
        );
    };

    const handleConfirm = () => {
        // Giữ đúng thứ tự người dùng đã chọn
        const byId = new Map(questions.map(q => [q.id, q]));
        const picked = selectedIds
            .map(id => byId.get(id))
            .filter(Boolean)
            .map(toVersusQuestion);
        onPick?.(picked);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        📚 Chọn câu hỏi từ kho
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
                    <QuestionFilters filters={filters} onChange={setFilters} />
                    {filtered.length > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            Chọn tất cả ({filtered.length} câu đang hiển thị)
                        </label>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                            <p className="mt-3 text-gray-500 dark:text-gray-400">Đang tải...</p>
                        </div>
                    ) : error ? (
                        <p className="text-center py-12 text-red-600 dark:text-red-400">{error}</p>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-12">
                            <Icon name="help_center" className="text-5xl text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">
                                Kho câu hỏi đang trống. Vào <b>Kho đề thi → Kho câu hỏi</b> để thêm câu hỏi.
                            </p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Không có câu hỏi nào khớp bộ lọc
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(q => (
                                <QuestionCard
                                    key={q.id}
                                    question={q}
                                    selectable
                                    selected={selectedIds.includes(q.id)}
                                    onToggle={toggleSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        Đã chọn {selectedIds.length} câu
                    </span>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose}>Hủy</Button>
                        <Button icon="playlist_add" onClick={handleConfirm} disabled={selectedIds.length === 0}>
                            Thêm {selectedIds.length} câu vào bài đấu
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
