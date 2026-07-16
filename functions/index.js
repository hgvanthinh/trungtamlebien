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
