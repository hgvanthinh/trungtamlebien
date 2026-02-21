/**
 * GoldIcon - Icon Đồng Vàng sử dụng gold.png
 * Dùng thống nhất trong toàn bộ dự án
 */
const GoldIcon = ({ size = 24, className = '' }) => {
    return (
        <img
            src="/gold.png"
            alt="Đồng Vàng"
            width={size}
            height={size}
            className={`inline-block object-contain ${className}`}
            style={{ width: size, height: size }}
            draggable={false}
        />
    );
};

export default GoldIcon;
