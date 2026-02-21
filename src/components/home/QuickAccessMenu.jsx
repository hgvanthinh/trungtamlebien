import { Link } from 'react-router-dom';
import Icon from '../common/Icon';

const QuickAccessMenu = ({ items }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <Link
          key={index}
          to={item.route}
          className="clay-card p-6 flex flex-col items-center gap-3 hover:scale-105 transition-transform cursor-pointer"
        >
          <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center">
            <Icon name={item.icon} size={28} className="text-primary-dark" />
          </div>
          <span className="text-sm font-bold text-[#111812] dark:text-white text-center">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
};

export default QuickAccessMenu;
