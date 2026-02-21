import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { useBackground } from '../../contexts/BackgroundContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Layout = () => {
  const { userProfile, logout, isAdmin } = useAuth();
  const { backgroundImage, backgroundImageMobile, backgroundOpacity, applyToStudents } = useBackground();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [classNames, setClassNames] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // Detect if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load class names from classes array
  useEffect(() => {
    const loadClassNames = async () => {
      if (!userProfile?.classes || userProfile.classes.length === 0) {
        setClassNames([]);
        return;
      }

      try {
        const names = [];
        for (const classId of userProfile.classes) {
          const classDoc = await getDoc(doc(db, 'classes', classId));
          if (classDoc.exists()) {
            names.push(classDoc.data().name);
          }
        }
        setClassNames(names);
      } catch (error) {
        console.error('Error loading class names:', error);
        setClassNames([]);
      }
    };

    loadClassNames();
  }, [JSON.stringify(userProfile?.classes)]);

  // Transform userProfile to match old user structure
  const user = userProfile ? {
    name: userProfile.fullName,
    class: classNames.length > 0 ? classNames.join(', ') : null,
    avatar: userProfile.avatar || '',
    activeAvatarBorder: userProfile.activeAvatarBorder || null,
  } : null;

  // Hiển thị hình nền nếu: Admin HOẶC (Học sinh VÀ admin đã bật applyToStudents)
  const shouldShowBackground = backgroundImage && (isAdmin || applyToStudents);

  // Chọn hình nền phù hợp: Mobile dùng hình mobile (nếu có), không thì dùng hình desktop
  const currentBackgroundImage = isMobile && backgroundImageMobile ? backgroundImageMobile : backgroundImage;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display text-[#111812] dark:text-white overflow-x-hidden relative">
      {/* Background Image */}
      {shouldShowBackground && (
        <>
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
            style={{
              backgroundImage: `url(${currentBackgroundImage})`,
              opacity: backgroundOpacity,
            }}
          />
          <div className="fixed inset-0 bg-background-light dark:bg-background-dark pointer-events-none z-0" style={{ opacity: 1 - backgroundOpacity }} />
        </>
      )}

      <div className="flex h-screen w-full flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Mobile Overlay - Click to close menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-10 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Desktop always visible, Mobile conditional */}
        <div className={`${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-20 w-[280px] animate-slide-in-left' : 'hidden'} lg:block lg:static lg:z-auto`}>
          <Sidebar user={user} onLogout={logout} onMenuItemClick={() => setMobileMenuOpen(false)} />
        </div>

        {/* Main Content */}
        <main className="flex-1 h-full overflow-y-auto p-4 lg:p-6 lg:pr-8">
          {/* Mobile Header */}
          <Header
            user={user}
            onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            notificationCount={2}
          />

          {/* Page Content */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
