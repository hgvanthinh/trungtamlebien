const Footer = () => {
  const buildTime = new Date(__BUILD_TIME__);
  const formatted = buildTime.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <footer style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#999' }}>
      Cập nhật lúc {formatted}
    </footer>
  );
};

export default Footer;
