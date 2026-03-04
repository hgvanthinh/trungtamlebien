import { Link, useLocation } from 'react-router-dom';
import Icon from '../common/Icon';
import Avatar from '../common/Avatar';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ user, onLogout, onMenuItemClick }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const studentMenuItems = [
    { path: '/', icon: 'home', label: 'Trang chủ', filled: true },
    { path: '/profile', icon: 'person', label: 'Hồ sơ cá nhân' },
    { path: '/crafting', icon: 'hardware', label: 'Chế Tạo Vàng', filled: true },
    { path: '/store', icon: 'storefront', label: 'Cửa Hàng', filled: true },
    { path: '/inventory', icon: 'inventory_2', label: 'Kho Hàng' },
    { path: '/leaderboard', icon: 'emoji_events', label: 'Bảng xếp hạng' },
    { path: '/exams', icon: 'quiz', label: 'Đề thi' },
    { path: '/videos', icon: 'video_library', label: 'Kho video' },
    { path: '/game-lobby', icon: 'stadia_controller', label: 'Game vui Toán', filled: true, badge: '🎮 Mới' },
    { path: '/rules', icon: 'gavel', label: 'Nội quy' },
    { path: '/materials', icon: 'menu_book', label: 'Tài liệu Toán', disabled: true },
  ];

  const adminMenuItems = [
    { path: '/admin', icon: 'dashboard', label: 'Trang quản trị', filled: true },
    { path: '/admin/teaching', icon: 'edit_note', label: 'Dạy học' },
    { path: '/admin/violations', icon: 'gavel', label: 'Vi phạm - Tài sản' },
    { path: '/admin/attendance', icon: 'event_available', label: 'Điểm danh' },
    { path: '/admin/classes', icon: 'groups', label: 'Lớp học' },
    { path: '/admin/students', icon: 'school', label: 'Quản lý học sinh' },
    { path: '/admin/store', icon: 'storefront', label: 'Quản lý Cửa Hàng', filled: true },
    { path: '/admin/exam-bank', icon: 'quiz', label: 'Kho đề thi' },
    { path: '/admin/videos', icon: 'video_library', label: 'Kho video' },
    { path: '/game-lobby', icon: 'stadia_controller', label: 'Game vui Toán', filled: true, badge: '🎮 Mới' },
    { path: '/admin/grade-submissions', icon: 'grading', label: 'Chấm bài' },
    { path: '/admin/background-settings', icon: 'wallpaper', label: 'Cài đặt hình nền' },
    { path: '/admin/stats', icon: 'analytics', label: 'Thống kê', disabled: true },
  ];

  const menuItems = isAdmin ? adminMenuItems : studentMenuItems;

  return (
    <aside className="w-full h-full lg:w-[280px] lg:flex-shrink-0 flex flex-col bg-transparent p-4 lg:py-6 lg:pl-6 z-20">
      <div className="clay-card flex flex-col h-full p-6 relative">
        {/* User Profile */}
        <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar
              src={isAdmin ? '/logo.png' : user?.avatar}
              name={user?.name}
              size="lg"
              border
              borderUrl={!isAdmin ? user?.activeAvatarBorder : null}
              borderPadding="2%"
            />
            <div className="flex flex-col">
              <h1 className="text-[#111812] dark:text-white text-lg font-bold leading-tight">
                {user?.name || 'Nguyễn Văn A'}
              </h1>
              <p className="text-[#608a67] dark:text-[#8ba890] text-sm font-medium">
                {isAdmin ? 'Quản trị viên' : (user?.class || 'Chưa phân lớp')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0 mb-4 scrollbar-hide">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-[#556958] dark:text-[#a5b5a8] opacity-50 cursor-not-allowed"
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    Sắp có
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onMenuItemClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all ${isActive
                  ? 'bg-primary text-[#052e16] shadow-[0px_4px_10px_rgba(37,244,71,0.3)] font-bold'
                  : 'text-[#556958] dark:text-[#a5b5a8] hover:bg-[#f0f5f1] dark:hover:bg-white/10 group'
                  }`}
              >
                <Icon
                  name={item.icon}
                  filled={item.filled && isActive}
                  className={isActive ? '' : 'group-hover:scale-110 transition-transform'}
                />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive
                        ? 'rgba(5,46,22,0.2)'
                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: isActive ? '#052e16' : 'white',
                    }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="flex-shrink-0 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[#f44747] bg-[#fdf2f2] dark:bg-[#2c1a1a] dark:text-[#ff6b6b] hover:bg-[#fae6e6] dark:hover:bg-[#3d2424] font-bold transition-colors shadow-sm"
        >
          <Icon name="logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
