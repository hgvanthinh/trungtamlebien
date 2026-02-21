import { useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Avatar from '../components/common/Avatar';
import SearchBar from '../components/common/SearchBar';
import { practiceTests } from '../data/mockData';

const Practice = () => {
  const [activeSubject, setActiveSubject] = useState('all');

  const subjects = [
    { id: 'all', label: 'Tất cả' },
    { id: 'algebra', label: 'Đại số' },
    { id: 'geometry', label: 'Hình học' },
    { id: 'calculus', label: 'Giải tích' },
  ];

  const difficultyColors = {
    'Dễ': 'green',
    'Trung bình': 'orange',
    'Khó': 'red',
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white mb-2">
          Luyện đề và Kiểm tra 📝
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] text-lg">
          Rèn luyện kỹ năng với các bài kiểm tra đa dạng
        </p>
      </div>

      {/* Search */}
      <SearchBar placeholder="Tìm kiếm đề thi..." />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 text-center">
          <div className="text-4xl font-black text-primary mb-2">12</div>
          <div className="text-sm text-[#608a67] dark:text-[#8ba890]">Đề đã hoàn thành</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-4xl font-black text-orange-500 mb-2">5</div>
          <div className="text-sm text-[#608a67] dark:text-[#8ba890]">Đề đang làm</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-4xl font-black text-blue-500 mb-2">8.5</div>
          <div className="text-sm text-[#608a67] dark:text-[#8ba890]">Điểm trung bình</div>
        </Card>
      </div>

      {/* Subject Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            onClick={() => setActiveSubject(subject.id)}
            className={`px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${
              activeSubject === subject.id
                ? 'bg-primary text-[#052e16] shadow-lg'
                : 'bg-white dark:bg-surface-dark text-[#608a67] dark:text-[#8ba890] hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {subject.label}
          </button>
        ))}
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {practiceTests.map((test) => (
          <Card key={test.id} className="p-6" variant="hover">
            <div className="flex items-start justify-between mb-3">
              <Badge color={difficultyColors[test.difficulty]} size="sm">
                {test.difficulty}
              </Badge>
              {test.completed && (
                <Badge color="green" size="sm">✓ Hoàn thành</Badge>
              )}
            </div>

            <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-3">
              {test.title}
            </h3>

            <div className="space-y-2 mb-4 text-sm text-[#608a67] dark:text-[#8ba890]">
              <div>⏱ {test.duration}</div>
              <div>📋 {test.questions} câu hỏi</div>
            </div>

            {/* Participants */}
            {test.participants.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-2">
                  {test.participants.slice(0, 3).map((avatar, i) => (
                    <Avatar key={i} src={avatar} size="xs" border />
                  ))}
                </div>
                <span className="text-xs text-[#608a67] dark:text-[#8ba890]">
                  {test.participants.length > 3
                    ? `+${test.participants.length - 3} người khác`
                    : `${test.participants.length} người tham gia`}
                </span>
              </div>
            )}

            {/* Progress */}
            {test.progress > 0 && !test.completed && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#608a67] dark:text-[#8ba890]">Tiến độ</span>
                  <span className="text-[#111812] dark:text-white font-bold">{test.progress}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${test.progress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant={test.completed ? 'secondary' : 'primary'}
              className="w-full"
              icon={test.completed ? 'visibility' : 'play_arrow'}
            >
              {test.completed ? 'Xem lại' : test.progress > 0 ? 'Tiếp tục' : 'Bắt đầu'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Practice;
