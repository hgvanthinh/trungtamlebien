import Card from '../common/Card';

const NotificationWidget = ({ notifications }) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-4">
        Thông báo
      </h3>
      <div className="flex flex-col gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded-xl border transition-colors ${
              notification.unread
                ? 'bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30'
                : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
            }`}
          >
            <p className="text-sm text-[#111812] dark:text-white font-medium">
              {notification.text}
            </p>
            <p className="text-xs text-[#608a67] dark:text-[#8ba890] mt-1">
              {notification.time}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default NotificationWidget;
