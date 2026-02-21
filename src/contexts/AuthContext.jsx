import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Đăng ký học sinh - tự động chuyển username thành email
  const registerStudent = async (username, password, fullName) => {
    try {
      // Chuyển username thành email (vd: "hocsinh" -> "hocsinh@thaybien.com")
      const email = `${username}@thaybien.com`;

      // Tạo tài khoản trong Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Lưu thông tin profile vào Firestore (không có className)
      await setDoc(doc(db, 'users', user.uid), {
        username: username,
        email: email,
        fullName: fullName,
        role: 'student',
        avatar: '',
        classes: [], // Danh sách lớp học (admin sẽ gán sau)
        createdAt: new Date().toISOString(),
        stats: {
          completedLessons: 0,
          averageScore: 0,
          streak: 0,
          medals: 0,
        },
        totalBehaviorPoints: 0,
        coins: 0, // Xu - dùng để giao dịch
        gold: 0, // Đồng Vàng - nhận từ chế tạo
        attendanceStats: {
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0,
        },
      });

      return { success: true, user };
    } catch (error) {
      console.error('Error registering student:', error);
      let errorMessage = 'Đăng ký thất bại';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Tên đăng nhập đã được sử dụng';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự';
      }

      return { success: false, error: errorMessage };
    }
  };

  // Đăng nhập (học sinh hoặc admin)
  const login = async (username, password, rememberMe = true) => {
    try {
      // Tất cả user đều login qua Firebase Auth
      const email = `${username}@thaybien.com`;

      // Set persistence dựa trên lựa chọn "Ghi nhớ đăng nhập"
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Lấy profile từ Firestore để check role
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile(userData);

        // Check nếu là admin
        if (userData.role === 'admin') {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.removeItem('isAdmin');
        }
      }

      return { success: true, user };
    } catch (error) {
      console.error('Error logging in:', error);
      let errorMessage = 'Đăng nhập thất bại';

      // Chi tiết hóa thông báo lỗi
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Tên đăng nhập không tồn tại';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mật khẩu không đúng';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Tên đăng nhập hoặc mật khẩu không đúng';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Tên đăng nhập không hợp lệ';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet';
      }

      return { success: false, error: errorMessage };
    }
  };

  // Đăng xuất
  const logout = async () => {
    try {
      // Đăng xuất Firebase cho tất cả user
      await signOut(auth);
      localStorage.removeItem('isAdmin');
      return { success: true };
    } catch (error) {
      console.error('Error logging out:', error);
      return { success: false, error: 'Đăng xuất thất bại' };
    }
  };

  // Cập nhật profile
  const updateProfile = async (updates) => {
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    try {
      await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
      setUserProfile((prev) => ({ ...prev, ...updates }));
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: 'Cập nhật thất bại' };
    }
  };

  // Cập nhật user profile (local state only - no Firestore write)
  // Dùng cho crafting để update UI ngay lập tức sau khi transaction hoàn thành
  const updateUserProfile = (updates) => {
    setUserProfile((prev) => ({
      ...prev,
      ...updates
    }));
  };

  // Theo dõi trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Lấy profile từ Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile(userData);

          // Cập nhật localStorage admin flag
          if (userData.role === 'admin') {
            localStorage.setItem('isAdmin', 'true');
          } else {
            localStorage.removeItem('isAdmin');
          }
        }
      } else {
        setUserProfile(null);
        localStorage.removeItem('isAdmin');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    registerStudent,
    login,
    logout,
    updateProfile,
    updateUserProfile, // New: Update local state only (for crafting)
    isAuthenticated: !!currentUser,
    isAdmin: userProfile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Export AuthContext for direct usage
export { AuthContext };
