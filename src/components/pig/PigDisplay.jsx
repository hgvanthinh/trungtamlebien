import { getPigImage } from '../../config/pigAssets';

/**
 * Hiển thị heo: ảnh theo cấp, thanh XP, số đồ ăn
 */
export default function PigDisplay({ pig, settings, xpFloat }) {
    const xpPerLevel = settings.xpPerLevel;
    const xpInLevel = (pig.xp || 0) - ((pig.level || 1) - 1) * xpPerLevel;
    const progress = Math.min(100, (xpInLevel / xpPerLevel) * 100);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center relative overflow-hidden">
            {/* Badge cấp */}
            <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-1.5 rounded-full font-bold shadow">
                Cấp {pig.level || 1}
            </div>

            {/* Đồ ăn */}
            <div className="absolute top-4 right-4 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-4 py-1.5 rounded-full font-bold flex items-center gap-1">
                🌽 {pig.food || 0}
            </div>

            {/* Ảnh heo - cấp càng cao càng to */}
            <div className="relative inline-block mt-8 mb-4">
                <img
                    src={getPigImage(pig.level)}
                    alt={`Heo cấp ${pig.level}`}
                    className="mx-auto transition-all duration-500"
                    style={{ width: `${Math.min(160 + (pig.level - 1) * 30, 300)}px` }}
                />
                {/* +XP animation */}
                {xpFloat && (
                    <div
                        key={xpFloat.key}
                        className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl font-extrabold text-green-500 animate-bounce pointer-events-none"
                    >
                        +{xpFloat.amount} XP
                    </div>
                )}
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                🐷 Heo của {pig.ownerName || 'bạn'}
            </h2>

            {/* Thanh XP */}
            <div className="max-w-md mx-auto">
                <div className="flex justify-between text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    <span>XP: {pig.xp || 0}</span>
                    <span>{xpInLevel}/{xpPerLevel} lên cấp {(pig.level || 1) + 1}</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-700"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
