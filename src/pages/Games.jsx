import { useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Avatar from '../components/common/Avatar';
import Icon from '../components/common/Icon';
import { gamesData, topPlayers } from '../data/mockData';

const Games = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'algebra', label: 'Đại số' },
    { id: 'geometry', label: 'Hình học' },
    { id: 'arithmetic', label: 'Số học' },
  ];

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Icon
            key={i}
            name="star"
            size={16}
            filled={i < Math.floor(rating)}
            className={i < Math.floor(rating) ? 'text-yellow-500' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      {/* Hero Section */}
      <div className="clay-card p-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-center gap-4">
          <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <Icon name="stadia_controller" size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white">
              Khu vực Game Toán 🎮
            </h1>
            <p className="text-[#608a67] dark:text-[#8ba890] text-lg mt-1">
              Học toán qua trò chơi vui nhộn và thú vị
            </p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-primary text-[#052e16] shadow-lg'
                : 'bg-white dark:bg-surface-dark text-[#608a67] dark:text-[#8ba890] hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Games Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {gamesData.map((game) => (
            <Card key={game.id} className="p-6" variant="hover">
              <div
                className="h-40 rounded-2xl bg-cover bg-center mb-4"
                style={{ backgroundImage: `url(${game.thumbnail})` }}
              />
              <div className="flex items-start justify-between mb-2">
                <Badge color="green" size="sm">{game.category}</Badge>
                {renderStars(game.rating)}
              </div>
              <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-2">
                {game.title}
              </h3>
              <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-4">
                {game.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-[#608a67] dark:text-[#8ba890]">
                  <Icon name="person" size={18} />
                  <span>{game.players} người chơi</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-600 font-bold">
                  <Icon name="toll" size={18} />
                  <span>+{game.coins}</span>
                </div>
              </div>
              <Button variant="primary" className="w-full mt-4" icon="play_arrow">
                Chơi ngay
              </Button>
            </Card>
          ))}
        </div>

        {/* Top Players Sidebar */}
        <div>
          <Card className="p-6 sticky top-6">
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-4 flex items-center gap-2">
              <Icon name="emoji_events" className="text-yellow-500" />
              Top game thủ
            </h3>
            <div className="space-y-3">
              {topPlayers.map((player) => (
                <div
                  key={player.rank}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="text-lg font-bold text-[#608a67] dark:text-[#8ba890]">
                    #{player.rank}
                  </div>
                  <Avatar src={player.avatar} name={player.name} size="sm" />
                  <div className="flex-1">
                    <p className="font-bold text-[#111812] dark:text-white">{player.name}</p>
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890]">{player.score} điểm</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Games;
