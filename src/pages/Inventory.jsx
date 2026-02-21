import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserInventory, getInventoryStats, deleteInventoryItem } from '../services/inventoryService';
import { useNavigate } from 'react-router-dom';
import CoinIcon from '../components/common/CoinIcon';
import GoldIcon from '../components/common/GoldIcon';
import Toast from '../components/common/Toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function Inventory() {
    const { currentUser, userProfile, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const [inventory, setInventory] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterCurrency, setFilterCurrency] = useState('all'); // 'all', 'coins', 'gold'
    const [toast, setToast] = useState(null);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

    useEffect(() => {
        loadInventory();
    }, [currentUser]);

    const loadInventory = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [inventoryData, statsData] = await Promise.all([
                getUserInventory(currentUser.uid),
                getInventoryStats(currentUser.uid)
            ]);

            setInventory(inventoryData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading inventory:', error);
            setToast({ type: 'error', message: 'Lỗi khi tải kho hàng' });
        } finally {
            setLoading(false);
        }
    };

    const useAvatarBorder = async (item) => {
        if (!currentUser) return;

        try {
            const userRef = doc(db, 'users', currentUser.uid);

            // If already using this border, remove it
            const isCurrentlyActive = userProfile?.activeAvatarBorder === item.itemImageUrl;
            const newBorderValue = isCurrentlyActive ? null : item.itemImageUrl;

            await updateDoc(userRef, {
                activeAvatarBorder: newBorderValue
            });

            updateUserProfile({
                activeAvatarBorder: newBorderValue
            });

            if (isCurrentlyActive) {
                setToast({ type: 'success', message: `Đã ngưng sử dụng viền "${item.itemName}"` });
            } else {
                setToast({ type: 'success', message: `Đang sử dụng viền "${item.itemName}"!` });
            }
        } catch (error) {
            console.error('Error setting avatar border:', error);
            setToast({ type: 'error', message: 'Lỗi khi áp dụng viền avatar' });
        }
    };

    const handleDeleteItem = async (item) => {
        if (!currentUser) return;

        try {
            await deleteInventoryItem(currentUser.uid, item.id, {
                category: item.itemCategory,
                imageUrl: item.itemImageUrl
            });

            // If deleted item was active avatar border, update local state
            if (item.itemCategory === 'avatar-border' && userProfile?.activeAvatarBorder === item.itemImageUrl) {
                updateUserProfile({ activeAvatarBorder: null });
            }

            setToast({ type: 'success', message: `Đã xóa "${item.itemName}" khỏi kho hàng` });
            setDeleteConfirmModal(null);
            loadInventory(); // Reload inventory
        } catch (error) {
            console.error('Error deleting item:', error);
            setToast({ type: 'error', message: 'Lỗi khi xóa món hàng' });
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredInventory = inventory.filter(item => {
        if (filterCurrency === 'all') return true;
        return item.purchaseCurrency === filterCurrency;
    });

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
                        📦 Kho Hàng Của Tôi
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Các món hàng bạn đã mua
                    </p>
                </div>
                <button
                    onClick={() => navigate('/store')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
                >
                    <span className="text-xl">🛒</span>
                    Đi mua hàng
                </button>
            </div>

            {/* Statistics */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">📦</span>
                            <span className="text-lg font-semibold">Tổng món hàng</span>
                        </div>
                        <p className="text-4xl font-bold">{stats.totalItems}</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <CoinIcon size={30} />
                            <span className="text-lg font-semibold">Đã chi Xu</span>
                        </div>
                        <p className="text-4xl font-bold">{stats.totalSpentCoins}</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <GoldIcon size={30} />
                            <span className="text-lg font-semibold">Đã chi Đồng Vàng</span>
                        </div>
                        <p className="text-4xl font-bold">{stats.totalSpentGold}</p>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={() => setFilterCurrency('all')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${filterCurrency === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    Tất cả
                </button>
                <button
                    onClick={() => setFilterCurrency('coins')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${filterCurrency === 'coins'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    <CoinIcon size={16} />
                    Mua bằng Xu
                </button>
                <button
                    onClick={() => setFilterCurrency('gold')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${filterCurrency === 'gold'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    <GoldIcon size={16} />
                    Mua bằng Đồng Vàng
                </button>
            </div>

            {/* Inventory Grid */}
            {filteredInventory.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="text-6xl mb-4">📦</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                        {filterCurrency === 'all'
                            ? 'Kho hàng của bạn đang trống'
                            : `Bạn chưa mua món hàng nào bằng ${filterCurrency === 'coins' ? 'Xu' : 'Đồng Vàng'}`
                        }
                    </p>
                    <button
                        onClick={() => navigate('/store')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        Đi mua hàng ngay
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredInventory.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                        >
                            {/* Item Image */}
                            <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                                {item.itemImageUrl ? (
                                    <img
                                        src={item.itemImageUrl}
                                        alt={item.itemName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="text-6xl text-gray-400">🖼️</div>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                                    <span className="text-sm">✓</span>
                                    Đã sở hữu
                                </div>
                            </div>

                            {/* Item Info */}
                            <div className="p-4">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 truncate">
                                    {item.itemName}
                                </h3>

                                {/* Category Badge */}
                                <div className="mb-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md text-xs font-semibold">
                                        🖼️ Viền Avatar
                                    </span>
                                </div>

                                {/* Purchase Info */}
                                <div className="space-y-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        {item.purchaseCurrency === 'coins' ? (
                                            <>
                                                <CoinIcon size={16} />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    Đã mua với {item.purchasePrice} Xu
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <GoldIcon size={16} />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    Đã mua với {item.purchasePrice} Đồng Vàng
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-500 text-sm">📅</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatDate(item.purchasedAt)}
                                        </span>
                                    </div>
                                </div>

                                {/* Use Button for Avatar Borders */}
                                {item.itemCategory === 'avatar-border' ? (
                                    <button
                                        onClick={() => useAvatarBorder(item)}
                                        className={`w-full py-3 rounded-lg font-semibold transition-all ${userProfile?.activeAvatarBorder === item.itemImageUrl
                                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white transform hover:scale-105'
                                            }`}
                                    >
                                        {userProfile?.activeAvatarBorder === item.itemImageUrl ? 'Ngưng sử dụng' : 'Sử dụng'}
                                    </button>
                                ) : (
                                    <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 rounded-lg p-3 text-center">
                                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                            ✨ Món hàng của bạn
                                        </p>
                                    </div>
                                )}

                                {/* Delete Button */}
                                <button
                                    onClick={() => setDeleteConfirmModal(item)}
                                    className="w-full py-2 rounded-lg font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                >
                                    🗑️ Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="clay-card p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-4">
                            Xác nhận xóa
                        </h3>
                        <p className="text-[#556958] dark:text-[#a5b5a8] mb-6">
                            Bạn có chắc chắn muốn xóa <span className="font-bold">"{deleteConfirmModal.itemName}"</span> khỏi kho hàng?
                            {deleteConfirmModal.itemCategory === 'avatar-border' && userProfile?.activeAvatarBorder === deleteConfirmModal.itemImageUrl && (
                                <span className="block mt-2 text-orange-600 dark:text-orange-400">
                                    ⚠️ Viền avatar đang sử dụng sẽ bị gỡ bỏ.
                                </span>
                            )}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmModal(null)}
                                className="flex-1 py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDeleteItem(deleteConfirmModal)}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                            >
                                Xóa
                            </button>
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
