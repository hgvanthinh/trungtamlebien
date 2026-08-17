import { callMoneyFunction } from './moneyApi';

/**
 * Crafting Configuration - Risk/Reward System
 * Mỗi level có cost và success rate khác nhau
 * Reward: 1 Gold Coin per successful craft
 *
 * LƯU Ý: bảng này chỉ dùng để HIỂN THỊ và kiểm tra sơ bộ trên giao diện.
 * Bản gốc dùng để tính tiền nằm trong functions/index.js — sửa ở đây phải
 * sửa cả bên đó, nếu không server sẽ tính theo giá của nó.
 *
 * `successRate` ở đây là tỉ lệ CÔNG BỐ. Tỉ lệ server thực sự dùng để tung
 * xúc xắc giảm dần theo số Đồng Vàng học sinh đang giữ (cơ chế "chống giàu",
 * xem getEffectiveCraftRate trong functions/index.js). Đây là chủ ý — giao
 * diện giữ nguyên con số gốc, không hiển thị phần bị siết.
 */
const CRAFTING_LEVELS = {
  1: {
    name: 'An Toàn',
    cost: 200,
    successRate: 95,
    icon: 'shield',
    color: 'emerald',
    description: 'Tỷ lệ thành công cao nhất nhưng tốn nhiều xu'
  },
  2: {
    name: 'Rủi Ro',
    cost: 150,
    successRate: 75,
    icon: 'casino',
    color: 'blue',
    description: 'Cân bằng giữa chi phí và tỷ lệ thành công'
  },
  3: {
    name: 'Cân Bằng',
    cost: 100,
    successRate: 50,
    icon: 'balance',
    color: 'amber',
    description: 'Nửa may nửa rủi, chi phí vừa phải'
  },
  4: {
    name: 'Liều Mạng',
    cost: 50,
    successRate: 25,
    icon: 'local_fire_department',
    color: 'red',
    description: 'Rủi ro cao nhưng chi phí thấp nhất'
  }
};

/**
 * Get crafting configuration for all levels
 * @returns {Object} Crafting levels configuration
 */
export const getCraftingConfig = () => CRAFTING_LEVELS;

/**
 * Validate if user can perform crafting
 * @param {number} userCoins - Current user coins
 * @param {number} riskLevel - Risk level (1-4)
 * @param {number} quantity - Number of crafts
 * @returns {Object} Validation result with valid flag, totalCost, and config
 */
export const validateCrafting = (userCoins, riskLevel, quantity) => {
  const config = CRAFTING_LEVELS[riskLevel];

  if (!config) {
    return {
      valid: false,
      error: 'Invalid risk level',
      totalCost: 0,
      config: null
    };
  }

  const totalCost = config.cost * quantity;

  return {
    valid: userCoins >= totalCost && quantity > 0,
    totalCost,
    config,
    error: userCoins < totalCost ? 'Không đủ xu' : quantity <= 0 ? 'Số lượng không hợp lệ' : null
  };
};

/**
 * Calculate maximum quantity user can craft with current coins
 * @param {number} userCoins - Current user coins
 * @param {number} riskLevel - Risk level (1-4)
 * @returns {number} Maximum quantity
 */
export const calculateMaxQuantity = (userCoins, riskLevel) => {
  const config = CRAFTING_LEVELS[riskLevel];
  if (!config || userCoins <= 0) return 0;

  return Math.floor(userCoins / config.cost);
};

/**
 * Perform crafting operation (Main function)
 *
 * RNG và việc trừ Xu / cộng Vàng đều chạy TRÊN SERVER. Client chỉ gửi mức rủi
 * ro và số lượng muốn cược, rồi nhận kết quả về — không tự quyết thắng/thua,
 * cũng không tự ghi số dư (Firestore rules đã chặn).
 *
 * @param {string} _userId - giữ cho tương thích, server lấy uid từ token
 * @param {number} riskLevel - Risk level (1-4)
 * @param {number} quantity - Number of crafts
 * @returns {Promise<Object>} Result object with success/failed counts and new balances
 */
export const craftGold = async (_userId, riskLevel, quantity) => {
  const config = CRAFTING_LEVELS[riskLevel];
  if (!config) throw new Error('Invalid risk level');
  if (quantity <= 0) throw new Error('Quantity must be greater than 0');

  const data = await callMoneyFunction('craftGold', { riskLevel, quantity });

  return {
    success: data.success,
    failed: data.failed,
    quantity: data.quantity,
    isSuccess: data.isSuccess,
    totalCost: data.totalCost,
    goldGained: data.goldGained,
    newCoins: data.newCoins,
    newGold: data.newGold,
    oldCoins: data.oldCoins,
    oldGold: data.oldGold,
    riskLevel: data.riskLevel,
    levelName: data.levelName,
  };
};

/**
 * Get crafting statistics (for future features)
 * @param {Array} craftingHistory - Array of past crafting results
 * @returns {Object} Statistics object
 */
export const getCraftingStats = (craftingHistory = []) => {
  if (craftingHistory.length === 0) {
    return {
      totalCrafts: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalSpent: 0,
      totalGained: 0,
      successRate: 0
    };
  }

  const stats = craftingHistory.reduce((acc, craft) => {
    return {
      totalCrafts: acc.totalCrafts + craft.success + craft.failed,
      totalSuccess: acc.totalSuccess + craft.success,
      totalFailed: acc.totalFailed + craft.failed,
      totalSpent: acc.totalSpent + craft.totalCost,
      totalGained: acc.totalGained + craft.goldGained
    };
  }, {
    totalCrafts: 0,
    totalSuccess: 0,
    totalFailed: 0,
    totalSpent: 0,
    totalGained: 0
  });

  stats.successRate = ((stats.totalSuccess / stats.totalCrafts) * 100).toFixed(2);

  return stats;
};

export default {
  getCraftingConfig,
  validateCrafting,
  calculateMaxQuantity,
  craftGold,
  getCraftingStats
};
