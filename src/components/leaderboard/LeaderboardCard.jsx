import { useState } from 'react';
import Icon from '../common/Icon';
import Avatar from '../common/Avatar';

const LeaderboardCard = ({ title, subtitle, leaderboard, currentUserUid, showGrade = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedLeaderboard = isExpanded ? leaderboard : leaderboard.slice(0, 10);
  const hasMore = leaderboard.length > 10;

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getPointsColor = (points) => {
    if (points >= 50) return 'text-green-600 dark:text-green-400';
    if (points >= 20) return 'text-blue-600 dark:text-blue-400';
    if (points >= 0) return 'text-gray-600 dark:text-gray-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="clay-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-6 border-b border-[#d0e5d4] dark:border-white/10">
        <h2 className="text-2xl font-bold text-[#111812] dark:text-white flex items-center gap-2">
          <Icon name="emoji_events" className="text-primary" />
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[#608a67] dark:text-[#8ba890] mt-1">{subtitle}</p>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="divide-y divide-[#d0e5d4] dark:divide-white/10">
        {displayedLeaderboard.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="leaderboard" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <p className="text-[#608a67] dark:text-[#8ba890]">Chưa có dữ liệu xếp hạng</p>
          </div>
        ) : (
          displayedLeaderboard.map((student, index) => {
            const isCurrentUser = student.uid === currentUserUid;
            const isTopThree = student.rank <= 3;

            return (
              <div
                key={student.uid}
                className={`p-4 transition-all ${
                  isCurrentUser
                    ? 'bg-primary/10 dark:bg-primary/5 border-l-4 border-primary'
                    : 'hover:bg-[#f0f5f1] dark:hover:bg-white/5'
                } ${isTopThree ? 'bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${getRankColor(
                        student.rank
                      )} shadow-md`}
                    >
                      {getRankIcon(student.rank) || `#${student.rank}`}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <Avatar
                      src={student.avatar}
                      name={student.fullName}
                      size="md"
                      borderUrl={student.activeAvatarBorder}
                      border={true}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#111812] dark:text-white truncate">
                        {student.fullName}
                      </p>
                      {isCurrentUser && (
                        <span className="px-2 py-1 text-xs font-medium bg-primary text-[#052e16] rounded-lg">
                          Bạn
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                      {student.username}
                      {showGrade && student.grade && ` • Khối ${student.grade}`}
                      {student.gradeRank && ` • #${student.gradeRank} trong khối`}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-2xl font-bold ${getPointsColor(student.totalBehaviorPoints)}`}>
                      {student.totalBehaviorPoints}
                    </div>
                    <div className="text-xs text-[#608a67] dark:text-[#8ba890]">điểm</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Expand/Collapse Button */}
      {hasMore && (
        <div className="p-4 bg-[#f0f5f1] dark:bg-white/5 border-t border-[#d0e5d4] dark:border-white/10">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-3 px-4 rounded-xl bg-white dark:bg-white/5 hover:bg-primary/10 dark:hover:bg-primary/5 border border-[#d0e5d4] dark:border-white/20 text-[#111812] dark:text-white font-medium transition-all flex items-center justify-center gap-2"
          >
            <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
            {isExpanded ? 'Thu gọn' : `Xem thêm ${leaderboard.length - 10} học sinh`}
          </button>
        </div>
      )}

      {/* Footer Stats */}
      {leaderboard.length > 0 && (
        <div className="p-4 bg-[#f0f5f1] dark:bg-white/5 border-t border-[#d0e5d4] dark:border-white/10">
          <div className="flex items-center justify-between text-sm text-[#608a67] dark:text-[#8ba890]">
            <span>Tổng số học sinh</span>
            <span className="font-bold text-[#111812] dark:text-white">{leaderboard.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardCard;