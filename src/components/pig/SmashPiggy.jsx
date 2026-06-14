import { useState } from 'react';

/**
 * Đập heo đất: luôn trúng vàng (mức cao hoặc thấp), heo VỠ — phải mua heo mới.
 * Chỉ hiện khi có lượt đập (users.smashAttempts > 0) và đang có heo.
 */
export default function SmashPiggy({ smashAttempts, settings, onSmash, busy }) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const highPct = Math.round(settings.smashHighChance * 100);

    if (!smashAttempts || smashAttempts < 1) return null;

    return (
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">🔨 Đập Heo Đất!</h3>
                <span className="bg-white/25 px-3 py-1 rounded-full font-bold text-sm">
                    {smashAttempts} lượt
                </span>
            </div>
            <p className="text-sm mb-1">
                Chúc mừng! Heo của bạn lọt top tuần — bạn được đập heo lấy vàng:
            </p>
            <ul className="text-sm font-semibold mb-4 list-disc list-inside">
                <li>{highPct}% cơ hội nhận <b>{settings.smashHighGold} Đồng Vàng</b></li>
                <li>{100 - highPct}% cơ hội nhận <b>{settings.smashLowGold} Đồng Vàng</b></li>
            </ul>
            <p className="text-xs bg-white/20 rounded-lg px-3 py-2 mb-4">
                ⚠️ Đập xong heo sẽ <b>VỠ</b> — muốn nuôi tiếp phải mua heo mới ({settings.pigPrice} vàng) ở cửa hàng heo.
            </p>
            <button
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="w-full py-3 bg-white text-orange-600 rounded-xl font-extrabold text-lg hover:bg-orange-50 transition-all transform hover:scale-[1.02] shadow disabled:opacity-50"
            >
                🔨 ĐẬP NGAY!
            </button>

            {confirmOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-white">
                        <h3 className="text-xl font-bold mb-3">Xác nhận đập heo</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                            {highPct}% nhận <b>{settings.smashHighGold} vàng</b>, {100 - highPct}% nhận <b>{settings.smashLowGold} vàng</b>.
                        </p>
                        <p className="text-red-600 dark:text-red-400 font-semibold mb-5">
                            Heo của bạn sẽ VỠ và biến mất. Muốn nuôi tiếp phải mua heo mới!
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Để sau
                            </button>
                            <button
                                onClick={() => { setConfirmOpen(false); onSmash(); }}
                                disabled={busy}
                                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                🔨 Đập!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
