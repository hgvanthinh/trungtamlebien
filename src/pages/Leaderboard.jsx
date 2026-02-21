import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllLeaderboards } from '../services/leaderboardService';
import { getStudentClasses } from '../services/classService';
import LeaderboardCard from '../components/leaderboard/LeaderboardCard';
import Icon from '../components/common/Icon';

const Leaderboard = () => {
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classLeaderboard, setClassLeaderboard] = useState(null);
  const [gradeLeaderboard, setGradeLeaderboard] = useState(null);
  const [centerLeaderboard, setCenterLeaderboard] = useState(null);
  const [studentGrade, setStudentGrade] = useState(null);
  const [selectedTab, setSelectedTab] = useState('grade'); // grade, center

  useEffect(() => {
    loadLeaderboards();
  }, [userProfile]);

  const loadLeaderboards = async () => {
    if (!userProfile) return;

    setLoading(true);

    try {
      // Lấy khối của học sinh
      let grade = null;
      if (userProfile.classes && userProfile.classes.length > 0) {
        const classesResult = await getStudentClasses(userProfile.classes);
        if (classesResult.success && classesResult.classes.length > 0) {
          // Lấy khối cao nhất (convert to number)
          grade = Math.max(...classesResult.classes.map(c => parseInt(c.grade) || 0));
          setStudentGrade(grade);
        }
      }

      // Lấy tất cả bảng xếp hạng
      const result = await getAllLeaderboards(userProfile.classes, grade);

      if (result.success) {
        if (result.classLeaderboard) {
          setClassLeaderboard(result.classLeaderboard);
        }
        if (result.gradeLeaderboard) {
          setGradeLeaderboard(result.gradeLeaderboard);
        }
        if (result.centerLeaderboard) {
          setCenterLeaderboard(result.centerLeaderboard);
        }
      }
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    }

    setLoading(false);
  };

  // Tìm vị trí của học sinh hiện tại trong từng bảng xếp hạng
  const getCurrentUserRank = (leaderboard) => {
    if (!leaderboard || !currentUser) return null;
    const student = leaderboard.find(s => s.uid === currentUser.uid);
    return student ? student.rank : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-[#608a67] dark:text-[#8ba890]">Đang tải bảng xếp hạng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#111812] dark:text-white flex items-center gap-3">
          <Icon name="emoji_events" className="text-primary text-4xl" />
          Bảng xếp hạng
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] mt-2">
          Xếp hạng dựa trên điểm tích lũy của bạn
        </p>
      </div>

      {/* Current User Stats Card */}
      {userProfile && (
        <div className="clay-card p-6 mb-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/5 dark:to-transparent">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {userProfile.avatar ? (
                <img
                  src={userProfile.avatar}
                  alt={userProfile.fullName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary shadow-lg">
                  <Icon name="person" className="text-primary text-3xl" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#111812] dark:text-white">
                {userProfile.fullName}
              </h3>
              <p className="text-[#608a67] dark:text-[#8ba890]">{userProfile.username}</p>

              <div className="flex flex-wrap gap-4 mt-3">
                {/* Total Points */}
                <div className="flex items-center gap-2">
                  <Icon name="star" className="text-yellow-500" />
                  <span className="font-bold text-lg text-[#111812] dark:text-white">
                    {userProfile.totalBehaviorPoints || 0} điểm
                  </span>
                </div>

                {/* Grade Rank */}
                {gradeLeaderboard && gradeLeaderboard.leaderboard && (
                  <div className="flex items-center gap-2">
                    <Icon name="workspace_premium" className="text-purple-500" />
                    <span className="text-[#608a67] dark:text-[#8ba890]">
                      <span className="font-bold text-[#111812] dark:text-white">
                        #{getCurrentUserRank(gradeLeaderboard.leaderboard)}
                      </span>{' '}
                      trong khối
                    </span>
                  </div>
                )}

                {/* Center Rank */}
                {centerLeaderboard && centerLeaderboard.leaderboard && (
                  <div className="flex items-center gap-2">
                    <Icon name="public" className="text-green-500" />
                    <span className="text-[#608a67] dark:text-[#8ba890]">
                      <span className="font-bold text-[#111812] dark:text-white">
                        #{getCurrentUserRank(centerLeaderboard.leaderboard)}
                      </span>{' '}
                      toàn trung tâm
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedTab('grade')}
          className={`flex-1 min-w-[150px] px-6 py-4 rounded-xl font-bold transition-all ${selectedTab === 'grade'
              ? 'bg-primary text-[#052e16] shadow-lg'
              : 'bg-white dark:bg-white/5 text-[#608a67] dark:text-[#8ba890] hover:bg-[#f0f5f1] dark:hover:bg-white/10'
            }`}
        >
          <Icon name="workspace_premium" className="mr-2" />
          Theo khối
        </button>
        <button
          onClick={() => setSelectedTab('center')}
          className={`flex-1 min-w-[150px] px-6 py-4 rounded-xl font-bold transition-all ${selectedTab === 'center'
              ? 'bg-primary text-[#052e16] shadow-lg'
              : 'bg-white dark:bg-white/5 text-[#608a67] dark:text-[#8ba890] hover:bg-[#f0f5f1] dark:hover:bg-white/10'
            }`}
        >
          <Icon name="public" className="mr-2" />
          Toàn trung tâm
        </button>
      </div>

      {/* Leaderboard Content */}
      <div className="space-y-6">
        {/* Grade Leaderboard */}
        {selectedTab === 'grade' && gradeLeaderboard && (
          <LeaderboardCard
            title="Xếp hạng theo khối"
            subtitle={studentGrade ? `Khối ${studentGrade}` : ''}
            leaderboard={gradeLeaderboard.leaderboard || []}
            currentUserUid={currentUser?.uid}
          />
        )}

        {selectedTab === 'grade' && !gradeLeaderboard && (
          <div className="clay-card p-12 text-center">
            <Icon name="school" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Không có dữ liệu xếp hạng khối
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Bạn chưa được phân lớp hoặc khối chưa có học sinh
            </p>
          </div>
        )}

        {/* Center Leaderboard */}
        {selectedTab === 'center' && centerLeaderboard && (
          <LeaderboardCard
            title="Xếp hạng toàn trung tâm"
            subtitle="Khối cao luôn xếp trên, sau đó mới đến khối thấp hơn"
            leaderboard={centerLeaderboard.leaderboard || []}
            currentUserUid={currentUser?.uid}
            showGrade={true}
          />
        )}

        {selectedTab === 'center' && !centerLeaderboard && (
          <div className="clay-card p-12 text-center">
            <Icon name="leaderboard" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
              Không có dữ liệu xếp hạng
            </h3>
            <p className="text-[#608a67] dark:text-[#8ba890]">
              Chưa có học sinh nào trong hệ thống
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 clay-card p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Icon name="info" className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-[#111812] dark:text-white mb-2">
              Cách tính xếp hạng
            </h4>
            <ul className="text-sm text-[#608a67] dark:text-[#8ba890] space-y-1">
              <li>• <strong>Theo lớp:</strong> Xếp hạng trong lớp bạn đang học</li>
              <li>• <strong>Theo khối:</strong> Xếp hạng trong toàn bộ khối (tất cả lớp cùng khối)</li>
              <li>
                • <strong>Toàn trung tâm:</strong> Khối cao nhất luôn ở top trước, sau đó mới đến khối
                thấp hơn
              </li>
              <li>• Xếp hạng dựa trên tổng điểm tích lũy của bạn</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
