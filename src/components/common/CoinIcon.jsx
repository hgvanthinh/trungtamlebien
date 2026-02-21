/**
 * CoinIcon - Icon Xu (sử dụng Icon component với name="paid")
 * Dùng thống nhất trong toàn bộ dự án
 */
import Icon from './Icon';

const CoinIcon = ({ size = 24, className = '' }) => {
    return (
        <Icon
            name="paid"
            className={`text-yellow-500 ${className}`}
            style={{ fontSize: size }}
        />
    );
};

export default CoinIcon;
