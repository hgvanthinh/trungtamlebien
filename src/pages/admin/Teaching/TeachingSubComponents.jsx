// src/pages/admin/Teaching/TeachingSubComponents.jsx
// ─── UI Sub-components for Teaching Page ──────────────

import Icon from '../../../components/common/Icon';

export const SortMenu = ({ showSortMenu, setShowSortMenu, sortBy, handleSortChange }) => {
    if (!showSortMenu) return null;
    return (
        <div className="absolute top-12 left-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl py-2 z-50 border border-gray-100 dark:border-gray-700">
            <button
                onClick={() => handleSortChange('points')}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${sortBy === 'points' ? 'text-green-600 dark:text-green-400 font-bold' : 'text-[#111812] dark:text-white'}`}
            >
                <Icon name="star" className="text-sm" /> Điểm hành vi
            </button>
            <button
                onClick={() => handleSortChange('coins')}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${sortBy === 'coins' ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-[#111812] dark:text-white'}`}
            >
                <Icon name="paid" className="text-sm" /> Vàng
            </button>
            <button
                onClick={() => handleSortChange('name')}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${sortBy === 'name' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-[#111812] dark:text-white'}`}
            >
                <Icon name="sort_by_alpha" className="text-sm" /> Tên
            </button>
        </div>
    );
};
