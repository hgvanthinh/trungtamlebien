import { useState, useEffect } from 'react';
import {
    getAllStoreItems,
    createStoreItem,
    updateStoreItem,
    deleteStoreItem,
    uploadItemImage,
    deleteItemImage
} from '../../services/storeService';
import CoinIcon from '../../components/common/CoinIcon';
import GoldIcon from '../../components/common/GoldIcon';
import Toast from '../../components/common/Toast';

export default function AdminStore() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        currency: 'coins', // 'coins' or 'gold'
        category: 'avatar-border', // 'avatar-border'
        discontinued: false, // true = ngưng bán
        imageUrl: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            setLoading(true);
            const data = await getAllStoreItems();
            setItems(data);
        } catch (error) {
            console.error('Error loading items:', error);
            setToast({ type: 'error', message: 'Lỗi khi tải danh sách món hàng' });
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setToast({ type: 'error', message: 'Vui lòng nhập tên món hàng' });
            return;
        }

        if (formData.price <= 0) {
            setToast({ type: 'error', message: 'Giá phải lớn hơn 0' });
            return;
        }

        try {
            setUploading(true);

            let imageUrl = formData.imageUrl;

            // Upload new image if selected
            if (imageFile) {
                const tempId = editingItem?.id || `temp_${Date.now()}`;
                imageUrl = await uploadItemImage(imageFile, tempId);

                // Delete old image if editing
                if (editingItem && editingItem.imageUrl && editingItem.imageUrl !== imageUrl) {
                    await deleteItemImage(editingItem.imageUrl);
                }
            }

            const itemData = {
                ...formData,
                imageUrl,
                price: Number(formData.price)
            };

            if (editingItem) {
                // Update existing item
                await updateStoreItem(editingItem.id, itemData);
                setToast({ type: 'success', message: 'Cập nhật món hàng thành công!' });
            } else {
                // Create new item
                await createStoreItem(itemData);
                setToast({ type: 'success', message: 'Thêm món hàng thành công!' });
            }

            // Reset form and reload
            resetForm();
            loadItems();
            setShowModal(false);
        } catch (error) {
            console.error('Error saving item:', error);
            setToast({ type: 'error', message: 'Lỗi khi lưu món hàng: ' + error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            price: item.price,
            currency: item.currency,
            category: item.category || 'avatar-border',
            discontinued: item.discontinued || false,
            imageUrl: item.imageUrl || ''
        });
        setImagePreview(item.imageUrl || '');
        setShowModal(true);
    };

    const handleDelete = async (item) => {
        if (!confirm(`Bạn có chắc muốn xóa món hàng "${item.name}"?`)) {
            return;
        }

        try {
            await deleteStoreItem(item.id);
            setToast({ type: 'success', message: 'Xóa món hàng thành công!' });
            loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            setToast({ type: 'error', message: 'Lỗi khi xóa món hàng' });
        }
    };

    const toggleDiscontinued = async (item) => {
        const newStatus = !item.discontinued;
        const action = newStatus ? 'ngưng bán' : 'mở bán lại';

        if (!confirm(`Bạn có chắc muốn ${action} món hàng "${item.name}"?`)) {
            return;
        }

        try {
            await updateStoreItem(item.id, { discontinued: newStatus });
            setToast({
                type: 'success',
                message: `Đã ${action} món hàng thành công!`
            });
            loadItems();
        } catch (error) {
            console.error('Error toggling discontinued:', error);
            setToast({ type: 'error', message: 'Lỗi khi cập nhật trạng thái' });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            price: 0,
            currency: 'coins',
            category: 'avatar-border',
            discontinued: false,
            imageUrl: ''
        });
        setImageFile(null);
        setImagePreview('');
        setEditingItem(null);
    };

    const handleCloseModal = () => {
        resetForm();
        setShowModal(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        🏪 Quản Lý Cửa Hàng
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Quản lý các món hàng trong cửa hàng
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                    <span className="text-xl">➕</span>
                    Thêm Món Hàng
                </button>
            </div>

            {/* Items Grid */}
            {items.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                        Chưa có món hàng nào
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                        >
                            {/* Item Image */}
                            <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="text-6xl text-gray-400">🖼️</div>
                                    </div>
                                )}
                            </div>

                            {/* Item Info */}
                            <div className="p-4">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 truncate">
                                    {item.name}
                                </h3>

                                {/* Category Badge */}
                                <div className="mb-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold">
                                        🖼️ Viền Avatar
                                    </span>
                                    {item.discontinued && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-md text-xs font-semibold ml-2">
                                            🚫 Ngưng bán
                                        </span>
                                    )}
                                </div>

                                {item.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                        {item.description}
                                    </p>
                                )}

                                {/* Price */}
                                <div className="flex items-center gap-2 mb-4">
                                    {item.currency === 'coins' ? (
                                        <>
                                            <CoinIcon size={20} />
                                            <span className="font-bold text-lg text-gray-900 dark:text-white">
                                                {item.price} Xu
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <GoldIcon size={20} />
                                            <span className="font-bold text-lg text-gray-900 dark:text-white">
                                                {item.price} Đồng Vàng
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span className="text-sm">✏️</span>
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item)}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span className="text-sm">🗑️</span>
                                            Xóa
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => toggleDiscontinued(item)}
                                        className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1 ${item.discontinued
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                                            }`}
                                    >
                                        <span className="text-sm">{item.discontinued ? '✓' : '🚫'}</span>
                                        {item.discontinued ? 'Mở bán lại' : 'Ngưng bán'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                                {editingItem ? 'Sửa Món Hàng' : 'Thêm Món Hàng Mới'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Hình ảnh món hàng
                                    </label>
                                    <div className="flex flex-col items-center gap-4">
                                        {imagePreview && (
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-48 h-48 object-cover rounded-lg"
                                            />
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="block w-full text-sm text-gray-500 dark:text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        dark:file:bg-blue-900 dark:file:text-blue-300"
                                        />
                                    </div>
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Tên món hàng *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Loại hàng *
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="avatar-border">🖼️ Viền Avatar</option>
                                    </select>
                                </div>

                                {/* Currency Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Loại tiền tệ *
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="coins"
                                                checked={formData.currency === 'coins'}
                                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <CoinIcon size={20} />
                                            <span className="text-gray-900 dark:text-white">Xu</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="gold"
                                                checked={formData.currency === 'gold'}
                                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <GoldIcon size={20} />
                                            <span className="text-gray-900 dark:text-white">Đồng Vàng</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Price */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Giá *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>



                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
                                        disabled={uploading}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={uploading}
                                    >
                                        {uploading ? 'Đang lưu...' : (editingItem ? 'Cập nhật' : 'Thêm mới')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
