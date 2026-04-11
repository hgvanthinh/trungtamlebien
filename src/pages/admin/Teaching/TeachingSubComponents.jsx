// src/pages/admin/Teaching/TeachingSubComponents.jsx
// ─── UI Sub-components for Teaching Page ──────────────

import { useMemo } from 'react';
import Avatar from '../../../components/common/Avatar';
import Icon from '../../../components/common/Icon';

/**
 * TopRankBorder: creates a glowing border depending on the rank
 */
export const TopRankBorder = ({ rank, children }) => {
    let classes = '';
    const glowLevel = rank <= 3 ? 'drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]' : '';

    if (rank === 1) {
        classes = `rounded-full p-2 bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-600 animate-pulse-slow border-4 border-white/20 shadow-2xl ${glowLevel}`;
    } else if (rank === 2) {
        classes = `rounded-full p-1.5 bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500 border-2 border-white/30 shadow-xl ${glowLevel}`;
    } else if (rank === 3) {
        classes = `rounded-full p-1 bg-gradient-to-br from-amber-600 via-yellow-700 to-amber-800 border-[1.5px] border-white/40 shadow-lg ${glowLevel}`;
    } else if (rank <= 5) {
        classes = `rounded-full p-0.5 bg-gradient-to-br from-gray-700 via-gray-600 to-gray-800 border border-white/10 shadow-md transform scale-95`;
    } else {
        classes = `rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm opacity-90 transform scale-90`;
    }

    return (
        <div className={`relative ${classes} transition-all duration-300 hover:scale-105 active:scale-95`}>
            {children}
            {rank === 1 && (
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10 animate-bounce cursor-pointer flex justify-center w-full"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    <div className="relative">
                        <Icon name="military_tech" className="text-4xl text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,1)]" />
                    </div>
                </div>
            )}
            {rank === 2 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 w-full flex justify-center">
                    <Icon name="grade" className="text-2xl text-gray-400 drop-shadow-[0_0_5px_rgba(156,163,175,0.8)]" />
                </div>
            )}
            {rank === 3 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 w-full flex justify-center">
                    <Icon name="star_half" className="text-xl text-amber-600 drop-shadow-[0_0_5px_rgba(217,119,6,0.8)]" />
                </div>
            )}
        </div>
    );
};

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
