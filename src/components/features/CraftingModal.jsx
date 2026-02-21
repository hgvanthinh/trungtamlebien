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
import ForgeEffect from './ForgeEffect';
import GoldIcon from '../common/GoldIcon';

const CraftingModal = ({ isOpen, onClose }) => {
  const { currentUser, userProfile, updateUserProfile } = useContext(AuthContext);

  // State Management
  const [selectedLevel, setSelectedLevel] = useState(3); // Default: Cân Bằng
  const [quantity, setQuantity] = useState(1);
  const [isCrafting, setIsCrafting] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState(null);

  const config = getCraftingConfig();
  const selectedConfig = config[selectedLevel];
  const userCoins = userProfile?.coins || 0;

  // Validation
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

  // Handle Crafting - thời gian chế tạo = thời gian forge.wav
  const MIN_CRAFTING_DURATION = 7000; // 7 giây

  // Phát âm thanh chúc mừng khi rèn được vàng
  const playCongratsSound = () => {
    try {
      const audio = new Audio('/congratulations.wav');
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
      // Chạy song song: giao dịch Firestore + timer tối thiểu (7s = forge.wav)
      const [craftResult] = await Promise.all([
        craftGold(currentUser.uid, selectedLevel, quantity),
        new Promise(resolve => setTimeout(resolve, MIN_CRAFTING_DURATION))
      ]);

      setResult(craftResult);
      setShowResult(true);

      // Phát âm thanh chúc mừng nếu rèn được vàng
      if (craftResult.goldGained > 0) {
        playCongratsSound();
      }

      // Update local user profile
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
      setSelectedLevel(3);
      setQuantity(1);
      setError(null);
      setResult(null);
      setShowResult(false);
      onClose();
    }
  };

  // ===== RESULT MODAL - Phân biệt rõ Thành Công / Thất Bại =====
  if (showResult && result) {
    const hasGold = result.goldGained > 0;
    const successRate = ((result.success / (result.success + result.failed)) * 100).toFixed(1);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        {/* CSS cho hiệu ứng sparkle */}
        <style>{`
          @keyframes result-sparkle {
            0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
            50% { transform: scale(1) rotate(180deg); opacity: 1; }
          }
          @keyframes result-float-up {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes gold-shine {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes shake-fail {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
            20%, 40%, 60%, 80% { transform: translateX(3px); }
          }
          .result-card-success {
            border: 2px solid rgba(234, 179, 8, 0.4);
            box-shadow: 0 0 40px rgba(234, 179, 8, 0.15), 0 0 80px rgba(234, 179, 8, 0.08);
          }
          .result-card-fail {
            border: 2px solid rgba(239, 68, 68, 0.3);
            box-shadow: 0 0 40px rgba(239, 68, 68, 0.1);
          }
        `}</style>

        <div className={`clay-card max-w-lg w-full p-8 animate-scale-in relative overflow-hidden ${hasGold ? 'result-card-success' : 'result-card-fail'}`}>

          {/* Sparkle particles cho thành công */}
          {hasGold && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-yellow-400"
                  style={{
                    left: `${8 + (i * 7.5) % 85}%`,
                    top: `${10 + (i * 13) % 70}%`,
                    animation: `result-sparkle ${1.5 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`,
                    fontSize: `${10 + (i % 4) * 4}px`,
                  }}
                >
                  ✦
                </div>
              ))}
            </div>
          )}

          {/* === HEADER ICON === */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              {/* Glow background */}
              <div className={`absolute inset-[-12px] rounded-full blur-2xl opacity-40 animate-pulse ${hasGold
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                : 'bg-gradient-to-r from-red-500 to-orange-400'
                }`} />

              {/* Icon */}
              <div className={`relative p-6 rounded-full ${hasGold
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
          </div>

          {/* === TITLE === */}
          {hasGold ? (
            <h2
              className="text-2xl font-extrabold text-center mb-2"
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b, #fbbf24)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gold-shine 3s linear infinite',
              }}
            >
              🎉 Chế Tạo Thành Công!
            </h2>
          ) : (
            <h2
              className="text-2xl font-extrabold text-center mb-2 text-red-500 dark:text-red-400"
              style={{ animation: 'shake-fail 0.6s ease-in-out' }}
            >
              💔 Chế Tạo Thất Bại!
            </h2>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">
            {hasGold
              ? `Bạn đã rèn thành công ${result.goldGained} Đồng Vàng!`
              : 'Không có Đồng Vàng nào được tạo ra. Thử lại lần sau!'}
          </p>

          {/* === GOLD HIGHLIGHT (nếu thành công) === */}
          {hasGold && (
            <div
              className="mx-auto mb-5 p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-amber-800/30 border border-amber-200 dark:border-amber-700/50 text-center"
              style={{ animation: 'result-float-up 0.6s ease-out' }}
            >
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">Nhận được</p>
              <p className="text-4xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                +{result.goldGained} <GoldIcon size={36} />
              </p>
              <p className="text-sm font-semibold text-amber-500 dark:text-amber-300 mt-1">Đồng Vàng</p>
            </div>
          )}

          {/* === STATS CHI TIẾT === */}
          <div className="space-y-2 mb-5">
            {/* Thanh tỷ lệ thành công */}
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tỷ lệ thành công</span>
                <span className={`text-sm font-bold ${parseFloat(successRate) >= 50
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
                  }`}>
                  {successRate}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${parseFloat(successRate) >= 50
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                    : 'bg-gradient-to-r from-red-400 to-red-500'
                    }`}
                  style={{ width: `${successRate}%` }}
                />
              </div>
            </div>

            {/* Thành công / Thất bại */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <span className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Icon name="check_circle" className="text-base" filled />
                  Thành công
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {result.success}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <span className="text-sm text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <Icon name="cancel" className="text-base" filled />
                  Thất bại
                </span>
                <span className="font-bold text-red-700 dark:text-red-400">
                  {result.failed}
                </span>
              </div>
            </div>

            {/* Chi phí */}
            <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <span className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                <Icon name="paid" className="text-base" filled />
                Chi phí
              </span>
              <span className="font-bold text-yellow-700 dark:text-yellow-400">
                -{result.totalCost} Xu
              </span>
            </div>
          </div>

          {/* === SỐ DƯ SAU CHẾ TẠO === */}
          <div className="grid grid-cols-2 gap-2 mb-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Xu còn lại</p>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{result.newCoins}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">Tổng <GoldIcon size={12} /> Đồng Vàng</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{result.newGold}</p>
            </div>
          </div>

          {/* === CLOSE BUTTON === */}
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

  // Main Crafting Modal
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Hiệu ứng lò rèn khi đang chế tạo */}
      <ForgeEffect isActive={isCrafting} />

      <div className={`clay-card max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto relative z-10 transition-all duration-500 ${isCrafting ? 'shadow-[0_0_60px_rgba(255,100,0,0.3)]' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <Icon name="auto_awesome" className="text-white text-3xl" filled />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                🪄 Chế Tạo Đồng Vàng
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chuyển đổi Xu thành Đồng Vàng với các mức độ rủi ro khác nhau
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

        {/* Risk Level Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
            Chọn mức độ rủi ro
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(config).map(([level, cfg]) => {
              const isSelected = selectedLevel === parseInt(level);
              const colorMap = {
                emerald: 'from-emerald-500 to-green-500',
                blue: 'from-blue-500 to-cyan-500',
                amber: 'from-amber-500 to-yellow-500',
                red: 'from-red-500 to-pink-500'
              };

              return (
                <button
                  key={level}
                  onClick={() => {
                    setSelectedLevel(parseInt(level));
                    setError(null);
                  }}
                  disabled={isCrafting}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 disabled:opacity-50 ${isSelected
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-lg'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                >
                  {/* Icon with gradient */}
                  <div className={`inline-flex p-3 rounded-full bg-gradient-to-br ${colorMap[cfg.color]} mb-2`}>
                    <Icon name={cfg.icon} className="text-white text-2xl" filled />
                  </div>

                  {/* Name */}
                  <h4 className="font-bold text-gray-800 dark:text-white mb-1">
                    {cfg.name}
                  </h4>

                  {/* Success Rate */}
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                    {cfg.successRate}% thành công
                  </p>

                  {/* Cost */}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {cfg.cost} Xu
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Level Description */}
          <div className="mt-4 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <Icon name="info" className="text-base align-middle mr-1" />
              {selectedConfig.description}
            </p>
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
                const val = parseInt(e.target.value) || 1;
                setQuantity(Math.max(1, val));
                setError(null);
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

        {/* Magic Circle Animation (when crafting) */}
        {isCrafting && (
          <div className="mb-6 flex justify-center">
            <div className="relative w-32 h-32">
              {/* Outer rotating circle */}
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin"></div>

              {/* Inner glow */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 animate-pulse"></div>

              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon name="auto_awesome" className="text-purple-500 text-5xl animate-pulse" filled />
              </div>
            </div>
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
            💡 Mẹo: Các level có chi phí cao hơn sẽ có tỷ lệ thành công cao hơn!
          </p>
        </div>
      </div>
    </div>
  );
};

export default CraftingModal;
