import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Card from '../../components/common/Card';
import Icon from '../../components/common/Icon';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalExams: 0,
    pendingSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Count total classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const totalClasses = classesSnapshot.size;

      // Count total students
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student')
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const totalStudents = studentsSnapshot.size;

      // Count total exams
      const examsSnapshot = await getDocs(collection(db, 'exams'));
      const totalExams = examsSnapshot.size;

      // Count pending submissions (status = 'submitted' for upload type exams)
      const submissionsQuery = query(
        collection(db, 'examSubmissions'),
        where('status', '==', 'submitted')
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const pendingSubmissions = submissionsSnapshot.size;

      setStats({
        totalClasses,
        totalStudents,
        totalExams,
        pendingSubmissions,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    {
      title: 'Dạy học',
      description: 'Quản lý nội dung bài giảng và tài liệu',
      icon: 'edit_note',
      color: 'blue',
      route: '/admin/teaching',
    },
    {
      title: 'Điểm danh',
      description: 'Điểm danh và theo dõi sự có mặt',
      icon: 'event_available',
      color: 'green',
      route: '/admin/attendance',
    },
    {
      title: 'Lớp học',
      description: 'Tạo và quản lý các lớp học',
      icon: 'groups',
      color: 'purple',
      route: '/admin/classes',
    },
    {
      title: 'Quản lý học sinh',
      description: 'Xem, chỉnh sửa và quản lý học sinh',
      icon: 'school',
      color: 'orange',
      route: '/admin/students',
    },
    {
      title: 'Kho đề thi',
      description: 'Quản lý và tạo đề thi mới',
      icon: 'quiz',
      color: 'blue',
      route: '/admin/exam-bank',
    },
    {
      title: 'Chấm bài',
      description: 'Chấm điểm bài nộp của học sinh',
      icon: 'grading',
      color: 'green',
      route: '/admin/grade-submissions',
    },
    {
      title: 'Cài đặt hình nền',
      description: 'Tùy chỉnh hình nền giao diện',
      icon: 'wallpaper',
      color: 'purple',
      route: '/admin/background-settings',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Icon name="groups" className="text-2xl text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
              {loading ? '...' : stats.totalClasses}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tổng lớp học</p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Icon name="school" className="text-2xl text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
              {loading ? '...' : stats.totalStudents}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tổng học sinh</p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Icon name="quiz" className="text-2xl text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
              {loading ? '...' : stats.totalExams}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Đề thi</p>
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-bold mb-4">Quản lý nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.route}
              to={link.route}
              className="clay-card p-6 transition-transform hover:scale-105"
            >
              <div className={`p-3 ${colorClasses[link.color]} rounded-xl w-fit mb-4`}>
                <Icon name={link.icon} className="text-3xl" />
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                {link.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
