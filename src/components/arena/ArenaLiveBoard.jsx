import Avatar from '../common/Avatar';
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

            <div className="flex flex-wrap gap-2">
                {list.map((p) => (
                    <div
                        key={p.uid}
                        title={`${p.name}${p.answered ? ' — đã trả lời' : ''}`}
                        className={`relative shrink-0 transition-opacity ${p.online === false ? 'opacity-40' : ''}`}
                    >
                        <Avatar
                            src={p.avatar}
                            name={p.name}
                            borderUrl={p.borderUrl}
                            size="sm"
                            lazy={false}
                            className={p.uid === myUid ? 'ring-2 ring-primary ring-offset-1' : ''}
                        />
                        {p.answered && (
                            <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-green-500 border-2 border-white dark:border-surface-dark flex items-center justify-center">
                                <Icon name="check" size={10} className="text-white" />
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
