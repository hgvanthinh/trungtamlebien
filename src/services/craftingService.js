import { db } from '../config/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

/**
 * Crafting Configuration - Risk/Reward System
 * Mỗi level có cost và success rate khác nhau
 * Reward: 1 Gold Coin per successful craft
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
 * Uses client-side RNG for randomness + Firestore Transaction for data integrity
 *
 * @param {string} userId - User ID
 * @param {number} riskLevel - Risk level (1-4)
 * @param {number} quantity - Number of crafts
 * @returns {Promise<Object>} Result object with success/failed counts and new balances
 */
export const craftGold = async (userId, riskLevel, quantity) => {
  // Step 1: Get configuration
  const config = CRAFTING_LEVELS[riskLevel];

  if (!config) {
    throw new Error('Invalid risk level');
  }

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  // Step 2: Calculate total cost
  const totalCost = config.cost * quantity;

  // Step 3: Client-side RNG - Single roll for entire batch (all-or-nothing)
  // Chỉ tung 1 lần duy nhất cho toàn bộ số lượng:
  // Thắng → nhận TOÀN BỘ quantity đồng vàng
  // Thua  → mất TOÀN BỘ xu, nhận 0 đồng vàng
  const random = Math.random() * 100; // 0–100
  const isSuccess = random < config.successRate;
  const successCount = isSuccess ? quantity : 0;

  const results = [{
    attempt: 1,
    random: random.toFixed(2),
    success: isSuccess,
    quantity
  }];

  // Step 4: Firestore Transaction (Atomic update)
  const userRef = doc(db, 'users', userId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // Read current user document
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentCoins = userData.coins || 0;
      const currentGold = userData.gold || 0;

      // Re-validate (Protection against race conditions)
      if (currentCoins < totalCost) {
        throw new Error('Insufficient coins');
      }

      // Calculate new balances
      const newCoins = currentCoins - totalCost;
      const newGold = currentGold + successCount;

      // Update document atomically
      transaction.update(userRef, {
        coins: newCoins,
        gold: newGold,
        updatedAt: serverTimestamp()
      });

      // Return result for UI display
      return {
        success: isSuccess ? 1 : 0,   // 1 nếu thắng, 0 nếu thua
        failed: isSuccess ? 0 : 1,    // 0 nếu thắng, 1 nếu thua
        quantity,                      // Số lượng đồng vàng cược
        isSuccess,                     // Kết quả thắng/thua
        totalCost,
        goldGained: successCount,      // = quantity nếu thắng, = 0 nếu thua
        newCoins,
        newGold,
        oldCoins: currentCoins,
        oldGold: currentGold,
        riskLevel,
        levelName: config.name,
        results // Optional: for debugging
      };
    });

    console.log('✅ Crafting successful:', result);
    return result;

  } catch (error) {
    console.error('❌ Crafting failed:', error);

    // User-friendly error messages
    if (error.message === 'Insufficient coins') {
      throw new Error('Không đủ xu để chế tạo');
    } else if (error.message === 'User not found') {
      throw new Error('Không tìm thấy thông tin người dùng');
    } else {
      throw new Error('Lỗi khi chế tạo. Vui lòng thử lại sau.');
    }
  }
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
