import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAvailableStoreItems } from '../services/storeService';
import { purchaseItem, userOwnsItem } from '../services/inventoryService';
import { useNavigate } from 'react-router-dom';
import CoinIcon from '../components/common/CoinIcon';
import GoldIcon from '../components/common/GoldIcon';
import Toast from '../components/common/Toast';

export default function Store() {
    const { userProfile, currentUser, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [filterCurrency, setFilterCurrency] = useState('all'); // 'all', 'coins', 'gold'
    const [ownedItems, setOwnedItems] = useState(new Set());
    const [toast, setToast] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            setLoading(true);
            const data = await getAvailableStoreItems();
            setItems(data);

            // Check which items user already owns
            if (currentUser) {
                const owned = new Set();
                for (const item of data) {
                    const owns = await userOwnsItem(currentUser.uid, item.id);
                    if (owns) {
                        owned.add(item.id);
                    }
                }
                setOwnedItems(owned);
            }
        } catch (error) {
            console.error('Error loading items:', error);
            alert('Lỗi khi tải danh sách món hàng');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (item) => {
        if (!currentUser) {
            setToast({ type: 'error', message: 'Vui lòng đăng nhập để mua hàng' });
            return;
        }

        // Check if user already owns this item
        if (ownedItems.has(item.id)) {
            setToast({ type: 'info', message: 'Bạn đã sở hữu món hàng này rồi!' });
            return;
        }

        // Check if user has enough currency
        const userCurrency = item.currency === 'coins'
            ? (userProfile?.coins || 0)
            : (userProfile?.gold || 0);

        if (userCurrency < item.price) {
            const currencyName = item.currency === 'coins' ? 'Xu' : 'Đồng Vàng';
            setToast({ type: 'error', message: `Bạn không đủ ${currencyName} để mua món hàng này!` });
            return;
        }

        // Show confirmation modal
        setConfirmModal({
            item,
            message: `Bạn có chắc muốn mua "${item.name}" với giá ${item.price} ${item.currency === 'coins' ? 'Xu' : 'Đồng Vàng'}?`
        });
    };

    const confirmPurchase = async () => {
        const item = confirmModal.item;
        setConfirmModal(null);

        try {
            setPurchasing(true);

            const result = await purchaseItem(currentUser.uid, item.id, {
                name: item.name,
                description: item.description,
                category: item.category,
                price: item.price,
                currency: item.currency,
                imageUrl: item.imageUrl
            });

            // Update local user profile
            updateUserProfile({
                coins: result.newCoins,
                gold: result.newGold
            });

            // Add to owned items
            setOwnedItems(prev => new Set([...prev, item.id]));

            setToast({ type: 'success', message: '🎉 Mua hàng thành công! Món hàng đã được thêm vào kho của bạn.' });
        } catch (error) {
            console.error('Error purchasing item:', error);
            setToast({ type: 'error', message: 'Lỗi khi mua hàng: ' + error.message });
        } finally {
            setPurchasing(false);
        }
    };

    const filteredItems = items.filter(item => {
        if (filterCurrency === 'all') return true;
        return item.currency === filterCurrency;
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
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    🏪 Cửa Hàng
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Sử dụng Xu hoặc Đồng Vàng để mua các món hàng
                </p>
            </div>

            {/* User Currency Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <CoinIcon size={30} />
                        <span className="text-lg font-semibold">Xu của bạn</span>
                    </div>
                    <p className="text-4xl font-bold">{userProfile?.coins || 0}</p>
                </div>

                <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <GoldIcon size={30} />
                        <span className="text-lg font-semibold">Đồng Vàng</span>
                    </div>
                    <p className="text-4xl font-bold">{userProfile?.gold || 0}</p>
                </div>

                <button
                    onClick={() => navigate('/inventory')}
                    className="bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 rounded-xl p-6 text-white shadow-lg transition-all transform hover:scale-105"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">📦</span>
                        <span className="text-lg font-semibold">Kho Hàng</span>
                    </div>
                    <p className="text-sm opacity-90">Xem món hàng đã mua</p>
                </button>
            </div>

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
                    Xu
                </button>
                <button
                    onClick={() => setFilterCurrency('gold')}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${filterCurrency === 'gold'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    <GoldIcon size={16} />
                    Đồng Vàng
                </button>
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                        Không có món hàng nào
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredItems.map((item) => {
                        const owned = ownedItems.has(item.id);
                        const canAfford = item.currency === 'coins'
                            ? (userProfile?.coins || 0) >= item.price
                            : (userProfile?.gold || 0) >= item.price;

                        return (
                            <div
                                key={item.id}
                                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all ${owned ? 'opacity-75' : ''
                                    }`}
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
                                    {owned && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                                            <span className="text-sm">✓</span>
                                            Đã sở hữu
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
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md text-xs font-semibold">
                                            🖼️ Viền Avatar
                                        </span>
                                        {item.discontinued && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-md text-xs font-semibold ml-2">
                                                🚫 Ngưng bán
                                            </span>
                                        )}
                                    </div>

                                    {/* Price */}
                                    <div className="flex items-center gap-2 mb-4">
                                        {item.currency === 'coins' ? (
                                            <>
                                                <CoinIcon size={20} />
                                                <span className={`font-bold text-lg ${canAfford ? 'text-gray-900 dark:text-white' : 'text-red-500'
                                                    }`}>
                                                    {item.price} Xu
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <GoldIcon size={20} />
                                                <span className={`font-bold text-lg ${canAfford ? 'text-gray-900 dark:text-white' : 'text-red-500'
                                                    }`}>
                                                    {item.price} Đồng Vàng
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Purchase Button */}
                                    <button
                                        onClick={() => handlePurchase(item)}
                                        disabled={purchasing || owned || !canAfford || (item.discontinued && !owned)}
                                        className={`w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${owned
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                                            : (item.discontinued && !owned)
                                                ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 cursor-not-allowed'
                                                : !canAfford
                                                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105'
                                            }`}
                                    >
                                        {owned ? (
                                            <>
                                                <span className="text-sm">✓</span>
                                                Đã mua
                                            </>
                                        ) : (item.discontinued && !owned) ? (
                                            <>
                                                <span className="text-sm">🚫</span>
                                                Ngưng bán
                                            </>
                                        ) : !canAfford ? (
                                            <>
                                                <span className="text-sm">🚫</span>
                                                Không đủ tiền
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm">🛒</span>
                                                Mua ngay
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Xác nhận mua hàng
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            {confirmModal.message}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmPurchase}
                                disabled={purchasing}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                                {purchasing ? 'Đang xử lý...' : 'Xác nhận'}
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
