import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCraftingConfig } from '../../services/craftingService';
import EnhancedCraftingModal from './EnhancedCraftingModal';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Toast from '../common/Toast';

const CraftingTab = () => {
  const { userProfile } = useAuth();
  const [showCraftingModal, setShowCraftingModal] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [toast, setToast] = useState(null);

  const config = getCraftingConfig();
  const userCoins = userProfile?.coins || 0;

  const handleOpenCrafting = (level) => {
    const levelConfig = config[level];

    if (userCoins < levelConfig.cost) {
      setToast({
        type: 'warning',
        message: `Bạn cần ít nhất ${levelConfig.cost} Xu để chế tạo với mức ${levelConfig.name}! (Hiện có: ${userCoins} Xu)`
      });
      return;
    }

    setSelectedLevel(level);
    setShowCraftingModal(true);
  };

  const colorMap = {
    emerald: {
      gradient: 'from-emerald-500 to-green-500',
      bg: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
      border: 'border-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400'
    },
    blue: {
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      border: 'border-blue-500',
      text: 'text-blue-600 dark:text-blue-400'
    },
    amber: {
      gradient: 'from-amber-500 to-yellow-500',
      bg: 'from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20',
      border: 'border-amber-500',
      text: 'text-amber-600 dark:text-amber-400'
    },
    red: {
      gradient: 'from-red-500 to-pink-500',
      bg: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20',
      border: 'border-red-500',
      text: 'text-red-600 dark:text-red-400'
    }
  };

  return (
    <>
      {/* Info Banner */}
      <div className="clay-card p-6 mb-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border border-purple-200 dark:border-purple-800">
        <div className="flex gap-3">
          <Icon name="info" className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-[#111812] dark:text-white mb-2">
              Hướng dẫn chế tạo
            </h4>
            <ul className="text-sm text-[#608a67] dark:text-[#8ba890] space-y-1">
              <li>• Chọn mức độ rủi ro phù hợp với số Xu bạn có</li>
              <li>• Mức chi phí cao = Tỷ lệ thành công cao hơn</li>
              <li>• Chỉ 1 lần tung xúc xắc cho toàn bộ số lượng bạn chọn</li>
              <li>• <strong>Thắng</strong>: nhận được <strong>toàn bộ</strong> số Đồng Vàng đã đặt</li>
              <li>• <strong>Thua</strong>: mất <strong>toàn bộ</strong> Xu, không nhận Đồng Vàng nào</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Risk Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(config).map(([level, cfg]) => {
          const colors = colorMap[cfg.color];
          const canAfford = userCoins >= cfg.cost;
          const maxCrafts = Math.floor(userCoins / cfg.cost);

          return (
            <div
              key={level}
              className={`clay-card overflow-hidden transition-all hover:shadow-xl ${!canAfford ? 'opacity-50' : ''
                }`}
            >
              {/* Card Header with Gradient */}
              <div className={`p-6 bg-gradient-to-br ${colors.bg}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors.gradient}`}>
                    <Icon name={cfg.icon} className="text-white text-4xl" filled />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tỷ lệ thành công</p>
                    <p className={`text-3xl font-black ${colors.text}`}>
                      {cfg.successRate}%
                    </p>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-[#111812] dark:text-white mb-2">
                  {cfg.name}
                </h3>
                <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                  {cfg.description}
                </p>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="space-y-3 mb-4">
                  {/* Cost */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Icon name="paid" className="text-base" />
                      Chi phí mỗi lần
                    </span>
                    <span className="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                      {cfg.cost} Xu
                    </span>
                  </div>

                  {/* Max Crafts Available */}
                  {canAfford && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <Icon name="trending_up" className="text-base" />
                        Số lần tối đa
                      </span>
                      <span className="font-bold text-lg text-[#111812] dark:text-white">
                        {maxCrafts} lần
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  variant="primary"
                  onClick={() => handleOpenCrafting(parseInt(level))}
                  disabled={!canAfford}
                  className={`w-full bg-gradient-to-r ${colors.gradient} hover:opacity-90 disabled:opacity-50`}
                >
                  {canAfford ? (
                    <>
                      <Icon name="auto_awesome" className="mr-2" filled />
                      Bắt đầu chế tạo
                    </>
                  ) : (
                    <>
                      <Icon name="lock" className="mr-2" />
                      Không đủ xu
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enhanced Crafting Modal */}
      {showCraftingModal && selectedLevel && (
        <EnhancedCraftingModal
          isOpen={showCraftingModal}
          onClose={() => {
            setShowCraftingModal(false);
            setSelectedLevel(null);
          }}
          preselectedLevel={selectedLevel}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default CraftingTab;
