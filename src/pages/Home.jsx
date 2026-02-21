import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import StatsCard from '../components/home/StatsCard';
import QuickAccessMenu from '../components/home/QuickAccessMenu';

const Home = () => {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalExams: 0,
    completedExams: 0,
    averageScore: 0,
    totalClasses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  const loadStats = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Count student's exam submissions
      const submissionsQuery = query(
        collection(db, 'examSubmissions'),
        where('studentUid', '==', currentUser.uid)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const totalExams = submissionsSnapshot.size;

      // Count graded submissions and calculate average
      const gradedSubmissions = submissionsSnapshot.docs.filter(
        (doc) => doc.data().status === 'graded'
      );
      const completedExams = gradedSubmissions.length;

      let averageScore = 0;
      if (completedExams > 0) {
        const totalScore = gradedSubmissions.reduce((sum, doc) => {
          return sum + (doc.data().score || 0);
        }, 0);
        averageScore = Math.round(totalScore / completedExams);
      }

      // Count student's classes
      let totalClasses = 0;
      if (userProfile?.classId) {
        totalClasses = 1;
      }

      setStats({
        totalExams,
        completedExams,
        averageScore,
        totalClasses,
      });
    } catch (error) {
      console.error('Error loading student stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsData = [
    {
      icon: 'quiz',
      number: loading ? '...' : stats.totalExams,
      label: 'Đề thi đã làm',
      color: 'blue',
    },
    {
      icon: 'task_alt',
      number: loading ? '...' : stats.completedExams,
      label: 'Bài đã chấm',
      color: 'green',
    },
    {
      icon: 'emoji_events',
      number: loading ? '...' : `${stats.averageScore}`,
      label: 'Điểm trung bình',
      color: 'orange',
    },
    {
      icon: 'groups',
      number: loading ? '...' : stats.totalClasses,
      label: 'Lớp học',
      color: 'purple',
    },
  ];

  const quickAccessItems = [
    { icon: 'quiz', label: 'Đề thi', route: '/exams' },
    { icon: 'emoji_events', label: 'Bảng xếp hạng', route: '/leaderboard' },
    { icon: 'person', label: 'Hồ sơ cá nhân', route: '/profile' },
    { icon: 'gavel', label: 'Nội quy', route: '/rules' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      {/* Welcome Banner */}
      <div className="clay-card p-8 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10">
        <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white mb-2">
          Chào mừng, {userProfile?.fullName || 'Học sinh'}! 👋
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] text-lg">
          Hãy bắt đầu hành trình học tập của bạn hôm nay
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Quick Access Menu */}
      <div className="mt-4">
        <h2 className="text-2xl font-bold text-[#111812] dark:text-white mb-4">
          Truy cập nhanh
        </h2>
        <QuickAccessMenu items={quickAccessItems} />
      </div>
    </div>
  );
};

export default Home;
