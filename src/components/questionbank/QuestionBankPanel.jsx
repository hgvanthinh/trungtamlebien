import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    getQuestionsPage,
    deleteQuestion,
    deleteQuestionsBatch,
    moveQuestionsToFolder
} from '../../services/questionBankService';
import {
    getFolders,
    deleteFolder,
    reorderFolders,
    UNFILED_ID
} from '../../services/questionFolderService';
import QuestionFolderSidebar from './QuestionFolderSidebar';
import FolderFormModal from './FolderFormModal';
import QuestionCard from './QuestionCard';
import QuestionFilters from './QuestionFilters';
import { applyQuestionFilters } from '../../utils/applyQuestionFilters';
import QuestionFormModal from './QuestionFormModal';
import QuestionQuickPasteModal from './QuestionQuickPasteModal';
import ConfirmModal from '../common/ConfirmModal';
import Icon from '../common/Icon';
import Button from '../common/Button';

const EMPTY_FILTERS = { search: '', type: '', grade: '', difficulty: '', folderId: '' };

const PAGE_SIZE = 20;

/**
 * Tab "Kho câu hỏi" — CRUD từng câu hỏi dùng lại cho Đấu Trí 1v1.
 * @param {string} createdBy - uid admin đang đăng nhập
 * @param {Function} onToast - hiển thị toast { type, message }
 */
export default function QuestionBankPanel({ createdBy = null, onToast }) {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    // Phân trang: cursor là doc snapshot cuối trang trước (ref để không gây re-render)
    const cursorRef = useRef(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [formInputMode, setFormInputMode] = useState('text'); // chế độ khi mở form tạo mới
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [showQuickPaste, setShowQuickPaste] = useState(false);

    const [selectedIds, setSelectedIds] = useState([]);
    const [questionToDelete, setQuestionToDelete] = useState(null);
    const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

    // Thư mục do người dùng tự tạo
    const [folders, setFolders] = useState([]);
    const [showFolderForm, setShowFolderForm] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderToDelete, setFolderToDelete] = useState(null);
    // Số câu đang kéo sang sidebar (0 = không kéo)
    const [draggingCount, setDraggingCount] = useState(0);

    /** Tải lại từ đầu: trang 1 + danh sách thư mục */
    const load = useCallback(async () => {
        try {
            setLoading(true);
            cursorRef.current = null;
            const [page, folderList] = await Promise.all([
                getQuestionsPage(PAGE_SIZE),
                getFolders()
            ]);
            setQuestions(page.items);
            cursorRef.current = page.cursor;
            setHasMore(page.hasMore);
            setFolders(folderList);
        } catch {
            onToast?.({ type: 'error', message: 'Lỗi khi tải kho câu hỏi' });
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    /** Nối thêm trang kế tiếp vào cuối danh sách */
    const loadMore = useCallback(async () => {
        if (!cursorRef.current) return;
        try {
            setLoadingMore(true);
            const page = await getQuestionsPage(PAGE_SIZE, cursorRef.current);
            // Lọc trùng phòng khi có câu vừa được thêm làm lệch cursor
            setQuestions(prev => {
                const seen = new Set(prev.map(q => q.id));
                return [...prev, ...page.items.filter(q => !seen.has(q.id))];
            });
            cursorRef.current = page.cursor;
            setHasMore(page.hasMore);
        } catch {
            onToast?.({ type: 'error', message: 'Lỗi khi tải thêm câu hỏi' });
        } finally {
            setLoadingMore(false);
        }
    }, [onToast]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(
        () => applyQuestionFilters(questions, filters),
        [questions, filters]
    );

    const hasActiveFilter = useMemo(
        () => Object.values(filters).some(v => v !== '' && v != null),
        [filters]
    );

    // Filter chạy ở client trên số câu đã tải, nên khi đang lọc mà kết quả còn
    // mỏng thì tự kéo thêm trang để người dùng không tưởng là kho hết câu.
    useEffect(() => {
        if (!hasActiveFilter || loading || loadingMore || !hasMore) return;
        if (filtered.length >= PAGE_SIZE) return;
        loadMore();
    }, [hasActiveFilter, filtered.length, loading, loadingMore, hasMore, loadMore]);

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

    /**
     * Chuyển các câu đang chọn sang thư mục khác (null = bỏ phân loại).
     * @param {string|null} folderId - Thư mục đích
     */
    const handleMoveSelected = async (folderId) => {
        if (selectedIds.length === 0) return;
        try {
            const count = await moveQuestionsToFolder(selectedIds, folderId);
            const target = folderId
                ? folders.find(f => f.id === folderId)?.name || 'thư mục'
                : 'Chưa phân loại';
            onToast?.({ type: 'success', message: `Đã chuyển ${count} câu vào "${target}"` });
            setSelectedIds([]);
            load();
        } catch (err) {
            onToast?.({ type: 'error', message: 'Lỗi khi chuyển thư mục: ' + err.message });
        }
    };

    const handleFolderSaved = (message) => {
        setShowFolderForm(false);
        setEditingFolder(null);
        onToast?.({ type: 'success', message });
        load();
    };

    const handleReorderFolders = async (orderedIds) => {
        // Cập nhật lạc quan để kéo thả mượt, sau đó ghi xuống Firestore
        const byId = new Map(folders.map(f => [f.id, f]));
        setFolders(orderedIds.map(id => byId.get(id)).filter(Boolean));
        try {
            await reorderFolders(orderedIds);
        } catch {
            onToast?.({ type: 'error', message: 'Lỗi khi sắp xếp thư mục' });
            load();
        }
    };

    const confirmDeleteFolder = async () => {
        if (!folderToDelete) return;
        try {
            const detached = await deleteFolder(folderToDelete.id);
            if (filters.folderId === folderToDelete.id) {
                setFilters(prev => ({ ...prev, folderId: '' }));
            }
            onToast?.({
                type: 'success',
                message: detached > 0
                    ? `Đã xóa thư mục, ${detached} câu chuyển về "Chưa phân loại"`
                    : 'Đã xóa thư mục!'
            });
            load();
        } catch (err) {
            onToast?.({ type: 'error', message: 'Lỗi khi xóa thư mục: ' + err.message });
        } finally {
            setFolderToDelete(null);
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

            {/* Thư mục (trái) + danh sách câu hỏi (phải) */}
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <aside className="w-full lg:w-64 shrink-0 clay-card p-3">
                    <QuestionFolderSidebar
                        folders={folders}
                        questions={questions}
                        partial={hasMore}
                        activeId={filters.folderId}
                        onSelect={(id) => setFilters(prev => ({ ...prev, folderId: id }))}
                        onCreate={() => { setEditingFolder(null); setShowFolderForm(true); }}
                        onEdit={(f) => { setEditingFolder(f); setShowFolderForm(true); }}
                        onDelete={setFolderToDelete}
                        onReorder={handleReorderFolders}
                        onDropQuestions={handleMoveSelected}
                        draggingCount={draggingCount}
                    />
                </aside>

                <div className="flex-1 min-w-0 space-y-4">
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
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (!v) return;
                                            handleMoveSelected(v === UNFILED_ID ? null : v);
                                            e.target.value = '';
                                        }}
                                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        aria-label="Chuyển câu đã chọn vào thư mục"
                                    >
                                        <option value="">📂 Chuyển vào thư mục...</option>
                                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>{f.icon || '📁'} {f.name}</option>
                                        ))}
                                        <option value={UNFILED_ID}>📥 Bỏ khỏi thư mục</option>
                                    </select>
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
                        <>
                            {/* Lưới 2 cột trên màn rộng, 1 cột trên mobile */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                                {filtered.map(q => (
                                    <div
                                        key={q.id}
                                        // Chỉ kéo được câu đã chọn — thả vào sidebar sẽ chuyển cả nhóm
                                        draggable={selectedIds.includes(q.id)}
                                        onDragStart={() => setDraggingCount(selectedIds.length)}
                                        onDragEnd={() => setDraggingCount(0)}
                                    >
                                        <QuestionCard
                                            question={q}
                                            selectable
                                            selected={selectedIds.includes(q.id)}
                                            onToggle={toggleSelect}
                                            onEdit={(question) => { setEditingQuestion(question); setShowForm(true); }}
                                            onDelete={setQuestionToDelete}
                                            folder={folders.find(f => f.id === q.folderId) || null}
                                        />
                                    </div>
                                ))}
                            </div>

                            {hasMore && (
                                <div className="mt-4 text-center">
                                    <Button
                                        variant="secondary"
                                        icon="expand_more"
                                        loading={loadingMore}
                                        onClick={loadMore}
                                    >
                                        {loadingMore ? 'Đang tải...' : `Tải thêm ${PAGE_SIZE} câu`}
                                    </Button>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Đã tải {questions.length} câu
                                        {hasActiveFilter && ` · ${filtered.length} câu khớp bộ lọc`}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>

            {/* Modals */}
            {showForm && (
                <QuestionFormModal
                    question={editingQuestion}
                    defaultInputMode={formInputMode}
                    defaults={{
                        grade: filters.grade,
                        difficulty: filters.difficulty || 'medium',
                        folderId: filters.folderId === UNFILED_ID ? '' : filters.folderId
                    }}
                    folders={folders}
                    createdBy={createdBy}
                    onSaved={handleSaved}
                    onClose={() => { setShowForm(false); setEditingQuestion(null); }}
                />
            )}

            {showQuickPaste && (
                <QuestionQuickPasteModal
                    defaults={{
                        grade: filters.grade,
                        difficulty: filters.difficulty || 'medium',
                        folderId: filters.folderId === UNFILED_ID ? '' : filters.folderId
                    }}
                    folders={folders}
                    createdBy={createdBy}
                    onSaved={handleSaved}
                    onClose={() => setShowQuickPaste(false)}
                />
            )}

            {showFolderForm && (
                <FolderFormModal
                    folder={editingFolder}
                    createdBy={createdBy}
                    onSaved={handleFolderSaved}
                    onClose={() => { setShowFolderForm(false); setEditingFolder(null); }}
                />
            )}

            <ConfirmModal
                isOpen={!!folderToDelete}
                onClose={() => setFolderToDelete(null)}
                onConfirm={confirmDeleteFolder}
                title="Xóa thư mục"
                message={`Xóa thư mục "${folderToDelete?.name || ''}"? Các câu hỏi bên trong KHÔNG bị xóa, chỉ chuyển về "Chưa phân loại".`}
                confirmText="Xóa thư mục"
                cancelText="Hủy"
                type="danger"
            />

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
