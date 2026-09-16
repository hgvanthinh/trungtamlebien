const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin
//
// databaseURL phải khai báo TƯỜNG MINH: Realtime Database của dự án nằm ở
// region asia-southeast1 nên URL không theo dạng mặc định
// (https://<projectId>.firebaseio.com) mà FIREBASE_CONFIG có thể suy ra.
// Thiếu dòng này thì admin.database() trong các function Đấu Trường sẽ trỏ
// sang một database không tồn tại và đọc về rỗng — trận nào cũng 0 điểm.
admin.initializeApp({
    databaseURL: "https://toanthaybien-2c3d2-default-rtdb.asia-southeast1.firebasedatabase.app",
});

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

// ===== "Chống giàu": tỉ lệ trúng giảm dần theo số Đồng Vàng đang giữ =====
//
// Giao diện vẫn hiển thị tỉ lệ gốc (95/75/50/25) — đây là tỉ lệ THỰC TẾ server
// dùng để tung xúc xắc. Càng giàu càng khó kiếm thêm vàng, nhưng không bao giờ
// chặn hẳn: HS vẫn tiến được, chỉ chậm dần.
//
// Mốc: <10 vàng giữ gốc → 10 vàng = MID → từ 30 vàng chạm sàn HIGH.
// Nội suy tuyến tính giữa các mốc để không có cú tụt đột ngột tại đúng con số.
const CRAFT_RATE_MID = { 1: 50, 2: 30, 3: 20, 4: 10 };
const CRAFT_RATE_HIGH = { 1: 25, 2: 20, 3: 10, 4: 5 };

const GOLD_SOFTCAP_START = 10;   // bắt đầu siết
const GOLD_SOFTCAP_FLOOR = 30;   // chạm sàn, không giảm nữa

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Tỉ lệ thành công thực tế khi chế tạo, theo số vàng đang giữ.
 * @param {number} riskLevel 1-4
 * @param {number} gold số Đồng Vàng hiện có
 * @returns {number} phần trăm (0-100)
 */
const getEffectiveCraftRate = (riskLevel, gold) => {
    const base = CRAFTING_LEVELS[riskLevel].successRate;
    const mid = CRAFT_RATE_MID[riskLevel];
    const high = CRAFT_RATE_HIGH[riskLevel];
    const g = Math.max(0, Number(gold) || 0);

    if (g <= 0) return base;
    if (g < GOLD_SOFTCAP_START) return lerp(base, mid, g / GOLD_SOFTCAP_START);
    if (g < GOLD_SOFTCAP_FLOOR) {
        const span = GOLD_SOFTCAP_FLOOR - GOLD_SOFTCAP_START;
        return lerp(mid, high, (g - GOLD_SOFTCAP_START) / span);
    }
    return high;
};

/**
 * Xác suất đập heo trúng mức CAO, cũng giảm theo số vàng đang giữ.
 * Đập heo luôn cho vàng (5 hoặc 10) nên đây là nguồn vàng lớn hơn cả chế tạo —
 * không siết thì HS giàu vẫn tăng vàng đều.
 */
const getEffectiveSmashChance = (baseChance, gold) => {
    const g = Math.max(0, Number(gold) || 0);
    if (g <= 0) return baseChance;
    if (g < GOLD_SOFTCAP_START) return lerp(baseChance, 0.40, g / GOLD_SOFTCAP_START);
    if (g < GOLD_SOFTCAP_FLOOR) {
        const span = GOLD_SOFTCAP_FLOOR - GOLD_SOFTCAP_START;
        return lerp(0.40, 0.15, (g - GOLD_SOFTCAP_START) / span);
    }
    return 0.15;
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
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');

        const data = userDoc.data();
        const currentCoins = Number(data.coins) || 0;
        const currentGold = Number(data.gold) || 0;
        if (currentCoins < totalCost) throw new Error('Không đủ xu để chế tạo');

        // Tung xúc xắc BÊN TRONG transaction, sau khi đã đọc số vàng thật:
        // tỉ lệ trúng phụ thuộc số vàng đang giữ nên phải chốt trên dữ liệu
        // vừa đọc, tránh dùng số cũ khi có 2 request gần nhau.
        const effectiveRate = getEffectiveCraftRate(riskLevel, currentGold);
        const roll = Math.random() * 100;
        const isSuccess = roll < effectiveRate;
        const goldGained = isSuccess ? quantity : 0;

        const newCoins = currentCoins - totalCost;
        const newGold = currentGold + goldGained;

        t.update(userRef, { coins: newCoins, gold: newGold, updatedAt: nowStamp() });

        // Ghi log để rà soát về sau (scripts/audit-economy.cjs đọc collection này).
        // Lưu cả tỉ lệ thực tế đã dùng để sau này còn kiểm chứng được.
        t.set(db.collection('craftLogs').doc(), {
            uid,
            userName: data.fullName || data.username || '',
            riskLevel,
            levelName: config.name,
            quantity,
            totalCost,
            isSuccess,
            goldGained,
            baseRate: config.successRate,
            effectiveRate: Math.round(effectiveRate * 10) / 10,
            goldBefore: currentGold,
            dateKey: getDateKeyVN(),
            createdAt: nowStamp(),
        });

        return {
            newCoins, newGold,
            oldCoins: currentCoins, oldGold: currentGold,
            isSuccess, goldGained,
        };
    });

    return {
        success: result.isSuccess ? 1 : 0,
        failed: result.isSuccess ? 0 : 1,
        quantity,
        totalCost,
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

        // Tung xúc xắc trong transaction: cơ hội trúng mức cao giảm dần theo
        // số vàng đang giữ. HS luôn nhận được vàng, chỉ là càng giàu càng hay
        // rơi vào mức thấp.
        const currentGold = Number(data.gold) || 0;
        const effectiveChance = getEffectiveSmashChance(settings.smashHighChance, currentGold);
        const isHigh = Math.random() < effectiveChance;
        const goldWon = isHigh ? settings.smashHighGold : settings.smashLowGold;

        const newGold = currentGold + goldWon;
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
            detail: {
                isHigh, goldWon,
                pigLevel: pigDoc.data().level || 1,
                goldBefore: currentGold,
                effectiveChance: Math.round(effectiveChance * 1000) / 1000,
            },
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

// ============================================================================
// ===== Game Đấu Trường (Arena) — quiz nhiều người chơi realtime =====
// ============================================================================
//
// NGUYÊN TẮC BẢO MẬT XUYÊN SUỐT KHỐI NÀY:
// Đáp án chỉ tồn tại ở Firestore `arenaSessions/{sessionId}` mà học sinh không
// đọc được (firestore.rules: allow read if isAdmin()). Realtime Database chỉ
// chứa bản đề ĐÃ LƯỢC ĐÁP ÁN. Vì vậy mọi việc cần biết đáp án — chấm điểm,
// vật phẩm 50/50, vật phẩm gợi ý đúng-sai — đều phải chạy ở đây.
//
// Không bao giờ trả đáp án đầy đủ về client, kể cả trong thông báo lỗi.

const DEFAULT_ARENA_SETTINGS = {
    abcdCount: 3,
    minPlayers: 5,
    rewards: { 1: 50, 2: 40, 3: 30, 4: 20, 5: 20 },
    dailyCapPoints: 100,
    doubleAllowedTypes: ['abcd', 'short_answer'],
};

// Bậc thang điểm câu đúng-sai: index = số ý đúng (0..4) → tỉ lệ điểm.
// Đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, đúng cả 4 ý = 100%.
const ARENA_TF_RATIO = [0, 0.1, 0.25, 0.5, 1];

const getArenaSettings = async (db) => {
    const snap = await db.doc('settings/arenaGame').get();
    const data = snap.exists ? snap.data() : {};
    return {
        ...DEFAULT_ARENA_SETTINGS,
        ...data,
        rewards: { ...DEFAULT_ARENA_SETTINGS.rewards, ...(data.rewards || {}) },
    };
};

/** Chuẩn hoá đáp án điền: bỏ khoảng trắng thừa, không phân biệt hoa thường */
const normalizeShortAnswer = (s) =>
    String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Chấm một câu hỏi. Trả về số điểm thô (chưa tính nhân đôi).
 *
 * Câu đúng-sai: ý KHÔNG trả lời phải tính là SAI. Dùng `?? null` để ý bỏ trống
 * không bao giờ khớp với boolean isTrue.
 */
const gradeArenaQuestion = (q, ans) => {
    if (!ans) return 0;
    const points = Number(q.points) || 0;

    if (q.type === 'true_false') {
        const statements = q.statements || [];
        const correct = statements.reduce(
            (acc, st, i) => acc + ((ans.tf?.[i] ?? null) === !!st.isTrue ? 1 : 0),
            0
        );
        const ratio = ARENA_TF_RATIO[correct] ?? 0;
        return points * ratio;
    }

    if (q.type === 'short_answer') {
        const given = normalizeShortAnswer(ans.text);
        if (!given) return 0;
        const pool = [q.correctAnswer, ...(q.alternativeAnswers || [])].map(normalizeShortAnswer);
        return pool.includes(given) ? points : 0;
    }

    // abcd — KHONG dung Number(ans.choice): Number(null) === 0 se bien
    // "khong tra loi" thanh "chon dap an A". Phai kiem tra kieu truoc.
    const correctIdx = (q.answers || []).findIndex((a) => a.isCorrect);
    if (correctIdx < 0) return 0;
    if (typeof ans.choice !== 'number' || !Number.isInteger(ans.choice)) return 0;
    return ans.choice === correctIdx ? points : 0;
};

/** Xáo mảng (Fisher-Yates) */
const shuffleArena = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

/** Thời lượng (giây) của câu thứ `index` theo cơ cấu đề chuẩn */
const arenaSecondsFor = (index, cfg) => {
    const abcdCount = Number(cfg.abcdCount ?? 3);
    if (index < abcdCount) return Number(cfg.abcdSeconds ?? 30);
    if (index === abcdCount) return Number(cfg.tfSeconds ?? 210);
    return Number(cfg.shortAnswerSeconds ?? 300);
};

/** Điểm tối đa của câu thứ `index` */
const arenaPointsFor = (index, cfg) => {
    const abcdCount = Number(cfg.abcdCount ?? 3);
    if (index < abcdCount) return Number(cfg.abcdPoints ?? 0.5);
    if (index === abcdCount) return Number(cfg.tfPoints ?? 2);
    return Number(cfg.shortAnswerPoints ?? 1);
};

/**
 * Chuyển câu hỏi kho đề sang định dạng arena (bản ĐẦY ĐỦ, còn đáp án).
 * Luôn giữ field `type` (kể cả abcd) vì arena trộn nhiều dạng trong một mảng.
 */
const toArenaQuestionServer = (q, index, cfg) => {
    const type = q.type || 'abcd';
    const isImage = q.inputMode === 'image';
    const base = {
        type,
        questionText: (q.questionText || '').trim() || (isImage ? 'Xem đề trong ảnh' : ''),
        questionImage: q.questionImage || '',
        points: arenaPointsFor(index, cfg),
        seconds: arenaSecondsFor(index, cfg),
    };

    if (type === 'true_false') {
        return {
            ...base,
            statements: (q.statements || []).map((st, i) => ({
                text: (st.text || '').trim() || `Ý ${String.fromCharCode(97 + i)})`,
                isTrue: !!st.isTrue,
            })),
        };
    }
    if (type === 'short_answer') {
        return {
            ...base,
            correctAnswer: q.correctAnswer || '',
            alternativeAnswers: q.alternativeAnswers || [],
        };
    }
    // abcd — xáo đáp án để mỗi trận vị trí đáp án đúng khác nhau
    return {
        ...base,
        answers: shuffleArena(
            (q.answers || []).map((a, i) => ({
                text: (a.text || '').trim() || String.fromCharCode(65 + i),
                isCorrect: !!a.isCorrect,
            }))
        ),
    };
};

/**
 * Lược đáp án — bản DUY NHẤT được phép lên Realtime Database.
 *
 * Mọi thay đổi ở đây phải cực kỳ cẩn thận: sót một field đáp án là học sinh
 * mở devtools đọc được và luôn đạt điểm tối đa.
 */
const stripArenaAnswers = (q) => {
    const base = {
        type: q.type,
        questionText: q.questionText || '',
        questionImage: q.questionImage || '',
        points: q.points,
        seconds: q.seconds,
    };
    if (q.type === 'true_false') {
        return { ...base, statements: (q.statements || []).map((st) => ({ text: st.text })) };
    }
    if (q.type === 'short_answer') return base;
    return { ...base, answers: (q.answers || []).map((a) => ({ text: a.text })) };
};

/**
 * Chủ phòng bấm "Sẵn sàng" — tạo trận đấu.
 *
 * PHẢI chạy server-side vì hai lý do:
 * 1. Kho câu hỏi (questionBank) chỉ admin đọc được, mà chủ phòng có thể là học sinh.
 * 2. Doc arenaSessions chứa ĐÁP ÁN nên client không được phép ghi.
 *
 * Server tự xác minh người gọi đúng là chủ phòng và phòng đủ người.
 *
 * Client gửi: { roomId }
 */
exports.startArenaMatch = moneyFunction(async ({ uid, body, db }) => {
    const { roomId } = body;
    if (!roomId) throw new Error('Thiếu mã phòng');

    const rtdb = admin.database();
    const roomRef = rtdb.ref(`arena_lobbies/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists()) throw new Error('Không tìm thấy phòng');

    const room = roomSnap.val();
    if (room.hostUid !== uid) throw new Error('Chỉ chủ phòng mới bắt đầu được trận');
    if (room.status !== 'open') throw new Error('Trận đã bắt đầu rồi');

    const cfg = await getArenaSettings(db);
    const players = room.players || {};
    const playerUids = Object.keys(players);
    const minPlayers = Number(room.minPlayers || cfg.minPlayers || 5);
    if (playerUids.length < minPlayers) {
        throw new Error(`Cần ít nhất ${minPlayers} người mới bắt đầu được`);
    }

    // ===== Random đề theo cơ cấu: 3 ABCD + 1 đúng-sai + 1 điền =====
    const folderId = room.folderId || null;
    const bankSnap = await db.collection('questionBank').where('folderId', '==', folderId).get();

    const byType = { abcd: [], true_false: [], short_answer: [] };
    bankSnap.docs.forEach((d) => {
        const q = d.data();
        const type = q.type || 'abcd';
        if (byType[type]) byType[type].push(q);
    });

    const abcdCount = Number(cfg.abcdCount ?? 3);
    if (byType.abcd.length < abcdCount || byType.true_false.length < 1 || byType.short_answer.length < 1) {
        throw new Error('Thư mục đề không đủ câu hỏi theo cơ cấu (3 trắc nghiệm + 1 đúng-sai + 1 điền đáp án)');
    }

    const picked = [
        ...shuffleArena(byType.abcd).slice(0, abcdCount),
        shuffleArena(byType.true_false)[0],
        shuffleArena(byType.short_answer)[0],
    ];
    const questions = picked.map((q, i) => toArenaQuestionServer(q, i, cfg));

    // ===== Ghi dữ liệu =====
    const sessionId = rtdb.ref('arena_sessions').push().key;
    const playerNames = {};
    playerUids.forEach((pid) => {
        playerNames[pid] = players[pid].name || '';
    });

    // 1. Firestore: đề ĐẦY ĐỦ + đáp án (học sinh không đọc được)
    await db.doc(`arenaSessions/${sessionId}`).set({
        roomId,
        folderId,
        teacherId: room.teacherId || null,
        status: 'running',
        playerCount: playerUids.length,
        playerUids,
        playerNames,
        questions,
        createdAt: nowStamp(),
    });

    // 2. RTDB: đề đã LƯỢC ĐÁP ÁN + đồng hồ.
    // Dùng Date.now() của SERVER làm mốc — đây chính là thời gian mà
    // /.info/serverTimeOffset của client được hiệu chỉnh theo.
    const now = Date.now();
    const countdownMs = Number(cfg.countdownSeconds ?? 5) * 1000;
    const publicQuestions = {};
    questions.forEach((q, i) => {
        publicQuestions[i] = stripArenaAnswers(q);
    });

    await rtdb.ref(`arena_sessions/${sessionId}`).set({
        meta: {
            roomId,
            status: 'running',
            questionIndex: 0,
            phase: 'question',
            startedAt: now + countdownMs,
            // Mốc bắt đầu câu, ghi tường minh: deadline có thể bị rút ngắn khi
            // cả phòng trả lời xong, nên không suy ngược từ questionEndsAt được.
            questionStartsAt: now + countdownMs,
            questionEndsAt: now + countdownMs + questions[0].seconds * 1000,
            questionSeconds: questions[0].seconds,
            phaseEndsAt: null,
            totalQuestions: questions.length,
            playerCount: playerUids.length,
        },
        questions: publicQuestions,
    });

    // 3. Đưa cả phòng vào trận (client đang nghe node phòng sẽ tự chuyển màn)
    await roomRef.update({
        status: 'running',
        sessionId,
        countdownEndsAt: now + countdownMs,
        lastActivityAt: now,
    });
    try {
        await rtdb.ref(`arena_open_rooms/${roomId}/status`).set('running');
    } catch {
        // phòng đã bị đóng, bỏ qua
    }

    return { sessionId, totalQuestions: questions.length };
});

/**
 * Bắt đầu một lượt LUYỆN TẬP một mình.
 *
 * Khác trận thi đấu: không phòng chờ, không đối thủ, không vật phẩm. HS vào lúc
 * nào cũng được, miễn đúng khối mà phòng cho phép. Mỗi lượt là một session
 * riêng, đề random lại từ đầu.
 *
 * Trần lượt/ngày kiểm ở đây (trước khi tạo đề) để HS không tốn công làm xong
 * mới biết là không được tính.
 *
 * Client gửi: { roomId }
 */
exports.startArenaPractice = moneyFunction(async ({ uid, body, db }) => {
    const { roomId } = body;
    if (!roomId) throw new Error('Thiếu mã phòng');

    const rtdb = admin.database();
    const roomSnap = await rtdb.ref(`arena_lobbies/${roomId}`).get();
    if (!roomSnap.exists()) throw new Error('Không tìm thấy phòng');

    const room = roomSnap.val();
    if (room.mode !== 'practice') throw new Error('Phòng này không phải phòng luyện tập');
    if (room.status === 'closed') throw new Error('Phòng đã đóng');

    const cfg = await getArenaSettings(db);

    // ===== Kiểm tra điều kiện của học sinh =====
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) throw new Error('Không tìm thấy thông tin học sinh');
    const user = userSnap.data();

    // Phòng giới hạn khối thì chỉ HS đúng khối mới vào luyện được
    if (room.grade && Number(user.gradeLevel) !== Number(room.grade)) {
        throw new Error(`Phòng này chỉ dành cho khối ${room.grade}`);
    }

    const dateKey = getDateKeyVN();
    const maxPerDay = Number(cfg.practiceMaxPerDay ?? 10);
    const stats = user.arenaPracticeStats || {};
    const usedToday = stats.dateKey === dateKey ? Number(stats.count) || 0 : 0;
    if (maxPerDay > 0 && usedToday >= maxPerDay) {
        throw new Error(`Hôm nay bạn đã luyện đủ ${maxPerDay} lượt rồi, mai quay lại nhé!`);
    }

    // ===== Random đề theo đúng cơ cấu của trận thi đấu =====
    const folderId = room.folderId || null;
    const bankSnap = await db.collection('questionBank').where('folderId', '==', folderId).get();

    const byType = { abcd: [], true_false: [], short_answer: [] };
    bankSnap.docs.forEach((d) => {
        const q = d.data();
        const type = q.type || 'abcd';
        if (byType[type]) byType[type].push(q);
    });

    const abcdCount = Number(cfg.abcdCount ?? 3);
    if (byType.abcd.length < abcdCount || byType.true_false.length < 1 || byType.short_answer.length < 1) {
        throw new Error('Thư mục đề không đủ câu hỏi theo cơ cấu');
    }

    const picked = [
        ...shuffleArena(byType.abcd).slice(0, abcdCount),
        shuffleArena(byType.true_false)[0],
        shuffleArena(byType.short_answer)[0],
    ];
    const questions = picked.map((q, i) => toArenaQuestionServer(q, i, cfg));

    // ===== Ghi phiên =====
    const sessionId = rtdb.ref('arena_sessions').push().key;
    const playerName = user.fullName || 'Học sinh';

    await db.doc(`arenaSessions/${sessionId}`).set({
        roomId,
        mode: 'practice',
        folderId,
        teacherId: room.teacherId || null,
        status: 'running',
        playerCount: 1,
        playerUids: [uid],
        playerNames: { [uid]: playerName },
        questions,
        createdAt: nowStamp(),
    });

    // Đếm lượt NGAY khi tạo đề, không đợi nộp bài: nếu đếm lúc chấm thì HS
    // thoát giữa chừng rồi vào lại sẽ luyện được vô hạn.
    await db.doc(`users/${uid}`).update({
        arenaPracticeStats: { dateKey, count: usedToday + 1 },
        updatedAt: nowStamp(),
    });

    const now = Date.now();
    const countdownMs = Number(cfg.countdownSeconds ?? 5) * 1000;
    const publicQuestions = {};
    questions.forEach((q, i) => {
        publicQuestions[i] = stripArenaAnswers(q);
    });

    await rtdb.ref(`arena_sessions/${sessionId}`).set({
        meta: {
            roomId,
            mode: 'practice',
            status: 'running',
            questionIndex: 0,
            phase: 'question',
            startedAt: now + countdownMs,
            questionStartsAt: now + countdownMs,
            questionEndsAt: now + countdownMs + questions[0].seconds * 1000,
            questionSeconds: questions[0].seconds,
            phaseEndsAt: null,
            totalQuestions: questions.length,
            playerCount: 1,
        },
        questions: publicQuestions,
    });

    return {
        sessionId,
        totalQuestions: questions.length,
        usedToday: usedToday + 1,
        maxPerDay,
    };
});

/**
 * Dựng phần "xem lại đáp án" cho một lượt luyện tập ĐÃ CHẤM XONG.
 *
 * Chỉ gọi sau khi chấm — trả đáp án đúng ra ngoài lúc đang làm bài thì hỏng
 * toàn bộ nguyên tắc bảo mật của khối này.
 */
const buildPracticeReview = (questions, answers) => {
    return questions.map((q, i) => {
        const ans = answers[i] || null;
        const earned = gradeArenaQuestion(q, ans);
        const base = {
            index: i,
            type: q.type,
            questionText: q.questionText || '',
            questionImage: q.questionImage || '',
            points: q.points,
            earned: Math.round(earned * 100) / 100,
        };

        if (q.type === 'true_false') {
            return {
                ...base,
                statements: (q.statements || []).map((st, si) => ({
                    text: st.text,
                    isTrue: !!st.isTrue,
                    chosen: ans?.tf?.[si] ?? null,
                })),
            };
        }
        if (q.type === 'short_answer') {
            return {
                ...base,
                correctAnswer: q.correctAnswer || '',
                alternativeAnswers: q.alternativeAnswers || [],
                given: ans?.text ?? '',
            };
        }
        return {
            ...base,
            answers: (q.answers || []).map((a) => ({ text: a.text, isCorrect: !!a.isCorrect })),
            chosen: typeof ans?.choice === 'number' ? ans.choice : null,
        };
    });
};

/**
 * Chấm một lượt luyện tập và cộng điểm tích luỹ.
 *
 * Khác trận thi đấu ở hai chỗ:
 * 1. Điểm tích luỹ = ĐÚNG BẰNG điểm bài làm (được 5đ thì cộng 5đ), không theo
 *    thứ hạng. Vẫn chịu chung trần `dailyCapPoints` với thi đấu.
 * 2. Trả về ĐÁP ÁN ĐÚNG để HS xem lại mình sai ở đâu — chỉ trả sau khi đã chấm
 *    xong nên không lộ đề lúc đang làm.
 *
 * Idempotent: gọi lại trả về đúng kết quả đã chốt, không cộng điểm hai lần.
 *
 * Client gửi: { sessionId }
 */
exports.finalizeArenaPractice = moneyFunction(async ({ uid, body, db }) => {
    const { sessionId } = body;
    if (!sessionId) throw new Error('Thiếu mã lượt luyện tập');

    const sessionRef = db.doc(`arenaSessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new Error('Không tìm thấy lượt luyện tập');

    const session = sessionSnap.data();
    if (session.mode !== 'practice') throw new Error('Đây không phải lượt luyện tập');
    if (!(session.playerUids || []).includes(uid)) throw new Error('Bạn không làm lượt này');

    const rtdb = admin.database();
    const sessionPath = `arena_sessions/${sessionId}`;
    const questions = session.questions || [];

    // Đã chấm rồi → trả lại kết quả cũ, tuyệt đối không cộng điểm lần nữa
    if (session.practiceResult) {
        return {
            ...session.practiceResult,
            review: buildPracticeReview(questions, session.lastAnswers || {}),
        };
    }

    const [metaSnap, answersSnap] = await Promise.all([
        rtdb.ref(`${sessionPath}/meta`).get(),
        rtdb.ref(`${sessionPath}/answers/${uid}`).get(),
    ]);

    const meta = metaSnap.val() || {};
    const finished = meta.status === 'grading' || meta.status === 'finished';
    if (!finished && Date.now() < Number(meta.questionEndsAt || 0)) {
        throw new Error('Lượt luyện tập chưa kết thúc');
    }

    const answers = answersSnap.val() || {};

    let score = 0;
    questions.forEach((q, i) => {
        score += gradeArenaQuestion(q, answers[i]);
    });
    score = Math.round(score * 100) / 100;

    // ===== Cộng điểm tích luỹ = đúng bằng điểm bài làm =====
    const cfg = await getArenaSettings(db);
    const cap = Number(cfg.dailyCapPoints ?? 100);
    const dateKey = getDateKeyVN();
    const userRef = db.doc(`users/${uid}`);

    const award = await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');
        const user = userDoc.data();

        // Dùng CHUNG quỹ điểm ngày với thi đấu: luyện tập không phải đường vòng
        // để vượt trần 100đ/ngày.
        const stats = user.arenaStats || {};
        const usedToday = stats.dateKey === dateKey ? Number(stats.points) || 0 : 0;
        const granted = Math.min(score, Math.max(0, cap - usedToday));

        if (granted <= 0) {
            return { points: 0, capped: score > 0, usedToday, cap };
        }

        t.update(userRef, {
            totalBehaviorPoints: (Number(user.totalBehaviorPoints) || 0) + granted,
            arenaStats: { dateKey, points: usedToday + granted },
            updatedAt: nowStamp(),
        });

        return { points: granted, capped: granted < score, usedToday: usedToday + granted, cap };
    });

    const result = {
        score,
        maxScore: questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
        ...award,
    };

    // Lưu lại bài làm để lần gọi sau dựng được phần xem đáp án y như lần đầu
    await sessionRef.update({
        practiceResult: result,
        lastAnswers: answers,
        status: 'finished',
        finalizedAt: nowStamp(),
    });
    await rtdb.ref(`${sessionPath}/meta/status`).set('finished').catch(() => {});

    return { ...result, review: buildPracticeReview(questions, answers) };
});

/**
 * Chấm điểm và xếp hạng cả trận Đấu Trường.
 *
 * Client gọi khi thấy trận chuyển sang trạng thái chấm điểm. Nhiều client cùng
 * gọi là bình thường — lần đầu chấm và ghi kết quả, các lần sau trả về đúng
 * bảng xếp hạng đã chốt (idempotent), nên không ai chấm lại ra kết quả khác.
 *
 * Client gửi: { sessionId }
 */
exports.finalizeArenaMatch = moneyFunction(async ({ uid, body, db }) => {
    const { sessionId } = body;
    if (!sessionId) throw new Error('Thiếu mã trận đấu');

    const sessionRef = db.doc(`arenaSessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new Error('Không tìm thấy trận đấu');

    const session = sessionSnap.data();
    if (!(session.playerUids || []).includes(uid)) {
        throw new Error('Bạn không tham gia trận này');
    }

    // Đã chấm rồi thì trả luôn kết quả cũ, không chấm lại
    if (session.ranking) return { ranking: session.ranking, alreadyGraded: true };

    const rtdb = admin.database();
    const sessionPath = `arena_sessions/${sessionId}`;
    const [metaSnap, answersSnap, effectsSnap] = await Promise.all([
        rtdb.ref(`${sessionPath}/meta`).get(),
        rtdb.ref(`${sessionPath}/answers`).get(),
        rtdb.ref(`${sessionPath}/effects`).get(),
    ]);

    const meta = metaSnap.val() || {};
    // Chống chấm sớm: phải hết giờ câu cuối, hoặc trận đã chuyển sang chấm điểm
    const finished = meta.status === 'grading' || meta.status === 'finished';
    if (!finished && Date.now() < Number(meta.questionEndsAt || 0)) {
        throw new Error('Trận đấu chưa kết thúc');
    }

    const answers = answersSnap.val() || {};
    const effects = effectsSnap.val() || {};
    const settings = await getArenaSettings(db);
    const doubleAllowed = settings.doubleAllowedTypes || DEFAULT_ARENA_SETTINGS.doubleAllowedTypes;
    const questions = session.questions || [];

    const ranking = (session.playerUids || []).map((playerUid) => {
        const playerAnswers = answers[playerUid] || {};
        const playerEffects = effects[playerUid] || {};
        let score = 0;
        let totalMs = 0;

        questions.forEach((q, i) => {
            const ans = playerAnswers[i];
            let pts = gradeArenaQuestion(q, ans);

            // Nhân đôi: kiểm tra LẠI loại câu ở server — client ghi được ý định
            // đặt cược lên câu bất kỳ, nhưng câu đúng-sai 2đ không được nhân.
            if (
                pts > 0 &&
                typeof playerEffects.doubleOn === 'number' &&
                playerEffects.doubleOn === i &&
                doubleAllowed.includes(q.type)
            ) {
                pts *= 2;
            }
            score += pts;

            // elapsedMs do client ghi nên có thể bị làm giả, phải kẹp trong
            // khoảng hợp lệ; không trả lời thì tính trọn thời gian câu.
            const maxMs = (Number(q.seconds) || 0) * 1000;
            const raw = Number(ans?.elapsedMs);
            totalMs += ans && Number.isFinite(raw) ? Math.min(Math.max(raw, 0), maxMs) : maxMs;
        });

        return {
            uid: playerUid,
            name: session.playerNames?.[playerUid] || '',
            score: Math.round(score * 100) / 100,
            totalMs,
        };
    });

    // Điểm cao hơn trước; bằng điểm thì ai làm nhanh hơn xếp trên.
    // uid là tiêu chí cuối để thứ tự luôn tất định — nếu thiếu, hai lần chấm
    // có thể ra thứ hạng khác nhau và việc trao thưởng hết idempotent.
    ranking.sort(
        (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.uid.localeCompare(b.uid)
    );
    ranking.forEach((r, i) => {
        r.rank = i + 1;
    });

    await sessionRef.update({ ranking, status: 'finished', finalizedAt: nowStamp() });
    await rtdb.ref(`${sessionPath}/results`).set({ ranking, gradedAt: Date.now() });
    await rtdb.ref(`${sessionPath}/meta/status`).set('finished');

    // Trả phòng về trạng thái chờ để lượt sau chơi tiếp được ngay.
    // Nếu không làm, phòng kẹt ở 'running' vĩnh viễn: danh sách phòng vẫn hiện
    // "đang thi đấu" dù HS đã rời hết, và admin phải xoá phòng thủ công.
    await resetArenaRoomAfterMatch(rtdb, session.roomId);

    return { ranking };
});

/**
 * Đưa phòng về trạng thái chờ sau khi trận đã chấm xong.
 *
 * Xoá sạch danh sách người chơi cũ: HS nào muốn đấu tiếp sẽ vào lại từ màn danh
 * sách phòng, nên không còn "người ma" nằm trong phòng.
 *
 * Phòng đã bị admin đóng/xoá thì để nguyên — admin đã quyết định rồi.
 */
const resetArenaRoomAfterMatch = async (rtdb, roomId) => {
    if (!roomId) return;

    const roomRef = rtdb.ref(`arena_lobbies/${roomId}`);
    const snap = await roomRef.get();
    if (!snap.exists()) return;

    const room = snap.val();
    if (room.status === 'closed') return;

    await roomRef.update({
        status: 'open',
        sessionId: null,
        countdownEndsAt: null,
        players: null,
        playerCount: 0,
        // Phòng uỷ quyền: trả chủ phòng về giáo viên để HS lượt sau giành lại quyền
        hostUid: room.allowStudentHost ? room.teacherId || room.hostUid : room.hostUid,
        lastActivityAt: Date.now(),
    });

    try {
        await rtdb.ref(`arena_open_rooms/${roomId}`).update({
            status: 'open',
            playerCount: 0,
        });
    } catch {
        // Phòng đã bị gỡ khỏi danh sách công khai — không sao
    }
};

/**
 * Dọn một phòng Đấu Trường bị bỏ hoang.
 *
 * Tình huống: cả phòng thoát giữa trận, không còn ai kích hoạt việc chấm điểm,
 * nên phòng kẹt ở 'running' và danh sách phòng cứ báo "đang thi đấu" với một
 * phòng trống. Học sinh không ghi được `status` của phòng (rules chỉ cho admin),
 * nên việc dọn phải chạy ở đây.
 *
 * Chỉ dọn khi phòng THỰC SỰ không còn ai đang kết nối — không ai dùng hàm này
 * để đá cả phòng ra giữa trận được.
 *
 * Client gửi: { roomId }
 */
exports.cleanupArenaRoom = moneyFunction(async ({ body }) => {
    const { roomId } = body;
    if (!roomId) throw new Error('Thiếu mã phòng');

    const rtdb = admin.database();
    const roomSnap = await rtdb.ref(`arena_lobbies/${roomId}`).get();
    if (!roomSnap.exists()) return { cleaned: false, reason: 'room_not_found' };

    const room = roomSnap.val();
    if (room.status === 'closed') return { cleaned: false, reason: 'room_closed' };

    const onlineCount = Object.values(room.players || {}).filter(
        (p) => p && p.online !== false
    ).length;
    if (onlineCount > 0) return { cleaned: false, reason: 'still_playing' };

    // Trận đang dở mà không còn ai → đánh dấu đã kết thúc để không treo mãi
    if (room.sessionId) {
        await rtdb.ref(`arena_sessions/${room.sessionId}/meta/status`).set('finished').catch(() => {});
    }

    await resetArenaRoomAfterMatch(rtdb, roomId);
    return { cleaned: true };
});

/**
 * Dùng vật phẩm cần biết đáp án: 50/50 và gợi ý câu đúng-sai.
 *
 * Phải chạy server-side vì Realtime Database không có đáp án. Server tự đánh
 * dấu đã dùng trong cùng lượt gọi nên không thể dùng lại vật phẩm.
 *
 * Client gửi: { sessionId, qIndex, effect: 'fifty'|'hint_tf', statementIndex? }
 */
exports.useArenaHint = moneyFunction(async ({ uid, body, db }) => {
    const { sessionId, qIndex, effect, statementIndex } = body;
    if (!sessionId) throw new Error('Thiếu mã trận đấu');
    if (effect !== 'fifty' && effect !== 'hint_tf') throw new Error('Vật phẩm không hợp lệ');

    const index = Number(qIndex);
    if (!Number.isInteger(index) || index < 0) throw new Error('Câu hỏi không hợp lệ');

    const sessionSnap = await db.doc(`arenaSessions/${sessionId}`).get();
    if (!sessionSnap.exists) throw new Error('Không tìm thấy trận đấu');

    const session = sessionSnap.data();
    if (!(session.playerUids || []).includes(uid)) throw new Error('Bạn không tham gia trận này');

    const question = (session.questions || [])[index];
    if (!question) throw new Error('Không tìm thấy câu hỏi');

    const rtdb = admin.database();
    const sessionPath = `arena_sessions/${sessionId}`;

    // Chỉ cho dùng ở đúng câu đang diễn ra, tránh soi trước đáp án câu sau
    const metaSnap = await rtdb.ref(`${sessionPath}/meta`).get();
    const meta = metaSnap.val() || {};
    if (meta.status !== 'running') throw new Error('Trận đấu không trong lúc thi đấu');
    if (Number(meta.questionIndex) !== index) throw new Error('Chỉ dùng được cho câu đang làm');

    // KHÔNG chặn khi đã trả lời: học sinh sửa được đáp án tới khi hết giờ, nên
    // dùng gợi ý sau khi lỡ chọn vẫn có ý nghĩa.

    // Chốt quyền dùng bằng transaction TRƯỚC khi tính kết quả, hai request
    // song song thì chỉ một cái qua được.
    const usedRef = rtdb.ref(`${sessionPath}/effects/${uid}/used/${effect}`);
    const claim = await usedRef.transaction((current) => (current ? undefined : true));
    if (!claim.committed) throw new Error('Bạn đã dùng vật phẩm này trong trận rồi');

    try {
        if (effect === 'fifty') {
            if (question.type !== 'abcd') throw new Error('Vật phẩm 50/50 chỉ dùng cho câu 4 đáp án');

            const wrongIndices = (question.answers || [])
                .map((a, i) => (a.isCorrect ? -1 : i))
                .filter((i) => i >= 0);
            // Bỏ 2 đáp án sai ngẫu nhiên
            for (let i = wrongIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
            }
            const removed = wrongIndices.slice(0, 2);

            await rtdb.ref(`${sessionPath}/effects/${uid}/fifty/${index}`).set(removed);
            return { effect, removed };
        }

        // hint_tf
        if (question.type !== 'true_false') {
            throw new Error('Vật phẩm gợi ý chỉ dùng cho câu đúng-sai');
        }
        const sIndex = Number(statementIndex);
        const statements = question.statements || [];
        if (!Number.isInteger(sIndex) || sIndex < 0 || sIndex >= statements.length) {
            throw new Error('Ý cần gợi ý không hợp lệ');
        }

        const hint = { index: sIndex, isTrue: !!statements[sIndex].isTrue };
        await rtdb.ref(`${sessionPath}/effects/${uid}/hintTf/${index}`).set(hint);
        return { effect, ...hint };
    } catch (error) {
        // Trả lại lượt dùng nếu không tạo được gợi ý (sai loại câu, ý không hợp lệ)
        await usedRef.remove().catch(() => {});
        throw error;
    }
});

/**
 * Nhận điểm tích luỹ sau trận Đấu Trường.
 *
 * Server tự đọc bảng xếp hạng đã chốt để xác minh thứ hạng, không tin thứ hạng
 * client gửi lên. Trần điểm mỗi ngày dùng cùng mẫu với giới hạn chuyển Xu:
 * lưu { dateKey, points } trên user doc, sang ngày mới tự reset.
 *
 * Client gửi: { sessionId }
 */
exports.claimArenaReward = moneyFunction(async ({ uid, body, db }) => {
    const { sessionId } = body;
    if (!sessionId) throw new Error('Thiếu mã trận đấu');

    const settings = await getArenaSettings(db);
    const rewards = settings.rewards;
    const cap = Number(settings.dailyCapPoints ?? 100);

    const sessionSnap = await db.doc(`arenaSessions/${sessionId}`).get();
    if (!sessionSnap.exists) throw new Error('Không tìm thấy trận đấu');

    const session = sessionSnap.data();
    if (!session.ranking) throw new Error('Trận đấu chưa chấm điểm xong');

    // Đủ số người lúc BẮT ĐẦU là đủ điều kiện, người rời giữa chừng không làm
    // mất thưởng của những người ở lại.
    const minPlayers = Number(settings.minPlayers ?? 5);
    if (Number(session.playerCount || 0) < minPlayers) {
        return { awarded: false, reason: 'not_enough_players', points: 0, minPlayers };
    }

    const me = session.ranking.find((r) => r.uid === uid);
    if (!me) throw new Error('Bạn không tham gia trận này');
    if (me.rank > 5) return { awarded: false, reason: 'out_of_top5', points: 0, rank: me.rank };
    // Chặn cày điểm bằng tài khoản phụ vào ngồi im
    if (!(Number(me.score) > 0)) return { awarded: false, reason: 'zero_score', points: 0 };

    const base = Number(rewards[me.rank] || rewards[String(me.rank)] || 0);
    if (base <= 0) return { awarded: false, reason: 'no_reward_configured', points: 0 };

    // docId gộp uid vì một trận có tới 5 người nhận thưởng
    const claimRef = db.doc(`arenaRewardClaims/${sessionId}_${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const dateKey = getDateKeyVN();

    return await db.runTransaction(async (t) => {
        const claimDoc = await t.get(claimRef);
        if (claimDoc.exists) throw new Error('Trận này bạn đã nhận thưởng rồi');

        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('Không tìm thấy thông tin người dùng');
        const user = userDoc.data();

        const stats = user.arenaStats || {};
        const usedToday = stats.dateKey === dateKey ? Number(stats.points) || 0 : 0;
        // Gần chạm trần thì vẫn trao phần còn lại, không từ chối cả phần thưởng
        const granted = Math.min(base, Math.max(0, cap - usedToday));

        if (granted <= 0) {
            // Vẫn ghi claim để lần sau không thử lại vô ích
            t.set(claimRef, {
                sessionId, uid, rank: me.rank, points: 0,
                reason: 'daily_cap', dateKey, createdAt: nowStamp(),
            });
            return { awarded: false, reason: 'daily_cap', points: 0, usedToday, cap };
        }

        const newTotal = (Number(user.totalBehaviorPoints) || 0) + granted;
        t.update(userRef, {
            totalBehaviorPoints: newTotal,
            arenaStats: { dateKey, points: usedToday + granted },
            updatedAt: nowStamp(),
        });
        t.set(claimRef, {
            sessionId, uid, rank: me.rank, points: granted,
            capped: granted < base, dateKey, createdAt: nowStamp(),
        });

        return {
            awarded: true,
            points: granted,
            rank: me.rank,
            capped: granted < base,
            newTotal,
            usedToday: usedToday + granted,
            cap,
        };
    });
});
