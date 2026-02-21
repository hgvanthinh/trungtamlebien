import { useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import SearchBar from '../components/common/SearchBar';
import Icon from '../components/common/Icon';
import { materialsData } from '../data/mockData';

const Materials = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'algebra', label: 'Đại số' },
    { id: 'geometry', label: 'Hình học' },
    { id: 'calculus', label: 'Giải tích' },
    { id: 'trigonometry', label: 'Lượng giác' },
  ];

  const fileTypeColors = {
    PDF: 'red',
    VIDEO: 'purple',
    DOCX: 'blue',
    PPTX: 'orange',
  };

  const fileTypeIcons = {
    PDF: 'picture_as_pdf',
    VIDEO: 'play_circle',
    DOCX: 'description',
    PPTX: 'slideshow',
  };

  const featured = materialsData.filter(m => m.featured);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-[#111812] dark:text-white mb-2">
          Tài liệu Học tập 📚
        </h1>
        <p className="text-[#608a67] dark:text-[#8ba890] text-lg">
          Kho tài liệu phong phú cho việc học tập
        </p>
      </div>

      {/* Search */}
      <SearchBar placeholder="Tìm kiếm tài liệu..." />

      {/* Featured Materials */}
      {featured.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-[#111812] dark:text-white mb-4">
            Tài liệu nổi bật ⭐
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((material) => (
              <Card key={material.id} className="p-0 overflow-hidden" variant="hover">
                <div
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${material.thumbnail})` }}
                />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge color={fileTypeColors[material.type]} size="sm">
                      <Icon name={fileTypeIcons[material.type]} size={14} className="mr-1" />
                      {material.type}
                    </Badge>
                    <Icon name="star" className="text-yellow-500" filled size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[#111812] dark:text-white mb-2">
                    {material.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-[#608a67] dark:text-[#8ba890] mb-4">
                    <span>📅 {material.date}</span>
                    <span>💾 {material.size}</span>
                  </div>
                  <Button variant="primary" className="w-full" icon="download">
                    Tải xuống
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-primary text-[#052e16] shadow-lg'
                : 'bg-white dark:bg-surface-dark text-[#608a67] dark:text-[#8ba890] hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {materialsData.map((material) => (
          <Card key={material.id} className="p-0 overflow-hidden" variant="hover">
            <div
              className="h-32 bg-cover bg-center"
              style={{ backgroundImage: `url(${material.thumbnail})` }}
            />
            <div className="p-4">
              <Badge color={fileTypeColors[material.type]} size="sm" className="mb-2">
                <Icon name={fileTypeIcons[material.type]} size={14} className="mr-1" />
                {material.type}
              </Badge>
              <h3 className="font-bold text-[#111812] dark:text-white mb-2 line-clamp-2">
                {material.title}
              </h3>
              <div className="text-xs text-[#608a67] dark:text-[#8ba890] space-y-1 mb-3">
                <div>📅 {material.date}</div>
                <div>💾 {material.size}</div>
              </div>
              <Button variant="secondary" size="sm" className="w-full" icon="download">
                Tải về
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-8 right-8 size-16 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-2xl hover:scale-110 transition-transform flex items-center justify-center z-50">
        <Icon name="help" size={28} />
      </button>
    </div>
  );
};

export default Materials;
