import Card from '../common/Card';
import Badge from '../common/Badge';
import Avatar from '../common/Avatar';
import Button from '../common/Button';

const ClassCard = ({ classItem }) => {
  const { subject, time, date, teacher, status, room } = classItem;

  const statusConfig = {
    live: { label: 'Đang diễn ra', color: 'red', action: 'Tham gia ngay' },
    upcoming: { label: 'Sắp diễn ra', color: 'orange', action: 'Chuẩn bị' },
    scheduled: { label: 'Đã lên lịch', color: 'blue', action: 'Xem chi tiết' },
  };

  const config = statusConfig[status] || statusConfig.scheduled;

  return (
    <Card className="p-6" variant="hover">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#111812] dark:text-white">{subject}</h3>
            <p className="text-sm text-[#608a67] dark:text-[#8ba890] mt-1">
              {time} • {date}
            </p>
          </div>
          <Badge color={config.color} size="sm">
            {config.label}
          </Badge>
        </div>

        {/* Teacher info */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Avatar src={teacher.avatar} name={teacher.name} size="sm" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#111812] dark:text-white">
              {teacher.name}
            </p>
            <p className="text-xs text-[#608a67] dark:text-[#8ba890]">{room}</p>
          </div>
          <Button variant={status === 'live' ? 'primary' : 'secondary'} size="sm">
            {config.action}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ClassCard;
