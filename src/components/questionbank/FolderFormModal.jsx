import { useState } from 'react';
import {
    FOLDER_ICON_PRESETS,
    DEFAULT_FOLDER_ICON,
    createFolder,
    updateFolder
} from '../../services/questionFolderService';
import Icon from '../common/Icon';
import Button from '../common/Button';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

/**
 * Modal tạo / đổi tên thư mục kho câu hỏi.
 * @param {Object|null} folder - null = tạo mới, khác null = sửa (cần folder.id)
 * @param {string} createdBy - uid người tạo
 * @param {Function} onSaved - gọi sau khi lưu, nhận message
 * @param {Function} onClose - đóng modal
 */
export default function FolderFormModal({ folder = null, createdBy = null, onSaved, onClose }) {
    const isEdit = !!folder?.id;
    const [name, setName] = useState(folder?.name || '');
    const [icon, setIcon] = useState(folder?.icon || DEFAULT_FOLDER_ICON);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Chưa nhập tên thư mục');
            return;
        }
        try {
            setSaving(true);
            setError(null);
            if (isEdit) {
                await updateFolder(folder.id, { name, icon });
                onSaved?.('Đã cập nhật thư mục!');
            } else {
                await createFolder({ name, icon }, createdBy);
                onSaved?.('Đã tạo thư mục mới!');
            }
        } catch (err) {
            setError('Lỗi khi lưu: ' + err.message);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {isEdit ? '✏️ Sửa thư mục' : '📁 Thư mục mới'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div>
                        <label className={labelCls}>Tên thư mục *</label>
                        <input
                            type="text"
                            className={inputCls}
                            value={name}
                            autoFocus
                            placeholder="Ví dụ: Hàm số bậc hai"
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Biểu tượng</label>
                        <div className="flex flex-wrap gap-2">
                            {FOLDER_ICON_PRESETS.map(em => (
                                <button
                                    key={em}
                                    type="button"
                                    onClick={() => setIcon(em)}
                                    className={`w-10 h-10 rounded-lg text-xl transition-all ${icon === em
                                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/40'
                                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button icon="save" loading={saving} onClick={handleSave} disabled={saving}>
                        {isEdit ? 'Lưu thay đổi' : 'Tạo thư mục'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
