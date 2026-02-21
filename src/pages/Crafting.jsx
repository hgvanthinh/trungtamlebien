import { useAuth } from '../contexts/AuthContext';
import CraftingTab from '../components/crafting/CraftingTab';
import Icon from '../components/common/Icon';
import GoldIcon from '../components/common/GoldIcon';

const Crafting = () => {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#111812] dark:text-white flex items-center gap-3">
          <Icon name="auto_awesome" className="text-primary text-4xl" filled />
          Chế Tạo Đồng Vàng
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] mt-2">
          Chuyển đổi Xu thành Đồng Vàng với các mức độ rủi ro khác nhau
        </p>
      </div>

      {/* Stats Overview Card */}
      <div className="clay-card p-6 mb-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Coins */}
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30">
              <Icon name="paid" className="text-yellow-600 dark:text-yellow-400 text-3xl" filled />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Xu hiện có</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {userProfile?.coins || 0}
              </p>
            </div>
          </div>

          {/* Current Gold */}
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <GoldIcon size={32} />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Đồng Vàng</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {userProfile?.gold || 0}
              </p>
            </div>
          </div>

          {/* Behavior Points (for reference) */}
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30">
              <Icon name="star" className="text-green-600 dark:text-green-400 text-3xl" filled />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Điểm tích lũy</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {userProfile?.totalBehaviorPoints || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crafting Tab */}
      <CraftingTab />
    </div>
  );
};

export default Crafting;
