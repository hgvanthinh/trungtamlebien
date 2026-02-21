import { useState, useContext } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { AuthContext } from '../../contexts/AuthContext';
import {
  getCraftingConfig,
  validateCrafting,
  calculateMaxQuantity,
  craftGold
} from '../../services/craftingService';
import ForgeEffect from '../features/ForgeEffect';
import GoldIcon from '../common/GoldIcon';

const EnhancedCraftingModal = ({ isOpen, onClose, preselectedLevel }) => {
  const { currentUser, userProfile, updateUserProfile } = useContext(AuthContext);

  // State Management
  const [selectedLevel, setSelectedLevel] = useState(preselectedLevel || 3);
  const [quantity, setQuantity] = useState(1);
  const [isCrafting, setIsCrafting] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState(null);

  const config = getCraftingConfig();
  const selectedConfig = config[selectedLevel];
  const userCoins = userProfile?.coins || 0;

  const validation = validateCrafting(userCoins, selectedLevel, quantity);
  const totalCost = validation.totalCost;
  const canCraft = validation.valid;

  if (!isOpen) return null;

  // Handle Max Quantity
  const handleMaxQuantity = () => {
    const maxQty = calculateMaxQuantity(userCoins, selectedLevel);
    if (maxQty > 0) {
      setQuantity(maxQty);
      setError(null);
    } else {
      setError('Không đủ xu để chế tạo');
    }
  };

  // Handle Crafting
  const MIN_CRAFTING_DURATION = 7000; // 7 seconds

  const playCongratsSound = () => {
    try {
      const audio = new Audio('/congratulations.wav');
      audio.volume = 0.5;
      audio.play().catch(() => { });
    } catch (e) { }
  };

  const playLostSound = () => {
    try {
      const audio = new Audio('/lost.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => { });
    } catch (e) { }
  };

  const handleCraft = async () => {
    if (!currentUser) {
      setError('Vui lòng đăng nhập để sử dụng tính năng này');
      return;
    }

    if (!canCraft) {
      setError(validation.error);
      return;
    }

    setIsCrafting(true);
    setError(null);

    try {
      const [craftResult] = await Promise.all([
        craftGold(currentUser.uid, selectedLevel, quantity),
        new Promise(resolve => setTimeout(resolve, MIN_CRAFTING_DURATION))
      ]);

      setResult(craftResult);
      setShowResult(true);

      if (craftResult.goldGained > 0) {
        playCongratsSound();
      } else {
        playLostSound();
      }

      if (updateUserProfile) {
        updateUserProfile({
          coins: craftResult.newCoins,
          gold: craftResult.newGold
        });
      }
    } catch (err) {
      console.error('Crafting error:', err);
      setError(err.message || 'Có lỗi xảy ra khi chế tạo');
    } finally {
      setIsCrafting(false);
    }
  };

  // Handle Close
  const handleClose = () => {
    if (!isCrafting) {
      setSelectedLevel(preselectedLevel || 3);
      setQuantity(1);
      setError(null);
      setResult(null);
      setShowResult(false);
      onClose();
    }
  };

  // Result Modal - Simplified Version
  if (showResult && result) {
    const hasGold = result.goldGained > 0;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`clay-card max-w-md w-full p-8 animate-scale-in`}>
          {/* Header Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className={`p-6 rounded-full ${hasGold
              ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500'
              : 'bg-gradient-to-br from-red-500 via-red-600 to-red-700'
              }`}>
              <Icon
                name={hasGold ? 'auto_awesome' : 'heart_broken'}
                className="text-white text-6xl"
                filled
              />
            </div>
          </div>

          {/* Title */}
          <h2 className={`text-2xl font-extrabold text-center mb-6 ${hasGold ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
            {hasGold ? '🎉 Chế Tạo Thành Công!' : '💔 Chế Tạo Thất Bại!'}
          </h2>

          {/* Stats Grid */}
          <div className="space-y-3 mb-6">
            {/* Đồng Vàng cược */}
            <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <GoldIcon size={16} />
                Đồng Vàng cược
              </span>
              <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                {result.quantity}
              </span>
            </div>

            {/* Chi phí */}
            <div className="flex justify-between items-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                <Icon name="paid" className="text-base" filled />
                Xu đã đặt cược
              </span>
              <span className="font-bold text-lg text-yellow-700 dark:text-yellow-400">
                -{result.totalCost} Xu
              </span>
            </div>

            {/* Xu còn lại */}
            <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Icon name="account_balance_wallet" className="text-base" filled />
                Xu còn lại
              </span>
              <span className="font-bold text-lg text-blue-700 dark:text-blue-400">
                {result.newCoins}
              </span>
            </div>

            {/* Kết quả đồng vàng */}
            <div className={`flex justify-between items-center p-4 rounded-xl ${hasGold
              ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20'
              : 'bg-gray-50 dark:bg-gray-800/50'
              }`}>
              <span className={`text-sm font-medium flex items-center gap-2 ${hasGold
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-400'
                }`}>
                <Icon name="stars" className="text-base" filled />
                {hasGold ? 'Vàng nhận được' : 'Vàng nhận được'}
              </span>
              <span className={`font-bold text-lg ${hasGold
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-400'
                }`}>
                {hasGold ? `+${result.goldGained}` : '0'}
              </span>
            </div>

            {/* Tổng Đồng Vàng hiện tại */}
            <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <GoldIcon size={16} />
                Tổng Đồng Vàng
              </span>
              <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                {result.newGold}
              </span>
            </div>
          </div>

          {/* Close Button */}
          <Button
            variant="primary"
            onClick={handleClose}
            className={`w-full ${hasGold
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'
              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
              }`}
          >
            {hasGold ? '🎉 Tuyệt vời!' : '💪 Thử lại'}
          </Button>
        </div>
      </div>
    );
  }

  // Main Crafting Modal with Flame Border and Burn Effect
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Forge Effect */}
      <ForgeEffect isActive={isCrafting} />

      {isCrafting ? (
        /* Crafting Animation - Full Screen Background with Forging.mp4 */
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#000000' }}>
          {/* Forging.mp4 - Centered */}
          <div className="relative flex items-center justify-center">
            <video
              src="/forging.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="max-w-full max-h-screen object-contain"
            />

            {/* Loading Bar Overlay */}
            <div className="absolute bottom-8 md:bottom-8 left-1/2 transform -translate-x-1/2 w-80 max-w-[90vw]">
              <div className="bg-gray-200 rounded-full h-4 overflow-hidden shadow-lg">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse"
                  style={{
                    animation: 'loading-progress 7s linear forwards'
                  }}
                />
              </div>
              <p className="text-center mt-3 mb-50 md:mb-0 text-white font-semibold text-lg">
                Đang chế tạo...
              </p>
            </div>
          </div>

          <style>{`
            @keyframes loading-progress {
              0% { width: 0%; }
              100% { width: 100%; }
            }
          `}</style>
        </div>
      ) : (
        /* Modal Form - Only shown when NOT crafting */
        <div className="relative max-w-3xl w-full">
          {/* Main Modal Card */}
          <div className="clay-card max-h-[90vh] overflow-y-auto relative z-10">
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                    <Icon name="auto_awesome" className="text-white text-3xl" filled />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      Chế Tạo Đồng Vàng
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedConfig.name} - {selectedConfig.successRate}% thành công
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  disabled={isCrafting}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
                >
                  <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Current Balance */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900/30 dark:to-amber-800/20">
                  <div className="flex items-center gap-3">
                    <Icon name="paid" className="text-yellow-600 dark:text-yellow-400 text-3xl" filled />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Xu hiện có</p>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {userCoins}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-200 dark:from-amber-900/30 dark:to-yellow-800/20">
                  <div className="flex items-center gap-3">
                    <GoldIcon size={30} />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Đồng Vàng</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {userProfile?.gold || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity Input */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
                  Số lượng
                </h3>

                <div className="flex gap-3">
                  <input
                    type="number"
                    min="1"
                    max={calculateMaxQuantity(userCoins, selectedLevel)}
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      const maxQty = calculateMaxQuantity(userCoins, selectedLevel);

                      // Allow empty string (when user deletes all)
                      if (val === '') {
                        setQuantity('');
                        setError(null);
                        return;
                      }

                      const numVal = parseInt(val);
                      if (!isNaN(numVal)) {
                        // Limit to max quantity
                        if (numVal > maxQty) {
                          setQuantity(maxQty);
                        } else if (numVal < 1) {
                          setQuantity(1);
                        } else {
                          setQuantity(numVal);
                        }
                      }
                      setError(null);
                    }}
                    onBlur={() => {
                      // When user leaves input, ensure it has valid value
                      if (quantity === '' || quantity < 1) {
                        setQuantity(1);
                      }
                    }}
                    disabled={isCrafting}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />

                  <Button
                    variant="outline"
                    onClick={handleMaxQuantity}
                    disabled={isCrafting || userCoins < selectedConfig.cost}
                    className="whitespace-nowrap"
                  >
                    <Icon name="trending_up" className="mr-1" />
                    Tối đa
                  </Button>
                </div>

                {/* Cost Display */}
                <div className="mt-3 flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400">Tổng chi phí:</span>
                  <span className="text-xl font-bold text-gray-800 dark:text-white">
                    {totalCost} Xu
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center gap-3">
                  <Icon name="error" className="text-red-600 dark:text-red-400" />
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isCrafting}
                  className="flex-1"
                >
                  Hủy
                </Button>

                <Button
                  variant="primary"
                  onClick={handleCraft}
                  disabled={!canCraft || isCrafting}
                  loading={isCrafting}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {isCrafting ? (
                    <>
                      <Icon name="autorenew" className="mr-2 animate-spin" />
                      Đang chế tạo...
                    </>
                  ) : (
                    <>
                      <Icon name="auto_awesome" className="mr-2" filled />
                      Chế Tạo
                    </>
                  )}
                </Button>
              </div>

              {/* Info Footer */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                  ⚠️ <strong>All-or-Nothing!</strong> {selectedConfig.successRate}% thành công → được hết <strong>{quantity} Đồng Vàng</strong>, {100 - selectedConfig.successRate}% thất bại → mất hết <strong>{totalCost} Xu</strong>!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCraftingModal;
