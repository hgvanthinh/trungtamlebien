const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

// Cấu hình region gần Việt Nam (Singapore)
const REGION = "asia-southeast1";

// ===== Helpers thời gian VN (chạy hoàn toàn trên server, không phụ thuộc client) =====
const getDateKeyVN = (date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);

const getTimeVN = (date = new Date()) =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);

const getWeekIdVN = (date = new Date()) => {
    const d = new Date(getDateKeyVN(date) + 'T00:00:00Z');
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getActiveWindow = (feedingWindows, date = new Date()) => {
    const time = getTimeVN(date);
    return feedingWindows.find(w => w.start <= time && time <= w.end) || null;
};

const DEFAULT_PIG_SETTINGS = {
    xpPerLevel: 50,
    feedXpMin: 1,
    feedXpMax: 5,
    feedingWindows: [
        { id: 'morning', label: 'Sáng', start: '06:00', end: '06:15' },
        { id: 'noon', label: 'Trưa', start: '11:45', end: '12:00' },
        { id: 'night', label: 'Tối', start: '21:30', end: '22:00' }
    ],
    maxExtraFeedsPerDay: 2,
};

const getPigSettings = async () => {
    const snap = await admin.firestore().doc('settings/pigGame').get();
    const data = snap.exists ? snap.data() : {};
    return {
        ...DEFAULT_PIG_SETTINGS,
        ...data,
        feedingWindows: data.feedingWindows?.length ? data.feedingWindows : DEFAULT_PIG_SETTINGS.feedingWindows,
    };
};

// ===== Helpers dùng chung cho các function xử lý TIỀN =====

/**
 * Xác thực Bearer token, trả về uid của người gọi.
 * Ném lỗi có .status để caller trả đúng mã HTTP.
 */
const ADMIN_EMAIL = 'admin@thaybien.com';

const requireAuth = async (req) => {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        const e = new Error('Chưa đăng nhập');
        e.status = 401;
        throw e;
    }
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return { uid: decoded.uid, email: decoded.email || '' };
    } catch {
        const e = new Error('Token không hợp lệ');
        e.status = 401;
        throw e;
    }
};

/**
 * Bọc một handler xử lý tiền: CORS + chỉ POST + xác thực.
 * uid LUÔN lấy từ token, không bao giờ từ body — client không thể giả danh.
 */
const moneyFunction = (handler) => onRequest({ region: REGION }, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ ok: false, error: 'Method not allowed' });
        }
        try {
            const { uid, email } = await requireAuth(req);
            const result = await handler({ uid, email, body: req.body || {}, db: admin.firestore() });
            // Dữ liệu nghiệp vụ nằm GỌN trong `data`, không spread ra ngoài:
            // craftGold trả về field `success` mang nghĩa "thắng/thua" (= 0 khi
            // thua), nếu trộn phẳng vào envelope thì nó ghi đè cờ trạng thái và
            // client hiểu nhầm mọi cú chế tạo thua là request thất bại.
            return res.status(200).json({ ok: true, data: result });
        } catch (error) {
            return res.status(error.status || 400).json({ ok: false, error: error.message });
        }
    });
});

const nowStamp = () => admin.firestore.FieldValue.serverTimestamp();

/** Tài khoản được coi là đã duyệt (đồng bộ với src/services/transferService.js) */
const isAccountApproved = (u) => {
    if (!u) return false;
    if (u.approved === true) return true;
    if (u.approved === false) return false;
    return Array.isArray(u.classes) && u.classes.length > 0;
};

/**
 * Cloud Function: Cho heo ăn — toàn bộ logic thời gian chạy server-side
 * để ngăn gian lận bằng cách đổi giờ/ngày trên thiết bị.
 * Client gửi: { uid, userName }
 */
exports.feedPig = onRequest({ region: REGION }, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { uid, userName } = req.body;
        if (!uid) return res.status(400).json({ success: false, error: 'Thiếu uid' });

        // Xác thực Firebase Auth token
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ success: false, error: 'Token không hợp lệ' });
        }
        if (decodedToken.uid !== uid) {
            return res.status(403).json({ success: false, error: 'Không có quyền' });
        }

        try {
            const db = admin.firestore();
            const settings = await getPigSettings();

            // Thời gian server — học sinh không thể can thiệp
            const now = new Date();
            const dateKey = getDateKeyVN(now);
            const weekId = getWeekIdVN(now);
            const activeWindow = getActiveWindow(settings.feedingWindows, now);

            const span = settings.feedXpMax - settings.feedXpMin + 1;
            const xpGained = settings.feedXpMin + Math.floor(Math.random() * span);
            const calcLevel = (xp) => Math.floor(xp / settings.xpPerLevel) + 1;

            const pigRef = db.collection('pigs').doc(uid);
            const userRef = db.collection('users').doc(uid);

            const result = await db.runTransaction(async (transaction) => {
                const pigDoc = await transaction.get(pigRef);
                if (!pigDoc.exists) throw new Error('Bạn chưa có heo!');

                const pig = pigDoc.data();
                if ((pig.food || 0) < 1) throw new Error('Hết đồ ăn! Hãy mua thức ăn cho heo.');

                const updates = {};
                let feedType;

                if (activeWindow && pig.windowFeeds?.[activeWindow.id] !== dateKey) {
                    feedType = 'feed_window';
                    updates.windowFeeds = { ...(pig.windowFeeds || {}), [activeWindow.id]: dateKey };
                } else {
                    const extra = pig.extraFeeds?.dateKey === dateKey
                        ? pig.extraFeeds
                        : { dateKey, count: 0 };
                    if (extra.count >= settings.maxExtraFeedsPerDay) {
                        throw new Error(
                            activeWindow
                                ? 'Khung giờ này heo đã ăn rồi và bạn đã hết lượt cho ăn thêm hôm nay!'
                                : 'Bạn đã hết lượt cho ăn thêm hôm nay! Chờ khung giờ cố định nhé.'
                        );
                    }
                    feedType = 'feed_extra';
                    updates.extraFeeds = { dateKey, count: extra.count + 1 };
                }

                const newXp = (pig.xp || 0) + xpGained;
                const newLevel = calcLevel(newXp);
                const leveledUp = newLevel > (pig.level || 1);

                transaction.update(pigRef, {
                    ...updates,
                    food: (pig.food || 0) - 1,
                    xp: newXp,
                    level: newLevel,
                    lastXpAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastFeedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                if (leveledUp) {
                    transaction.update(userRef, {
                        pigLevel: newLevel,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                const logRef = db.collection('pigGameLogs').doc();
                transaction.set(logRef, {
                    uid,
                    userName: userName || '',
                    type: feedType,
                    detail: { windowId: activeWindow?.id || null, xpGained, newXp, newLevel },
                    dateKey,
                    weekId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                return { xpGained, newXp, newLevel, leveledUp, newFood: (pig.food || 0) - 1 };
            });

            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    });
});

/**
 * Cloud Function: Reset mật khẩu học sinh
 * SỬ DỤNG CLOUD FUNCTION (Sensitive Operation - Bảo mật)
 * Chỉ admin mới có quyền gọi function này
 */
exports.resetStudentPassword = onRequest({ region: REGION }, (req, res) => {
  cors(req, res, async () => {
    try {
      // Chỉ cho phép POST request
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { adminToken, studentEmail, newPassword } = req.body;

      // Validate input
      if (!adminToken || !studentEmail || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Thiếu thông tin bắt buộc",
        });
      }

      // Kiểm tra admin token
      if (adminToken !== "admin_thaybien2025") {
        return res.status(403).json({
          success: false,
          error: "Không có quyền thực hiện thao tác này",
        });
      }

      // Validate mật khẩu mới
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: "Mật khẩu phải có ít nhất 6 ký tự",
        });
      }

      // Tìm user theo email
      const userRecord = await admin.auth().getUserByEmail(studentEmail);

      if (!userRecord) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy học sinh",
        });
      }

      // Reset mật khẩu
      await admin.auth().updateUser(userRecord.uid, {
        password: newPassword,
      });

      console.log(`✅ Password reset successful for ${studentEmail}`);

      return res.status(200).json({
        success: true,
        message: "Đã reset mật khẩu thành công",
      });
    } catch (error) {
      console.error("❌ Error resetting password:", error);

      let errorMessage = "Lỗi khi reset mật khẩu";

      if (error.code === "auth/user-not-found") {
        errorMessage = "Không tìm thấy học sinh";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email không hợp lệ";
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        details: error.message,
      });
    }
  });
});

/**
 * Cloud Function: Xóa tài khoản học sinh - OPTIMIZED
 * SỬ DỤNG CLOUD FUNCTION (Sensitive Operation - Bảo mật)
 * Xóa cả Auth user và Firestore document
 * Chỉ admin mới có quyền gọi function này
 * OPTIMIZATION: Sử dụng batch operations thay vì loop individual updates
 */
exports.deleteStudent = onRequest(
  {
    region: REGION,
    memory: "512MB",
    timeoutSeconds: 120,
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Chỉ cho phép POST request
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }

        const { adminToken, studentUid } = req.body;

        // Validate input
        if (!adminToken || !studentUid) {
          return res.status(400).json({
            success: false,
            error: "Thiếu thông tin bắt buộc",
          });
        }

        // Kiểm tra admin token
        if (adminToken !== "admin_thaybien2025") {
          return res.status(403).json({
            success: false,
            error: "Không có quyền thực hiện thao tác này",
          });
        }

        // Lấy thông tin user trước khi xóa (để xóa khỏi classes)
        const userDoc = await admin
          .firestore()
          .collection("users")
          .doc(studentUid)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const userClasses = userData.classes || [];

          // OPTIMIZED: Sử dụng batch operations thay vì loop
          if (userClasses.length > 0) {
            const batch = admin.firestore().batch();

            for (const classId of userClasses) {
              const classRef = admin
                .firestore()
                .collection("classes")
                .doc(classId);

              // Batch update: xóa student khỏi array và giảm count
              batch.update(classRef, {
                students: admin.firestore.FieldValue.arrayRemove(studentUid),
                studentCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            // Commit all class updates in 1 operation
            await batch.commit();
            console.log(
              `✅ Removed student from ${userClasses.length} classes via batch`
            );
          }
        }

        // Xóa user từ Firebase Auth
        await admin.auth().deleteUser(studentUid);

        // Xóa document từ Firestore
        await admin.firestore().collection("users").doc(studentUid).delete();

        console.log(`✅ Student deleted successfully: ${studentUid}`);

        return res.status(200).json({
          success: true,
          message: "Đã xóa tài khoản học sinh thành công",
        });
      } catch (error) {
        console.error("❌ Error deleting student:", error);

        let errorMessage = "Lỗi khi xóa tài khoản học sinh";

        if (error.code === "auth/user-not-found") {
          errorMessage = "Không tìm thấy học sinh";
        }

        return res.status(500).json({
          success: false,
          error: errorMessage,
          details: error.message,
        });
      }
    });
  }
);

// ============================================================================
// CÁC FUNCTION XỬ LÝ TIỀN (Xu / Đồng Vàng)
//
// Từ nay client KHÔNG được ghi trực tiếp coins/gold (xem firestore.rules).
// Mọi thay đổi số dư phải đi qua các function dưới đây, nơi server tự
// kiểm tra điều kiện, tự tung RNG và tự tính số tiền — client chỉ gửi ý định.
// ============================================================================

/** Cấu hình chế tạo — bản gốc phía server, client không sửa được */
const CRAFTING_LEVELS = {
    1: { name: 'An Toàn', cost: 200, successRate: 95 },
    2: { name: 'Rủi Ro', cost: 150, successRate: 75 },
    3: { name: 'Cân Bằng', cost: 100, successRate: 50 },
    4: { name: 'Liều Mạng', cost: 50, successRate: 25 },
};

const DEFAULT_TRANSFER_SETTINGS = { transferDailyLimit: 3, transferMaxAmount: 0 };

const getTransferSettings = async () => {
    const snap = await admin.firestore().doc('settings/pigGame').get();
    return { ...DEFAULT_TRANSFER_SETTINGS, ...(snap.exists ? snap.data() : {}) };
};

/**
 * Chuyển Xu/Vàng giữa 2 học sinh.
 * Server tự trừ người gửi + cộng người nhận trong 1 transaction.
 * Client gửi: { toUid, currency, amount }
 */
exports.transferCurrency = moneyFunction(async ({ uid, body, db }) => {
    const { toUid, currency } = body;
    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Số lượng phải là số nguyên dương');
    if (!toUid) throw new Error('Thiếu người nhận');
    if (uid === toUid) throw new Error('Không thể tự chuyển cho chính mình');
    if (currency !== 'coins' && currency !== 'gold') throw new Error('Loại tiền không hợp lệ');

    const settings = await getTransferSettings();
    if (settings.transferMaxAmount > 0 && amount > settings.transferMaxAmount) {
        throw new Error(`Mỗi lần chuyển tối đa ${settings.transferMaxAmount}`);
    }

    const fromRef = db.collection('users').doc(uid);
    const toRef = db.collection('users').doc(toUid);
    const dateKey = getDateKeyVN();

    return await db.runTransaction(async (t) => {
        const fromDoc = await t.get(fromRef);
        const toDoc = await t.get(toRef);
        if (!fromDoc.exists) throw new Error('Không tìm thấy tài khoản của bạn');
        if (!toDoc.exists) throw new Error('Không tìm thấy người nhận');

        const fromData = fromDoc.data();
        const toData = toDoc.data();
        if (!isAccountApproved(fromData)) throw new Error('Tài khoản của bạn chưa được admin duyệt, không thể chuyển khoản');
        if (!isAccountApproved(toData)) throw new Error('Tài khoản người nhận chưa được admin duyệt');

        const stats = fromData.transferStats?.dateKey === dateKey
            ? fromData.transferStats
            : { dateKey, count: 0 };
        if (stats.count >= settings.transferDailyLimit) {
            throw new Error(`Bạn đã hết lượt chuyển hôm nay (tối đa ${settings.transferDailyLimit} lần/ngày)`);
        }

        const balance = Number(fromData[currency]) || 0;
        if (balance < amount) {
            throw new Error(`Không đủ ${currency === 'coins' ? 'Xu' : 'Đồng Vàng'} để chuyển`);
        }

        t.update(fromRef, {
            [currency]: balance - amount,
            transferStats: { dateKey, count: stats.count + 1 },
            updatedAt: nowStamp(),
        });
        t.update(toRef, {
            [currency]: (Number(toData[currency]) || 0) + amount,
            updatedAt: nowStamp(),
        });
        t.set(db.collection('transfers').doc(), {
            fromUid: uid,
            fromName: fromData.fullName || fromData.username || '',
            toUid,
            toName: toData.fullName || toData.username || '',
            currency,
            amount,
            dateKey,
            createdAt: nowStamp(),
        });

        return {
            newBalance: balance - amount,
            transfersLeft: settings.transferDailyLimit - stats.count - 1,
        };
    });
});

/**
 * Chế tạo Đồng Vàng từ Xu.
 * RNG chạy TRÊN SERVER — client không quyết định được thắng/thua.
 * Client gửi: { riskLevel, quantity }
 */
exports.craftGold = moneyFunction(async ({ uid, body, db }) => {
    const riskLevel = Number(body.riskLevel);
    const quantity = Number(body.quantity);

    const config = CRAFTING_LEVELS[riskLevel];
    if (!config) throw new Error('Mức rủi ro không hợp lệ');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Số lượng không hợp lệ');

    const totalCost = config.cost * quantity;

    // Tung xúc xắc phía server, sau khi đã xác thực — không ai can thiệp được
    const roll = Math.random() * 100;
    const isSuccess = roll < config.successRate;
    const goldGained = isSuccess ? quantity : 0;

    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');

        const data = userDoc.data();
        const currentCoins = Number(data.coins) || 0;
        const currentGold = Number(data.gold) || 0;
        if (currentCoins < totalCost) throw new Error('Không đủ xu để chế tạo');

        const newCoins = currentCoins - totalCost;
        const newGold = currentGold + goldGained;

        t.update(userRef, { coins: newCoins, gold: newGold, updatedAt: nowStamp() });

        // Ghi log để rà soát về sau (scripts/audit-economy.cjs đọc collection này)
        t.set(db.collection('craftLogs').doc(), {
            uid,
            userName: data.fullName || data.username || '',
            riskLevel,
            levelName: config.name,
            quantity,
            totalCost,
            isSuccess,
            goldGained,
            dateKey: getDateKeyVN(),
            createdAt: nowStamp(),
        });

        return { newCoins, newGold, oldCoins: currentCoins, oldGold: currentGold };
    });

    return {
        success: isSuccess ? 1 : 0,
        failed: isSuccess ? 0 : 1,
        quantity,
        isSuccess,
        totalCost,
        goldGained,
        riskLevel,
        levelName: config.name,
        ...result,
    };
});

/**
 * Mua món hàng trong Cửa Hàng.
 * Giá lấy từ Firestore phía server — client không gửi giá lên được nữa.
 * Client gửi: { itemId }
 */
exports.purchaseItem = moneyFunction(async ({ uid, body, db }) => {
    const { itemId } = body;
    if (!itemId) throw new Error('Thiếu mã món hàng');

    const userRef = db.collection('users').doc(uid);
    const itemRef = db.collection('storeItems').doc(itemId);

    return await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        const itemDoc = await t.get(itemRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');
        if (!itemDoc.exists) throw new Error('Món hàng không tồn tại');

        const item = itemDoc.data();
        if (item.discontinued) throw new Error('Món hàng này đã ngừng bán');

        const price = Number(item.price) || 0;
        const currency = item.currency === 'gold' ? 'gold' : 'coins';
        const data = userDoc.data();
        const balance = Number(data[currency]) || 0;

        if (balance < price) {
            throw new Error(`Không đủ ${currency === 'coins' ? 'Xu' : 'Đồng Vàng'} để mua món hàng này`);
        }

        t.update(userRef, { [currency]: balance - price, updatedAt: nowStamp() });

        const invRef = db.collection('inventories').doc();
        const inventoryData = {
            userId: uid,
            itemId,
            itemName: item.name || '',
            itemDescription: item.description || '',
            itemCategory: item.category || '',
            itemImageUrl: item.imageUrl || '',
            purchasePrice: price,
            purchaseCurrency: currency,
            purchasedAt: admin.firestore.Timestamp.now(),
        };
        t.set(invRef, inventoryData);

        return {
            newCoins: currency === 'coins' ? balance - price : Number(data.coins) || 0,
            newGold: currency === 'gold' ? balance - price : Number(data.gold) || 0,
            inventoryItemId: invRef.id,
        };
    });
});

/**
 * Mua heo đất (trả bằng Đồng Vàng) và mua đồ ăn cho heo (trả bằng Xu).
 * Client gửi: { action: 'buy_pig' | 'buy_food', quantity? }
 */
exports.pigPurchase = moneyFunction(async ({ uid, body, db }) => {
    const { action } = body;
    const userRef = db.collection('users').doc(uid);
    const pigRef = db.collection('pigs').doc(uid);

    const settingsSnap = await db.doc('settings/pigGame').get();
    const settings = { pigPrice: 1, ...(settingsSnap.exists ? settingsSnap.data() : {}) };

    if (action === 'buy_pig') {
        // Grade đọc trước transaction (query ngoài không được nằm trong transaction read sau write)
        const userSnap = await userRef.get();
        if (!userSnap.exists) throw new Error('Không tìm thấy thông tin người dùng');
        const classes = Array.isArray(userSnap.data().classes) ? userSnap.data().classes : [];
        let grade = 0;
        if (classes.length > 0) {
            const classDoc = await db.collection('classes').doc(classes[0]).get();
            grade = parseInt(classDoc.exists ? classDoc.data().grade : 0) || 0;
        }
        if (grade <= 0) {
            throw new Error('Bạn chưa được xếp lớp nên chưa thể nuôi heo. Hãy liên hệ giáo viên để được thêm vào lớp!');
        }

        return await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const pigDoc = await t.get(pigRef);
            if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');
            if (pigDoc.exists) throw new Error('Bạn đã có heo đất rồi!');

            const data = userDoc.data();
            const gold = Number(data.gold) || 0;
            const price = Number(settings.pigPrice) || 0;
            if (gold < price) throw new Error(`Không đủ Đồng Vàng (cần ${price} vàng)`);

            t.update(userRef, { gold: gold - price, pigLevel: 1, updatedAt: nowStamp() });
            t.set(pigRef, {
                ownerUid: uid,
                ownerName: data.fullName || data.username || '',
                grade,
                xp: 0,
                level: 1,
                food: 0,
                lastXpAt: null,
                windowFeeds: {},
                extraFeeds: { dateKey: null, count: 0 },
                lastFeedAt: null,
                createdAt: nowStamp(),
                updatedAt: nowStamp(),
            });
            t.set(db.collection('pigGameLogs').doc(), {
                uid,
                userName: data.fullName || data.username || '',
                type: 'buy_pig',
                detail: { goldSpent: price },
                dateKey: getDateKeyVN(),
                weekId: getWeekIdVN(),
                createdAt: nowStamp(),
            });

            return { newGold: gold - price };
        });
    }

    if (action === 'buy_food') {
        const quantity = Number(body.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Số lượng không hợp lệ');

        // Đơn giá lấy từ storeItems phía server, không nhận từ client
        const foodSnap = await db.collection('storeItems')
            .where('category', '==', 'pig-food').limit(1).get();
        if (foodSnap.empty) throw new Error('Chưa có thức ăn nào được bán');
        const unitPrice = Number(foodSnap.docs[0].data().price) || 0;
        const totalCost = unitPrice * quantity;

        return await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const pigDoc = await t.get(pigRef);
            if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');
            if (!pigDoc.exists) throw new Error('Bạn chưa có heo! Hãy mua heo trước.');

            const data = userDoc.data();
            const coins = Number(data.coins) || 0;
            if (coins < totalCost) throw new Error(`Không đủ Xu (cần ${totalCost} xu)`);

            const newFood = (Number(pigDoc.data().food) || 0) + quantity;
            t.update(userRef, { coins: coins - totalCost, updatedAt: nowStamp() });
            t.update(pigRef, { food: newFood, updatedAt: nowStamp() });
            t.set(db.collection('pigGameLogs').doc(), {
                uid,
                userName: data.fullName || data.username || '',
                type: 'buy_food',
                detail: { quantity, coinsSpent: totalCost },
                dateKey: getDateKeyVN(),
                weekId: getWeekIdVN(),
                createdAt: nowStamp(),
            });

            return { newCoins: coins - totalCost, newFood };
        });
    }

    throw new Error('Hành động không hợp lệ');
});

/**
 * Đập heo đất — server tự tung RNG và tự trừ lượt đập.
 * Client gửi: {} (uid lấy từ token)
 */
exports.smashPiggy = moneyFunction(async ({ uid, db }) => {
    const settingsSnap = await db.doc('settings/pigGame').get();
    const settings = {
        smashHighChance: 0.75, smashHighGold: 10, smashLowGold: 5,
        ...(settingsSnap.exists ? settingsSnap.data() : {}),
    };

    const isHigh = Math.random() < settings.smashHighChance;
    const goldWon = isHigh ? settings.smashHighGold : settings.smashLowGold;

    const userRef = db.collection('users').doc(uid);
    const pigRef = db.collection('pigs').doc(uid);

    return await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        const pigDoc = await t.get(pigRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');

        const data = userDoc.data();
        const attempts = Number(data.smashAttempts) || 0;
        if (attempts < 1) throw new Error('Bạn không có lượt đập heo!');
        if (!pigDoc.exists) throw new Error('Bạn không có heo để đập!');

        const newGold = (Number(data.gold) || 0) + goldWon;
        t.update(userRef, {
            gold: newGold,
            smashAttempts: attempts - 1,
            pigLevel: 0,
            updatedAt: nowStamp(),
        });
        t.delete(pigRef);
        t.set(db.collection('pigGameLogs').doc(), {
            uid,
            userName: data.fullName || data.username || '',
            type: 'smash',
            detail: { isHigh, goldWon, pigLevel: pigDoc.data().level || 1 },
            dateKey: getDateKeyVN(),
            weekId: getWeekIdVN(),
            createdAt: nowStamp(),
        });

        return { isHigh, goldWon, attemptsLeft: attempts - 1, newGold };
    });
});

/**
 * Nhận thưởng Xu sau khi thắng trận Đấu Trí.
 * Server đọc kết quả trận từ versusMatchResults để xác minh người gọi đúng là
 * người thắng, và chỉ trả thưởng MỘT LẦN cho mỗi trận (docId = sessionId).
 * Client gửi: { sessionId }
 */
exports.claimVersusReward = moneyFunction(async ({ uid, body, db }) => {
    const { sessionId } = body;
    if (!sessionId) throw new Error('Thiếu mã trận đấu');

    const settingsSnap = await db.doc('settings/versusGame').get();
    const rawWin = settingsSnap.exists ? settingsSnap.data().winCoins : undefined;
    const winCoins = Number(rawWin ?? 5) || 0;
    if (winCoins <= 0) return { awarded: false, reason: 'no_reward_configured', coins: 0 };

    // Đọc kết quả trận TRƯỚC transaction (query không dùng được bên trong)
    const resultSnap = await db.collection('versusMatchResults')
        .where('sessionId', '==', sessionId).limit(1).get();
    if (resultSnap.empty) throw new Error('Không tìm thấy kết quả trận đấu');

    const result = resultSnap.docs[0].data();
    const winner = result.winnerUid || result.winnerId || result.winner;
    if (!winner) throw new Error('Trận đấu chưa có người thắng');
    if (winner !== uid) throw new Error('Bạn không phải người thắng trận này');
    if (result.forceStopped) throw new Error('Trận đấu bị dừng, không có thưởng');

    // docId = sessionId → chống nhận thưởng 2 lần cho cùng một trận
    const claimRef = db.collection('versusRewardClaims').doc(sessionId);
    const userRef = db.collection('users').doc(uid);

    return await db.runTransaction(async (t) => {
        const claimDoc = await t.get(claimRef);
        if (claimDoc.exists) throw new Error('Trận này đã nhận thưởng rồi');

        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');

        const newCoins = (Number(userDoc.data().coins) || 0) + winCoins;
        t.update(userRef, { coins: newCoins, updatedAt: nowStamp() });
        t.set(claimRef, { sessionId, uid, coins: winCoins, createdAt: nowStamp() });

        return { awarded: true, coins: winCoins, newCoins };
    });
});

/**
 * Cộng XP cho heo khi HS nộp bài "Dạy heo học".
 *
 * Chạy server-side vì XP heo dẫn tới lượt đập heo (ra Đồng Vàng): nếu để
 * client tự ghi XP thì HS bơm cấp heo để lọt top khối rồi lấy vàng.
 * Server tự đọc điểm từ examSubmissions và tự kiểm tra khung giờ — không tin
 * điểm số hay thời gian client gửi lên.
 *
 * Idempotent qua cờ pigXpAwarded trên submission.
 * Client gửi: { submissionId }
 */
exports.awardExamXp = moneyFunction(async ({ uid: callerUid, body, db, email }) => {
    const { submissionId } = body;
    if (!submissionId) throw new Error('Thiếu mã bài nộp');

    // Admin chấm bài hộ HS → được chỉ định chủ nhân bài làm.
    // HS thường luôn dùng uid của chính mình lấy từ token.
    const isAdmin = email === ADMIN_EMAIL;
    const uid = isAdmin && body.uid ? body.uid : callerUid;

    const settings = await getPigSettings();
    const xpPerLevel = Number(settings.xpPerLevel) || 50;

    const subRef = db.collection('examSubmissions').doc(submissionId);
    const pigRef = db.collection('pigs').doc(uid);

    // Đọc trước để lấy assignment (query/get ngoài không dùng được trong transaction sau write)
    const subSnap = await subRef.get();
    if (!subSnap.exists) return { awarded: false, reason: 'no_submission' };

    const sub = subSnap.data();
    if (sub.studentUid !== uid) throw new Error('Bài làm không khớp với học sinh');

    const assignmentId = sub.assignmentId;
    if (!assignmentId) return { awarded: false, reason: 'not_pig_teaching' };

    const asgSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!asgSnap.exists) return { awarded: false, reason: 'no_assignment' };

    const assignment = asgSnap.data();
    if (!assignment.isPigTeaching) return { awarded: false, reason: 'not_pig_teaching' };

    // Khung giờ tính theo thời điểm NỘP BÀI ghi trên server, không phải giờ máy HS
    const submittedAt = sub.submittedAt?.toDate ? sub.submittedAt.toDate() : new Date();
    const start = assignment.startTime?.toDate ? assignment.startTime.toDate() : null;
    const end = assignment.deadline?.toDate ? assignment.deadline.toDate() : null;
    if (start && submittedAt < start) return { awarded: false, reason: 'before_window' };
    if (end && submittedAt > end) return { awarded: false, reason: 'after_window' };

    return await db.runTransaction(async (t) => {
        const pigDoc = await t.get(pigRef);
        if (!pigDoc.exists) return { awarded: false, reason: 'no_pig' };

        const subDoc = await t.get(subRef);
        if (!subDoc.exists) return { awarded: false, reason: 'no_submission' };
        if (subDoc.data().pigXpAwarded) return { awarded: false, reason: 'already_awarded' };

        // Điểm lấy từ chính submission trên server.
        // Bài dạng upload chưa có maxScore (mặc định 0) → coi như thang 10,
        // giống fallback cũ ở trang chấm bài.
        const data = subDoc.data();
        const totalScore = Number(data.totalScore) || 0;
        const maxScore = Number(data.maxScore) || 10;
        const score10 = maxScore > 0 ? (totalScore / maxScore) * 10 : 0;
        const xpGained = Math.max(1, Math.min(10, Math.round(score10)));

        const pig = pigDoc.data();
        const newXp = (Number(pig.xp) || 0) + xpGained;
        const newLevel = Math.floor(newXp / xpPerLevel) + 1;
        const leveledUp = newLevel > (Number(pig.level) || 1);

        t.update(pigRef, {
            xp: newXp,
            level: newLevel,
            lastXpAt: nowStamp(),
            updatedAt: nowStamp(),
        });
        if (leveledUp) {
            t.update(db.collection('users').doc(uid), {
                pigLevel: newLevel,
                updatedAt: nowStamp(),
            });
        }
        t.update(subRef, { pigXpAwarded: true, pigXpAmount: xpGained });
        t.set(db.collection('pigGameLogs').doc(), {
            uid,
            userName: data.studentName || '',
            type: 'exam_xp',
            detail: { submissionId, xpGained, totalScore, maxScore, newXp, newLevel },
            dateKey: getDateKeyVN(),
            weekId: getWeekIdVN(),
            createdAt: nowStamp(),
        });

        return { awarded: true, xpGained, newXp, newLevel, leveledUp };
    });
});
