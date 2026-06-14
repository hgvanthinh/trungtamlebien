import { useState } from 'react';
import { getDateKeyVN, getActiveWindow } from '../../services/gameSettingsService';
import CoinIcon from '../common/CoinIcon';

/**
 * Bảng cho heo ăn: 3 khung giờ cố định + lượt cho ăn thêm + mua nhanh đồ ăn bằng Xu
 */
export default function FeedPanel({ pig, settings, foodItem, userCoins, onFeed, onBuyFood, busy }) {
    const [quantity, setQuantity] = useState(1);

    const dateKey = getDateKeyVN();
    const activeWindow = getActiveWindow(settings);
    const nowTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());

    const extraUsed = pig.extraFeeds?.dateKey === dateKey ? pig.extraFeeds.count : 0;
    const extraLeft = Math.max(0, settings.maxExtraFeedsPerDay - extraUsed);

    const windowState = (w) => {
        if (pig.windowFeeds?.[w.id] === dateKey) return 'fed';      // đã ăn hôm nay
        if (activeWindow?.id === w.id) return 'open';                // đang mở
        if (nowTime > w.end) return 'closed';                        // đã qua
        return 'upcoming';                                           // chưa tới
    };

    const canFeedNow =
        (pig.food || 0) >= 1 &&
        ((activeWindow && pig.windowFeeds?.[activeWindow.id] !== dateKey) || extraLeft > 0);

    const foodPrice = foodItem?.price ?? 10;
    const totalCost = foodPrice * quantity;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🍽️ Cho heo ăn</h3>

            {/* Các khung giờ cố định */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                {settings.feedingWindows.map(w => {
                    const state = windowState(w);
                    const styles = {
                        fed: 'bg-green-100 dark:bg-green-900 border-green-400 text-green-700 dark:text-green-300',
                        open: 'bg-amber-100 dark:bg-amber-900 border-amber-400 text-amber-700 dark:text-amber-300 animate-pulse',
                        closed: 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500',
                        upcoming: 'bg-blue-50 dark:bg-blue-950 border-blue-300 text-blue-600 dark:text-blue-300'
                    };
                    const labels = { fed: '✓ Đã ăn', open: '🔔 Đang mở!', closed: 'Đã qua', upcoming: 'Chưa tới' };
                    return (
                        <div key={w.id} className={`border-2 rounded-xl p-3 text-center ${styles[state]}`}>
                            <p className="font-bold text-sm">{w.label || w.id}</p>
                            <p className="text-xs font-semibold">{w.start}–{w.end}</p>
                            <p className="text-xs mt-1 font-bold">{labels[state]}</p>
                        </div>
                    );
                })}
            </div>

            {/* Lượt cho ăn thêm */}
            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950 rounded-xl px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Lượt cho ăn thêm hôm nay (ngoài khung giờ)
                </span>
                <span className="font-bold text-purple-700 dark:text-purple-300">
                    {extraLeft}/{settings.maxExtraFeedsPerDay}
                </span>
            </div>

            {/* Nút cho ăn */}
            <button
                onClick={onFeed}
                disabled={busy || !canFeedNow}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all mb-5 ${canFeedNow && !busy
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white transform hover:scale-[1.02] shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {(pig.food || 0) < 1
                    ? '🌽 Hết đồ ăn — mua thêm bên dưới'
                    : canFeedNow
                        ? `🍽️ Cho ăn (+${settings.feedXpMin}–${settings.feedXpMax} XP)`
                        : '⏰ Hết lượt hôm nay — chờ khung giờ tiếp theo'}
            </button>

            {/* Mua nhanh đồ ăn */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900 dark:text-white">🌽 Mua thức ăn</h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        Bạn có: <CoinIcon size={16} /> <b>{userCoins}</b> xu
                    </span>
                </div>
                {foodItem ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center border-2 border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="px-3 py-2 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >−</button>
                            <span className="px-4 font-bold text-gray-900 dark:text-white">{quantity}</span>
                            <button
                                onClick={() => setQuantity(q => Math.min(99, q + 1))}
                                className="px-3 py-2 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >+</button>
                        </div>
                        <button
                            onClick={() => onBuyFood(quantity, foodItem)}
                            disabled={busy || userCoins < totalCost}
                            className={`flex-1 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${userCoins >= totalCost && !busy
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <CoinIcon size={18} />
                            {userCoins >= totalCost ? `Mua — ${totalCost} xu` : `Không đủ xu (cần ${totalCost})`}
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Cửa hàng chưa bán thức ăn heo. Chờ thầy thêm món "Thức ăn heo" vào Cửa Hàng nhé!
                    </p>
                )}
            </div>
        </div>
    );
}
