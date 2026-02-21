import Icon from '../common/Icon';
import Avatar from '../common/Avatar';
import SearchBar from '../common/SearchBar';

const Header = ({
  showSearch = false,
  notificationCount = 0,
  onMenuToggle,
  user,
  searchPlaceholder = 'Tìm kiếm...',
  onSearch
}) => {
  return (
    <header className="flex justify-between items-center lg:hidden mb-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-xl hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-colors"
      >
        <Icon name="menu" size={28} className="text-[#111812] dark:text-white" />
      </button>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-xl hover:bg-[#f0f5f1] dark:hover:bg-white/10 transition-colors">
          <Icon name="notifications" size={24} className="text-[#111812] dark:text-white" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* User avatar */}
        <Avatar
          src={user?.avatar}
          name={user?.name}
          size="sm"
          borderUrl={user?.activeAvatarBorder}
          borderPadding="3%"
        />
      </div>

      {/* Search bar (conditionally rendered) */}
      {showSearch && (
        <div className="absolute top-16 left-4 right-4">
          <SearchBar
            placeholder={searchPlaceholder}
            onChange={onSearch}
          />
        </div>
      )}
    </header>
  );
};

export default Header;
