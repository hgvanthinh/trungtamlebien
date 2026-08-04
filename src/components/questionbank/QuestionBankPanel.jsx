import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    getQuestions,
    deleteQuestion,
    deleteQuestionsBatch
} from '../../services/questionBankService';
import QuestionCard from './QuestionCard';
import QuestionFilters from './QuestionFilters';
import { applyQuestionFilters } from '../../utils/applyQuestionFilters';
import QuestionFormModal from './QuestionFormModal';
import QuestionQuickPasteModal from './QuestionQuickPasteModal';
import ConfirmModal from '../common/ConfirmModal';
import Icon from '../common/Icon';
import Button from '../common/Button';

const EMPTY_FILTERS = { search: '', type: '', grade: '', difficulty: '' };

/**
 * Tab "Kho câu hỏi" — CRUD từng câu hỏi dùng lại cho Đấu Trí 1v1.
 * @param {string} createdBy - uid admin đang đăng nhập
 * @param {Function} onToast - hiển thị toast { type, message }
 */
export default function QuestionBankPanel({ createdBy = null, onToast }) {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);

    const [showForm, setShowForm] = useState(false);
    const [formInputMode, setFormInputMode] = useState('text'); // chế độ khi mở form tạo mới
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [showQuickPaste, setShowQuickPaste] = useState(false);

    const [selectedIds, setSelectedIds] = useState([]);
    const [questionToDelete, setQuestionToDelete] = useState(null);
    const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setQuestions(await getQuestions());
        } catch {
            onToast?.({ type: 'error', message: 'Lỗi khi tải kho câu hỏi' });
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        load();
    }, [load]);

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

    const handleSaved = (message) => {
        setShowForm(false);
        setShowQuickPaste(false);
        setEditingQuestion(null);
        onToast?.({ type: 'success', message });
        load();
    };

    const confirmDeleteOne = async () => {
        if (!questionToDelete) return;
        try {
            await deleteQuestion(questionToDelete.id);
            setSelectedIds(prev => prev.filter(id => id !== questionToDelete.id));
            onToast?.({ type: 'success', message: 'Đã xóa câu hỏi!' });
            load();
        } catch (err) {
            onToast?.({ type: 'error', message: 'Lỗi khi xóa: ' + err.message });
        } finally {
            setQuestionToDelete(null);
        }
    };

    const confirmBulkDelete = async () => {
        try {
            await deleteQuestionsBatch(selectedIds);
            onToast?.({ type: 'success', message: `Đã xóa ${selectedIds.length} câu hỏi!` });
            setSelectedIds([]);
            load();
        } catch (err) {
            onToast?.({ type: 'error', message: 'Lỗi khi xóa: ' + err.message });
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải kho câu hỏi...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Thao tác */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => { setEditingQuestion(null); setFormInputMode('text'); setShowForm(true); }}
                    className="px-6 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Icon name="add_circle" />
                    Thêm câu hỏi
                </button>
                <button
                    onClick={() => { setEditingQuestion(null); setFormInputMode('image'); setShowForm(true); }}
                    className="px-6 py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Icon name="add_photo_alternate" />
                    Tải ảnh câu hỏi
                </button>
                <button
                    onClick={() => setShowQuickPaste(true)}
                    className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Icon name="content_paste" />
                    Dán nhanh nhiều câu
                </button>
            </div>

            {/* Bộ lọc */}
            <QuestionFilters filters={filters} onChange={setFilters} />

            {/* Thanh chọn hàng loạt */}
            {filtered.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        Chọn tất cả ({filtered.length} câu đang hiển thị)
                    </label>

                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Đã chọn {selectedIds.length} câu
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="delete"
                                onClick={() => setShowConfirmBulkDelete(true)}
                                className="text-red-600 dark:text-red-400"
                            >
                                Xóa đã chọn
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Danh sách */}
            {questions.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="help_center" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                        Kho câu hỏi đang trống
                    </h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        Nhấn "Thêm câu hỏi" để nhập từng câu, hoặc "Dán nhanh" để nhập hàng loạt
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="search_off" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        Không có câu hỏi nào khớp bộ lọc
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(q => (
                        <QuestionCard
                            key={q.id}
                            question={q}
                            selectable
                            selected={selectedIds.includes(q.id)}
                            onToggle={toggleSelect}
                            onEdit={(question) => { setEditingQuestion(question); setShowForm(true); }}
                            onDelete={setQuestionToDelete}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showForm && (
                <QuestionFormModal
                    question={editingQuestion}
                    defaultInputMode={formInputMode}
                    defaults={{ grade: filters.grade, difficulty: filters.difficulty || 'medium' }}
                    createdBy={createdBy}
                    onSaved={handleSaved}
                    onClose={() => { setShowForm(false); setEditingQuestion(null); }}
                />
            )}

            {showQuickPaste && (
                <QuestionQuickPasteModal
                    defaults={{ grade: filters.grade, difficulty: filters.difficulty || 'medium' }}
                    createdBy={createdBy}
                    onSaved={handleSaved}
                    onClose={() => setShowQuickPaste(false)}
                />
            )}

            <ConfirmModal
                isOpen={!!questionToDelete}
                onClose={() => setQuestionToDelete(null)}
                onConfirm={confirmDeleteOne}
                title="Xóa câu hỏi"
                message="Bạn có chắc chắn muốn xóa câu hỏi này khỏi kho? Các bài đấu đã dùng câu này không bị ảnh hưởng."
                confirmText="Xóa"
                cancelText="Hủy"
                type="danger"
            />

            <ConfirmModal
                isOpen={showConfirmBulkDelete}
                onClose={() => setShowConfirmBulkDelete(false)}
                onConfirm={confirmBulkDelete}
                title="Xóa nhiều câu hỏi"
                message={`Bạn có chắc chắn muốn xóa ${selectedIds.length} câu hỏi đã chọn? Hành động này không thể hoàn tác.`}
                confirmText="Xóa"
                cancelText="Hủy"
                type="danger"
            />
        </div>
    );
}
