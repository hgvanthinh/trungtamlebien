import React from 'react';
// Import trực tiếp ảnh động từ thư mục assets
import rank1Gif from '../../assets/ranks/rank_1.gif';
import rank2Gif from '../../assets/ranks/rank_2.gif';
import rank3Gif from '../../assets/ranks/rank_3.gif';
import rank4Gif from '../../assets/ranks/rank_4.gif';
import rank6Gif from '../../assets/ranks/rank_6.gif';

const TopRankBorder = ({ children, rank, className = '' }) => {
  // Chỉ xử lý Top 10, các hạng khác trả về nguyên bản
  if (rank > 10 || !rank) return children;

  // Hàm lấy ảnh dựa theo rank
  const getBorderAsset = (r) => {
    switch (r) {
      case 1: return rank1Gif;
      case 2: return rank2Gif;
      case 3: return rank3Gif;
      case 4:
      case 5: return rank4Gif; // Rank 4,5 dùng chung gif rank 4
      case 6:
      case 7:
      case 8:
      case 9:
      case 10: return rank6Gif; // Rank 6-10 dùng chung gif rank 6
      default: return null;
    }
  };

  const borderImg = getBorderAsset(rank);

  // Scale riêng cho từng rank để dễ chỉnh
  const getScale = (r) => {
    switch (r) {
      case 1: return 1.9;
      case 2: return 1.1;
      case 3: return 1.2;
      case 4: return 1.65;
      case 5: return 1.65;
      case 6: return 1.9;
      case 7: return 1.9;
      case 8: return 1.9;
      case 9: return 1.9;
      case 10: return 1.9;
      default: return 1.9;
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {borderImg && (
        <img
          src={borderImg}
          alt={`Rank ${rank} Border`}
          className="absolute inset-0 w-full h-full object-cover z-1 pointer-events-none"
          style={{
            transform: `scale(${getScale(rank)})`
          }}
        />
      )}

      {/* 2. Container chứa Avatar gốc - NẰM TRÊN
         relative: Để set được z-index
         z-10: Layer cao hơn, đè lên ảnh động
      */}
      <div className="relative z-0">
        {children}
      </div>
    </div>
  );
};

export default TopRankBorder;