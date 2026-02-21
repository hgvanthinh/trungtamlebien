// Temporary mock data - will be replaced with Firebase data later

// Homepage statistics - will be fetched from user's Firestore document
export const statsData = [
  { icon: 'auto_stories', number: '0', label: 'Bài học hoàn thành', color: 'blue' },
  { icon: 'emoji_events', number: '0%', label: 'Điểm trung bình', color: 'green' },
  { icon: 'local_fire_department', number: '0', label: 'Ngày streak', color: 'orange' },
  { icon: 'workspace_premium', number: '0', label: 'Huy chương đạt được', color: 'purple' },
];

// Upcoming classes - will be fetched from Firestore 'classes' collection
export const upcomingClasses = [
  {
    id: 1,
    subject: 'Hàm số bậc hai',
    time: '14:00 - 15:30',
    date: 'Hôm nay',
    teacher: { name: 'Thầy Biển', avatar: '' },
    status: 'upcoming',
    room: 'Phòng A1',
  },
];

// Quick access menu items
export const quickAccessItems = [
  { icon: 'edit_note', label: 'Làm bài tập', route: '/practice' },
  { icon: 'menu_book', label: 'Tài liệu', route: '/materials' },
  { icon: 'stadia_controller', label: 'Game Toán', route: '/games' },
  { icon: 'emoji_events', label: 'Bảng xếp hạng', route: '/leaderboard' },
  { icon: 'calendar_month', label: 'Lịch học', route: '/schedule' },
  { icon: 'gavel', label: 'Nội quy', route: '/rules' },
];

// Notifications - will be fetched from Firestore
export const notifications = [
  { id: 1, text: 'Chào mừng bạn đến với hệ thống!', time: 'Mới', unread: true },
];

// Leaderboard data - will be fetched from Firestore 'users' collection
export const leaderboardData = [];

// Games data - will be fetched from Firestore 'games' collection
export const gamesData = [
  {
    id: 1,
    title: 'Đua xe giải toán',
    description: 'Giải nhanh các bài toán để vượt qua đối thủ',
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400',
    rating: 4.8,
    category: 'Đại số',
    coins: 50,
    players: 0,
  },
  {
    id: 2,
    title: 'Bắn pháo hình học',
    description: 'Tính toán góc và lực để trúng đích',
    thumbnail: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=400',
    rating: 4.6,
    category: 'Hình học',
    coins: 45,
    players: 0,
  },
  {
    id: 3,
    title: 'Xếp hình phân số',
    description: 'Ghép các phân số để tạo thành hình hoàn chỉnh',
    thumbnail: 'https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=400',
    rating: 4.5,
    category: 'Số học',
    coins: 40,
    players: 0,
  },
];

// Top players - will be fetched from Firestore
export const topPlayers = [];

// Practice tests - will be fetched from Firestore 'tests' collection
export const practiceTests = [
  {
    id: 1,
    title: 'Kiểm tra giữa kỳ - Đại số',
    difficulty: 'Trung bình',
    duration: '45 phút',
    questions: 20,
    subject: 'Đại số',
    participants: [],
    completed: false,
    progress: 0,
  },
];

// Schedule data - will be fetched from Firestore
export const scheduleData = {
  events: [],
  classes: [
    {
      id: 1,
      time: '14:00 - 15:30',
      subject: 'Đại số',
      category: 'Lý thuyết',
      room: 'Phòng A1',
      teacher: { name: 'Thầy Biển', avatar: '' },
      status: 'upcoming',
      date: 'Hôm nay',
    },
  ],
  reminders: [
    { id: 1, text: 'Chào mừng bạn đến với hệ thống!', urgent: false },
  ],
};

// Rules data
export const rulesData = {
  coreRules: [
    {
      icon: 'schedule',
      title: 'Đúng giờ',
      description: 'Có mặt trước giờ học 5 phút. Tôn trọng thời gian của mọi người.',
    },
    {
      icon: 'workspace_premium',
      title: 'Tôn trọng',
      description: 'Tôn trọng giáo viên, bạn bè và môi trường học tập.',
    },
    {
      icon: 'task_alt',
      title: 'Hoàn thành bài tập',
      description: 'Nộp bài tập đầy đủ và đúng hạn để theo kịp tiến độ.',
    },
    {
      icon: 'how_to_reg',
      title: 'Tham gia tích cực',
      description: 'Chủ động đặt câu hỏi và tham gia thảo luận trên lớp.',
    },
  ],
  faqs: [
    {
      question: 'Nếu vắng mặt thì phải làm gì?',
      answer: 'Thông báo cho giáo viên trước ít nhất 1 ngày. Xem lại bài giảng được ghi hình và hoàn thành bài tập bù.',
    },
    {
      question: 'Làm thế nào để nhận được chứng chỉ?',
      answer: 'Hoàn thành ít nhất 80% bài học, đạt điểm trung bình từ 7.5 trở lên và tham gia đầy đủ các bài kiểm tra.',
    },
    {
      question: 'Quy định về thiết bị học tập?',
      answer: 'Mỗi học sinh cần chuẩn bị máy tính hoặc tablet, kết nối internet ổn định và tai nghe có mic.',
    },
  ],
  rewards: [
    'Học bổng cho học sinh xuất sắc',
    'Quà tặng cho top 3 mỗi tháng',
    'Chứng nhận hoàn thành khóa học',
  ],
  penalties: [
    'Cảnh cáo lần 1 nếu vắng không phép',
    'Trừ điểm nếu nộp bài trễ hạn',
    'Đình chỉ học nếu vi phạm nghiêm trọng',
  ],
};

// Materials data - will be fetched from Firestore 'materials' collection
export const materialsData = [
  {
    id: 1,
    title: 'Bài giảng Đại số 10 - Chương 1',
    type: 'PDF',
    date: '15/01/2024',
    size: '2.5 MB',
    thumbnail: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300',
    category: 'Đại số',
    featured: true,
  },
  {
    id: 2,
    title: 'Video bài giảng Hình học không gian',
    type: 'VIDEO',
    date: '14/01/2024',
    size: '125 MB',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300',
    category: 'Hình học',
    featured: true,
  },
];
