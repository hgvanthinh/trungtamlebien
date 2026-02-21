import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';
import { scheduleData } from '../data/mockData';

const Schedule = () => {
  const { classes, reminders } = scheduleData;

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto pb-10">
      {/* Left Sidebar - Calendar */}
      <div className="lg:w-80">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-4">
            Tháng 1, 2024
          </h3>
          {/* Simple calendar placeholder */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
              <div key={day} className="text-xs font-bold text-[#608a67] dark:text-[#8ba890] py-2">
                {day}
              </div>
            ))}
            {[...Array(31)].map((_, i) => (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center text-sm rounded-lg ${
                  i === 14 ? 'bg-primary text-[#052e16] font-bold' : 'text-[#111812] dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </Card>

        {/* Reminders */}
        <Card className="p-6 mt-4">
          <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-4">
            Nhắc nhở
          </h3>
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`p-3 rounded-xl border ${
                  reminder.urgent
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
                }`}
              >
                <p className="text-sm text-[#111812] dark:text-white">{reminder.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right Content - Schedule List */}
      <div className="flex-1">
        <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white mb-6">
          Lịch học của tôi 📅
        </h1>

        <div className="space-y-4">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="p-6" variant="hover">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Time */}
                <div className="flex-shrink-0">
                  <div className="text-2xl font-black text-primary">{classItem.time.split(' - ')[0]}</div>
                  <div className="text-sm text-[#608a67] dark:text-[#8ba890]">{classItem.date}</div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-[#111812] dark:text-white">
                        {classItem.subject}
                      </h3>
                      <p className="text-sm text-[#608a67] dark:text-[#8ba890] mt-1">
                        {classItem.room}
                      </p>
                    </div>
                    <Badge
                      color={classItem.status === 'live' ? 'red' : classItem.status === 'upcoming' ? 'orange' : 'blue'}
                      size="sm"
                    >
                      {classItem.status === 'live' ? '🔴 Đang diễn ra' : classItem.status === 'upcoming' ? 'Sắp bắt đầu' : 'Đã lên lịch'}
                    </Badge>
                  </div>

                  <Badge color="gray" size="sm" className="mb-3">
                    {classItem.category}
                  </Badge>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <Avatar src={classItem.teacher.avatar} name={classItem.teacher.name} size="sm" />
                      <span className="text-sm font-medium text-[#111812] dark:text-white">
                        {classItem.teacher.name}
                      </span>
                    </div>
                    <Button
                      variant={classItem.status === 'live' ? 'primary' : 'secondary'}
                      size="sm"
                      icon={classItem.status === 'live' ? 'videocam' : 'info'}
                    >
                      {classItem.status === 'live' ? 'Tham gia' : 'Chi tiết'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schedule;
