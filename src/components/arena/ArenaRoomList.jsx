import { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import { listenToOpenArenaRooms, ARENA_MODE } from '../../services/arenaSessionService';

/**
 * Danh sách phòng Đấu Trường đang mở.
 *
 * Hai loại phòng nằm chung một danh sách nhưng đọc rất khác nhau:
 * - Luyện tập: vào lúc nào cũng được, làm một mình → luôn bấm được.
 * - Thi đấu: phải chờ đủ người và chưa vào trận → khoá khi đang thi đấu.
 *
 * Lọc theo khối của HS — phòng có grade = null thì mọi khối đều vào được.
 */
export default function ArenaRoomList({ myGrade, onJoin, minPlayers = 5 }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        return listenToOpenArenaRooms((list) => {
            setRooms(list);
            setLoading(false);
        });
    }, []);

    const visible = rooms.filter((r) => {
        if (!r.grade) return true;
        if (!myGrade) return true;
        return Number(r.grade) === Number(myGrade);
    });

    if (loading) {
        return (
            <div className="clay-card p-10 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                <Icon name="progress_activity" size={22} className="animate-spin" />
                Đang tải phòng...
            </div>
        );
    }

    if (visible.length === 0) {
        return (
            <div className="clay-card p-10 flex flex-col items-center gap-2 text-center">
                <Icon name="meeting_room" size={44} className="text-[#556958] dark:text-[#a5b5a8] opacity-50" />
                <p className="font-extrabold text-[#111812] dark:text-white">
                    Chưa có phòng nào mở
                </p>
                <p className="text-sm text-[#556958] dark:text-[#a5b5a8]">
                    Đợi thầy cô mở phòng Đấu Trường nhé!
                </p>
            </div>
        );
    }

    // Phòng luyện tập lên trước: đó là thứ HS vào được bất cứ lúc nào
    const sorted = [...visible].sort((a, b) => {
        const ap = a.mode === ARENA_MODE.PRACTICE ? 0 : 1;
        const bp = b.mode === ARENA_MODE.PRACTICE ? 0 : 1;
        return ap - bp;
    });

    return (
        <div className="space-y-2.5">
            {sorted.map((room) => {
                const isPractice = room.mode === ARENA_MODE.PRACTICE;
                const isRunning = !isPractice && room.status === 'running';
                const count = Number(room.playerCount) || 0;
                const enough = count >= minPlayers;

                return (
                    <button
                        key={room.id}
                        onClick={() => !isRunning && onJoin(room.id, room.mode)}
                        disabled={isRunning}
                        className={`w-full clay-card p-4 flex items-center gap-3 text-left transition-all
                            ${isRunning
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:scale-[1.01] active:scale-[0.99]'
                            }`}
                    >
                        <span
                            className={`shrink-0 size-12 rounded-2xl bg-gradient-to-br flex items-center justify-center ${
                                isPractice
                                    ? 'from-sky-400 to-indigo-500'
                                    : 'from-primary to-primary-dark'
                            }`}
                        >
                            <Icon
                                name={isPractice ? 'self_improvement' : 'swords'}
                                size={26}
                                className="text-white"
                            />
                        </span>

                        <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-[#111812] dark:text-white truncate">
                                {room.title || 'Phòng Đấu Trường'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-[#556958] dark:text-[#a5b5a8]">
                                {room.folderName && (
                                    <span className="flex items-center gap-0.5">
                                        <Icon name="folder" size={13} />
                                        {room.folderName}
                                    </span>
                                )}
                                {room.grade && <span>Khối {room.grade}</span>}
                                {isPractice ? (
                                    <span className="flex items-center gap-0.5 font-bold text-sky-600 dark:text-sky-400">
                                        <Icon name="person" size={13} />
                                        Luyện một mình
                                    </span>
                                ) : (
                                    <span
                                        className={`flex items-center gap-0.5 font-bold ${
                                            enough ? 'text-green-600 dark:text-green-400' : ''
                                        }`}
                                    >
                                        <Icon name="group" size={13} />
                                        {count}/{minPlayers} người
                                    </span>
                                )}
                            </div>
                        </div>

                        {isPractice ? (
                            <span className="shrink-0 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-extrabold">
                                Luyện tập
                            </span>
                        ) : isRunning ? (
                            <span className="shrink-0 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-extrabold">
                                Đang thi đấu
                            </span>
                        ) : (
                            <Icon name="chevron_right" size={22} className="shrink-0 text-[#556958] dark:text-[#a5b5a8]" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
