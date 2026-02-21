const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

// Cấu hình region gần Việt Nam (Singapore)
const REGION = "asia-southeast1";

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
