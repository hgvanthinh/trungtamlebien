// src/pages/admin/Teaching/Leaderboard.jsx
// ─── Extract Leaderboard visualization logic ───────────────

import { useMemo } from 'react';
import Avatar from '../../../components/common/Avatar';
import Icon from '../../../components/common/Icon';
import TopRankBorder from '../../../components/common/TopRankBorder';
import RunningPigBadge from '../../../components/common/RunningPigBadge';

export function Leaderboard({ students, ripples, rippleGif, rankBgImg }) {
    // Top 10 by totalBehaviorPoints
    const topStudents = useMemo(() => {
        return [...students]
            .filter(s => (s.totalBehaviorPoints || 0) > 0)
            .sort((a, b) => (b.totalBehaviorPoints || 0) - (a.totalBehaviorPoints || 0))
            .slice(0, 10);
    }, [students]);

    return (
        <div
            className="clay-card p-6 sticky top-6 relative overflow-hidden h-full"
            style={{
                background: rankBgImg ? `url(${rankBgImg}) center top / 200% auto no-repeat, linear-gradient(to bottom, transparent 0%, transparent 40%, #020702 40%, #020702 100%)` : '#020702'
            }}
        >
            {/* Ripple Effects */}
            {ripples.map(ripple => (
                <img
                    key={ripple.id}
                    src={rippleGif}
                    className="absolute pointer-events-none z-20 select-none"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: '300px',
                        height: '300px',
                        transform: 'translate(-50%, -50%)',
                    }}
                    alt=""
                />
            ))}

            <h2
                className="relative z-10 text-xl font-bold text-center text-lime-300 mb-6 pointer-events-none animate-neon-green"
                style={{ textShadow: `-2px -1px 0 #4ade80, 2px -1px 0 #4ade80, -1px 1px 0 #4ade80, 1px 1px 0 #4ade80` }}
            >
                TOP XẾP HẠNG LỚP
                <style>{`
                    @keyframes neonGreen {
                        0%, 100% { filter: drop-shadow(0 0 6px rgba(132,204,22,1)) drop-shadow(0 0 18px rgba(163,230,53,0.95)) drop-shadow(0 0 36px rgba(34,197,94,0.85)); }
                        50% { filter: drop-shadow(0 0 12px rgba(132,204,22,1)) drop-shadow(0 0 30px rgba(163,230,53,1)) drop-shadow(0 0 54px rgba(34,197,94,0.95)); }
                    }
                    .animate-neon-green { animation: neonGreen 1.6s ease-in-out infinite; }
                `}</style>
            </h2>

            {/* Top 5 Visual */}
            <div className="mb-8 relative z-10">
                {/* Top 3 Row */}
                <div className="flex justify-center items-end gap-2 mb-4">
                    {/* Rank 2 */}
                    {topStudents[1] && (
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <TopRankBorder rank={2}>
                                    <Avatar src={topStudents[1].avatar} name={topStudents[1].fullName} size="lg" />
                                </TopRankBorder>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-green-700 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">2</div>
                            </div>
                        </div>
                    )}

                    {/* Rank 1 */}
                    {topStudents[0] && (
                        <div className="flex flex-col items-center -mt-4">
                            <div className="relative">
                                <TopRankBorder rank={1}>
                                    <Avatar src={topStudents[0].avatar} name={topStudents[0].fullName} size="xl" />
                                </TopRankBorder>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-[14px] shadow-lg border-2 border-white z-20">1</div>
                            </div>
                        </div>
                    )}

                    {/* Rank 3 */}
                    {topStudents[2] && (
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <TopRankBorder rank={3}>
                                    <Avatar src={topStudents[2].avatar} name={topStudents[2].fullName} size="lg" />
                                </TopRankBorder>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">3</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Top 4-5 Row */}
                <div className="flex justify-center items-center gap-4">
                    {topStudents[3] && (
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <TopRankBorder rank={4}>
                                    <Avatar src={topStudents[3].avatar} name={topStudents[3].fullName} size="md" />
                                </TopRankBorder>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">4</div>
                            </div>
                        </div>
                    )}
                    {topStudents[4] && (
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <TopRankBorder rank={5}>
                                    <Avatar src={topStudents[4].avatar} name={topStudents[4].fullName} size="md" />
                                </TopRankBorder>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[9px] shadow-lg border-2 border-white z-20">5</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Top 6-10 Row */}
                <div className="flex justify-center items-center gap-3 mt-4">
                    {[5, 6, 7, 8, 9].map((index) => {
                        const student = topStudents[index];
                        if (!student) return null;
                        const rank = index + 1;
                        return (
                            <div key={student.uid} className="flex flex-col items-center">
                                <div className="relative">
                                    <TopRankBorder rank={rank}>
                                        <Avatar src={student.avatar} name={student.fullName} size="sm" />
                                    </TopRankBorder>
                                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shadow-lg border-2 border-white z-20">{rank}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Ranked List */}
            <div className="space-y-2 relative z-10">
                {topStudents.map((student, index) => (
                    <div
                        key={student.uid}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                            index === 0 ? 'bg-cyan-100 dark:bg-cyan-900/40' :
                            index === 1 ? 'bg-sky-100 dark:bg-sky-900/40' :
                            index === 2 ? 'bg-blue-100 dark:bg-blue-900/40' :
                            index === 3 ? 'bg-stone-100 dark:bg-stone-800/40' :
                            index === 4 ? 'bg-neutral-100 dark:bg-neutral-800/40' :
                            index === 5 ? 'bg-gray-100 dark:bg-gray-800/40' :
                            index === 6 ? 'bg-slate-100 dark:bg-slate-800/40' :
                            index === 7 ? 'bg-zinc-100 dark:bg-zinc-800/40' :
                            index === 8 ? 'bg-stone-50 dark:bg-stone-800/30' :
                            'bg-gray-50 dark:bg-gray-800/30'
                        }`}
                    >
                        <span className="text-2xl font-bold text-gray-900 dark:text-white w-8">{index + 1}</span>
                        <span className="flex-1 font-medium text-gray-900 dark:text-white truncate">
                            {student.fullName.split(' ').slice(-2).join(' ')}
                            <RunningPigBadge level={student.pigLevel} />
                        </span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {student.totalBehaviorPoints || 0}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
