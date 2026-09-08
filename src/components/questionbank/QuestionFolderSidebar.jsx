import { useState } from 'react';
import {
    UNFILED_ID,
    countQuestionsByFolder
} from '../../services/questionFolderService';
import Icon from '../common/Icon';

/**
 * Một dòng trong danh sách thư mục. Tách khỏi component cha để không bị tạo lại
 * mỗi lần render (giữ nguyên DOM khi kéo thả).
 * @param {Object} props - Dữ liệu dòng + các handler kéo/thả từ sidebar
 */
function FolderRow({
    id,
    icon,
    label,
    count,
    folder = null,
    activeId,
    manageable,
    dropTargetId,
    dragFolderId,
    acceptingQuestions,
    onSelect,
    onEdit,
    onDelete,
    onDragStartFolder,
    onDragEndRow,
    onDragOverRow,
    onDragLeaveRow,
    onDropRow
}) {
    const isActive = activeId === id;
    const isDropTarget = dropTargetId === id && (acceptingQuestions || dragFolderId);

    return (
        <div
            draggable={manageable && !!folder}
            onDragStart={() => folder && onDragStartFolder(folder.id)}
            onDragEnd={onDragEndRow}
            onDragOver={(e) => onDragOverRow(e, id)}
            onDragLeave={() => onDragLeaveRow(id)}
            onDrop={(e) => onDropRow(e, id)}
            onClick={() => onSelect?.(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ${isActive
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-bold'
                : 'text-gray-700 dark:text-gray-300'
                } ${isDropTarget ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
        >
            <span className="text-base shrink-0">{icon}</span>
            <span className="flex-1 truncate text-sm">{label}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{count}</span>

            {manageable && folder && isActive && (
                <span className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        title="Sửa thư mục"
                        onClick={(e) => { e.stopPropagation(); onEdit?.(folder); }}
                        className="p-1 rounded text-gray-500"
                    >
                        <Icon name="edit" size={16} />
                    </button>
                    <button
                        type="button"
                        title="Xóa thư mục"
                        onClick={(e) => { e.stopPropagation(); onDelete?.(folder); }}
                        className="p-1 rounded text-red-500"
                    >
                        <Icon name="delete" size={16} />
                    </button>
                </span>
            )}
        </div>
    );
}

/**
 * Cột thư mục của kho câu hỏi: chọn thư mục để lọc, tạo/sửa/xóa, kéo-thả sắp xếp.
 * Người dùng tự tạo thư mục nên danh sách hoàn toàn do họ định nghĩa.
 *
 * @param {Array} folders - Danh sách thư mục
 * @param {Array} questions - Toàn bộ câu hỏi (để đếm số câu mỗi thư mục)
 * @param {string} activeId - Thư mục đang chọn ('' = tất cả)
 * @param {Function} onSelect - Đổi thư mục đang chọn
 * @param {Function} onCreate - Bấm nút tạo thư mục mới
 * @param {Function} onEdit - Sửa một thư mục
 * @param {Function} onDelete - Xóa một thư mục
 * @param {Function} onReorder - Nhận mảng id theo thứ tự mới sau khi kéo thả
 * @param {Function} onDropQuestions - Thả các câu đang chọn vào thư mục (id hoặc null)
 * @param {number} draggingCount - Số câu đang được kéo (0 = không kéo câu nào)
 * @param {boolean} manageable - Cho phép tạo/sửa/xóa/sắp xếp (tắt ở modal chọn câu)
 * @param {boolean} partial - `questions` mới là phần đã tải (phân trang) nên số đếm hiển thị kèm dấu +
 */
export default function QuestionFolderSidebar({
    folders = [],
    questions = [],
    activeId = '',
    onSelect,
    onCreate,
    onEdit,
    onDelete,
    onReorder,
    onDropQuestions,
    draggingCount = 0,
    manageable = true,
    partial = false
}) {
    // id thư mục đang bị kéo để sắp xếp lại (null = không kéo)
    const [dragFolderId, setDragFolderId] = useState(null);
    // id vùng đang được hover khi thả câu hỏi vào
    const [dropTargetId, setDropTargetId] = useState(null);

    const counts = countQuestionsByFolder(questions);
    const total = questions.length;
    // Khi mới tải một phần kho, số đếm chỉ là tối thiểu — thêm "+" cho khỏi hiểu nhầm
    const fmt = (n) => (partial ? `${n}+` : n);
    const acceptingQuestions = draggingCount > 0 && !!onDropQuestions;

    const handleFolderDragStart = (id) => {
        if (!manageable) return;
        setDragFolderId(id);
    };

    const handleFolderDrop = (targetId) => {
        if (!dragFolderId || dragFolderId === targetId) return;
        const ids = folders.map(f => f.id);
        const from = ids.indexOf(dragFolderId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        onReorder?.(ids);
    };

    /** Xử lý thả: ưu tiên thả câu hỏi, nếu không thì là sắp xếp thư mục. */
    const handleDrop = (e, targetId) => {
        e.preventDefault();
        setDropTargetId(null);
        if (acceptingQuestions) {
            onDropQuestions?.(targetId === UNFILED_ID ? null : targetId);
        } else {
            handleFolderDrop(targetId);
        }
        setDragFolderId(null);
    };

    const handleDragOver = (e, id) => {
        // Chỉ nhận thả câu hỏi vào thư mục thật hoặc "Chưa phân loại"
        const canDropQuestions = acceptingQuestions && id !== '';
        if (!canDropQuestions && !dragFolderId) return;
        e.preventDefault();
        setDropTargetId(id);
    };

    // Gom các handler dùng chung cho mọi dòng thư mục
    const rowProps = {
        activeId,
        manageable,
        dropTargetId,
        dragFolderId,
        acceptingQuestions,
        onSelect,
        onEdit,
        onDelete,
        onDragStartFolder: handleFolderDragStart,
        onDragEndRow: () => { setDragFolderId(null); setDropTargetId(null); },
        onDragOverRow: handleDragOver,
        onDragLeaveRow: (id) => setDropTargetId(prev => (prev === id ? null : prev)),
        onDropRow: handleDrop
    };

    return (
        <div className="space-y-1">
            <div className="px-1 pb-1">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Thư mục
                </h4>
            </div>

            {manageable && (
                <button
                    type="button"
                    onClick={onCreate}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40"
                >
                    <Icon name="create_new_folder" size={18} />
                    Tạo thư mục
                </button>
            )}

            <FolderRow {...rowProps} id="" icon="🗂️" label="Tất cả câu hỏi" count={fmt(total)} />

            {folders.map(f => (
                <FolderRow
                    {...rowProps}
                    key={f.id}
                    id={f.id}
                    icon={f.icon || '📁'}
                    label={f.name}
                    count={fmt(counts[f.id] || 0)}
                    folder={f}
                />
            ))}

            <FolderRow
                {...rowProps}
                id={UNFILED_ID}
                icon="📥"
                label="Chưa phân loại"
                count={fmt(counts[UNFILED_ID] || 0)}
            />

            {acceptingQuestions && (
                <p className="px-2 pt-2 text-xs text-blue-600 dark:text-blue-400">
                    Thả vào thư mục để chuyển {draggingCount} câu đang chọn
                </p>
            )}

            {manageable && folders.length === 0 && (
                <p className="px-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
                    Chưa có thư mục nào. Bấm "Tạo thư mục mới" để nhóm câu hỏi theo chuyên đề.
                </p>
            )}
        </div>
    );
}
