import Icon from '../common/Icon';
import Card from '../common/Card';

const StatsCard = ({ icon, number, label, color = 'green' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
  };

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>
          <Icon name={icon} size={32} className={iconColorClasses[color]} filled />
        </div>
        <div>
          <div className="text-3xl font-black text-[#111812] dark:text-white">{number}</div>
          <div className="text-sm text-[#608a67] dark:text-[#8ba890] font-medium mt-1">
            {label}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
