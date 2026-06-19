import { useState, useEffect } from 'react';
import {
    getAllStoreItems,
    createStoreItem,
    updateStoreItem,
    deleteStoreItem,
    uploadItemImage,
    deleteItemImage,
    getStoreCategories,
    createStoreCategory
} from '../../services/storeService';
import { compressStoreImage } from '../../services/fileProcessingService';
import CoinIcon from '../../components/common/CoinIcon';
import GoldIcon from '../../components/common/GoldIcon';
import Toast from '../../components/common/Toast';

const CATEGORY_EMOJIS = [
    '🏷️', '🛍️', '🎁', '🎨', '👑', '🎀', '⭐', '✨',
    '🖼️', '🌽', '🍎', '🍬', '🧸', '🎮', '🎵', '📚',
    '⚽', '🎯', '💎', '🔥', '🌟', '🏆', '🎈', '🧩'
];

export default function AdminStore() {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryLabel, setNewCategoryLabel] = useState('');
    const [newCategoryEmoji, setNewCategoryEmoji] = useState('🏷️');

    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        currency: 'coins', // 'coins' or 'gold'
        category: 'avatar-border', // 'avatar-border'
        purchaseType: 'online', // 'online' or 'offline'
        discontinued: false, // true = ngưng bán
        imageUrl: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');

    useEffect(() => {
        loadItems();
        loadCategories();
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

    const loadCategories = async () => {
        try {
            const data = await getStoreCategories();
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
            setToast({ type: 'error', message: 'Lỗi khi tải danh sách loại hàng' });
        }
    };

    const getCategoryLabel = (key) => {
        const cat = categories.find(c => c.key === key);
        return cat ? `${cat.emoji} ${cat.label}` : key;
    };

    const filteredItems = filterCategory === 'all'
        ? items
        : items.filter(item => item.category === filterCategory);

    const handleAddCategory = async (e) => {
        e.preventDefault();

        const label = newCategoryLabel.trim();
        if (!label) {
            setToast({ type: 'error', message: 'Vui lòng nhập tên loại hàng' });
            return;
        }

        const key = label
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        if (categories.some(c => c.key === key)) {
            setToast({ type: 'error', message: 'Loại hàng này đã tồn tại' });
            return;
        }

        try {
            const created = await createStoreCategory({ key, label, emoji: newCategoryEmoji.trim() || '🏷️' });
            setCategories(prev => [...prev, created]);
            setFormData(prev => ({ ...prev, category: created.key }));
            setNewCategoryLabel('');
            setNewCategoryEmoji('🏷️');
            setShowAddCategory(false);
            setToast({ type: 'success', message: 'Thêm loại hàng thành công!' });
        } catch (error) {
            console.error('Error adding category:', error);
            setToast({ type: 'error', message: 'Lỗi khi thêm loại hàng' });
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

            // Upload new image if selected (nén trước khi upload — ảnh card nhỏ, max 800px)
            if (imageFile) {
                const tempId = editingItem?.id || `temp_${Date.now()}`;
                const compressedFile = await compressStoreImage(imageFile);
                imageUrl = await uploadItemImage(compressedFile, tempId);

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
            purchaseType: item.purchaseType || 'online',
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
            purchaseType: 'online',
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
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAddCategory(true)}
                        className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">🏷️</span>
                        Thêm Loại Hàng
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">➕</span>
                        Thêm Món Hàng
                    </button>
                </div>
            </div>

            {/* Filter by category */}
            <div className="mb-6 flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Lọc theo loại hàng:
                </label>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="all">Tất cả</option>
                    {categories.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                            {cat.emoji} {cat.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                        Chưa có món hàng nào
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg overflow-hidden transition-shadow"
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
                                        <div className="text-3xl text-gray-400">🖼️</div>
                                    </div>
                                )}
                            </div>

                            {/* Item Info */}
                            <div className="p-2">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 truncate">
                                    {item.name}
                                </h3>

                                {/* Category Badge */}
                                <div className="mb-1 flex flex-wrap gap-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold">
                                        {getCategoryLabel(item.category)}
                                    </span>
                                    {item.discontinued && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-[10px] font-semibold">
                                            🚫 Ngưng bán
                                        </span>
                                    )}
                                </div>

                                {/* Price */}
                                <div className="flex items-center gap-1 mb-2">
                                    {item.currency === 'coins' ? (
                                        <>
                                            <CoinIcon size={14} />
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                {item.price} Xu
                                            </span>
                                        </>
                                    ) : item.currency === 'gold' ? (
                                        <>
                                            <GoldIcon size={14} />
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                {item.price} Đồng Vàng
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm">💵</span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                {Number(item.price).toLocaleString('vi-VN')} VNĐ
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="space-y-1">
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                                        >
                                            ✏️ Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item)}
                                            className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                                        >
                                            🗑️ Xóa
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => toggleDiscontinued(item)}
                                        className={`w-full px-2 py-1 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${item.discontinued
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                                            }`}
                                    >
                                        {item.discontinued ? '✓ Mở bán lại' : '🚫 Ngưng bán'}
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
                                            <div className="relative">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="w-48 h-48 object-cover rounded-lg"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setImageFile(null);
                                                        setImagePreview('');
                                                        setFormData(prev => ({ ...prev, imageUrl: '' }));
                                                    }}
                                                    title="Xóa ảnh"
                                                    className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        <label
                                            htmlFor="store-item-image-upload"
                                            className="w-full flex flex-col items-center justify-center gap-1 px-4 py-6 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg
                        bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50
                        cursor-pointer transition-colors"
                                        >
                                            <span className="text-2xl">📤</span>
                                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                Bấm để tải ảnh lên
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Chọn ảnh từ máy tính (JPG, PNG...)
                                            </span>
                                        </label>
                                        <input
                                            id="store-item-image-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                {/* Name + Category */}
                                <div className="grid grid-cols-2 gap-4">
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

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Loại hàng *
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                category: e.target.value,
                                                // Thức ăn heo luôn mua bằng Xu theo luật game
                                                ...(e.target.value === 'pig-food' ? { currency: 'coins' } : {})
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat.key} value={cat.key}>
                                                    {cat.emoji} {cat.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Purchase Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Hình thức mua *
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="online"
                                                checked={formData.purchaseType === 'online'}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    purchaseType: e.target.value,
                                                    // VNĐ chỉ áp dụng cho mua trực tiếp
                                                    ...(formData.currency === 'vnd' ? { currency: 'coins' } : {})
                                                })}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <span className="text-gray-900 dark:text-white">🛒 Mua online</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="offline"
                                                checked={formData.purchaseType === 'offline'}
                                                onChange={(e) => setFormData({ ...formData, purchaseType: e.target.value })}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            <span className="text-gray-900 dark:text-white">🤝 Mua trực tiếp</span>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Mua trực tiếp: HS chỉ xem hàng trên Cửa Hàng, đến gặp admin để mua, admin trừ Xu/Vàng thủ công ở mục Vi Phạm.
                                    </p>
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
                                        {formData.purchaseType === 'offline' && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    value="vnd"
                                                    checked={formData.currency === 'vnd'}
                                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                                <span className="text-lg">💵</span>
                                                <span className="text-gray-900 dark:text-white">VNĐ</span>
                                            </label>
                                        )}
                                    </div>
                                    {formData.currency === 'vnd' && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            VNĐ chỉ dùng để hiển thị giá tham khảo, không trừ qua hệ thống.
                                        </p>
                                    )}
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

            {/* Add Category Modal */}
            {showAddCategory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Thêm Loại Hàng Mới
                            </h2>
                            <form onSubmit={handleAddCategory} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Biểu tượng loại hàng
                                    </label>
                                    <div className="grid grid-cols-8 gap-2">
                                        {CATEGORY_EMOJIS.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setNewCategoryEmoji(emoji)}
                                                className={`text-xl p-2 rounded-lg border transition-colors ${newCategoryEmoji === emoji
                                                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Tên loại hàng *
                                    </label>
                                    <input
                                        type="text"
                                        value={newCategoryLabel}
                                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddCategory(false);
                                            setNewCategoryLabel('');
                                            setNewCategoryEmoji('🏷️');
                                        }}
                                        className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        Thêm
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
