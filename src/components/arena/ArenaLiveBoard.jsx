import Icon from '../common/Icon';

/**
 * Bảng theo dõi trong trận.
 *
 * CHỦ Ý KHÔNG HIỆN ĐIỂM: điểm chỉ tồn tại sau khi Cloud Function chấm cuối trận,
 * client không biết ai đúng ai sai. Ở đây chỉ hiện ai đã nộp câu hiện tại và ai
 * còn online — vừa đủ để tạo áp lực thi đấu mà không lộ kết quả.
 */
export default function ArenaLiveBoard({ players = {}, answers = {}, questionIndex, myUid }) {
    const list = Object.entries(players).map(([uid, p]) => ({
        uid,
        ...p,
        answered: answers?.[uid]?.[questionIndex] !== undefined,
    }));

    // Người đã nộp lên trước, rồi tới người còn online
    list.sort((a, b) => {
        if (a.answered !== b.answered) return a.answered ? -1 : 1;
        if ((a.online !== false) !== (b.online !== false)) return a.online === false ? 1 : -1;
        return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

    const answeredCount = list.filter((p) => p.answered).length;

    return (
        <div className="clay-card p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
                <Icon name="groups" size={18} className="text-primary" />
                <span className="text-sm font-extrabold text-[#111812] dark:text-white">
                    Người chơi
                </span>
                <span className="ml-auto text-xs font-bold text-[#556958] dark:text-[#a5b5a8]">
                    {answeredCount}/{list.length} đã trả lời
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {list.map((p) => (
                    <span
                        key={p.uid}
                        title={`${p.name}${p.answered ? ' — đã trả lời' : ''}`}
                        className={`flex items-center gap-1 max-w-[140px] px-2 py-1 rounded-full text-xs font-bold transition-colors
                            ${p.answered
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                : 'bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8]'
                            }
                            ${p.uid === myUid ? 'ring-1 ring-primary' : ''}
                            ${p.online === false ? 'opacity-40' : ''}`}
                    >
                        {p.answered && <Icon name="check" size={12} className="shrink-0" />}
                        <span className="truncate">{p.name}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
