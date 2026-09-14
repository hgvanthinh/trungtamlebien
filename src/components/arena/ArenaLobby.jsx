import { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import { ARENA_ITEM_EFFECTS } from '../../services/arenaItemService';
import { getArenaItems } from '../../services/arenaItemService';
import { startArenaMatch } from '../../services/arenaRewardService';

/**
 * Phòng chờ Đấu Trường.
 *
 * Chủ phòng (admin, hoặc HS vào đầu tiên nếu phòng bật uỷ quyền) bấm "Sẵn sàng"
 * để đưa cả phòng vào trận. Nút chỉ bật khi đủ số người tối thiểu.
 */

export default function ArenaLobby({ roomId, room, myUid, onLeave, onToast }) {
    const [starting, setStarting] = useState(false);
    const [myItems, setMyItems] = useState({});

    const players = room?.players || {};
    const playerList = Object.entries(players)
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    const count = playerList.length;
    const minPlayers = room?.minPlayers || 5;
    const isHost = room?.hostUid === myUid;
    const enough = count >= minPlayers;

    useEffect(() => {
        if (!myUid) return;
        getArenaItems(myUid).then(setMyItems);
    }, [myUid]);

    const handleStart = async () => {
        setStarting(true);
        try {
            await startArenaMatch(roomId);
            // Thành công: listener trên node phòng sẽ tự đưa mọi người vào trận.
            // Không setStarting(false) ở đây để nút không nhấp nháy trước lúc chuyển màn.
        } catch (error) {
            onToast?.({ type: 'error', message: error.message || 'Không bắt đầu được trận' });
            setStarting(false);
        }
    };

    const ownedList = Object.keys(myItems).filter((e) => ARENA_ITEM_EFFECTS[e]);

    return (
        <div className="space-y-3">
            {/* Thông tin phòng */}
            <div className="clay-card p-4">
                <div className="flex items-start gap-3">
                    <span className="shrink-0 size-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                        <Icon name="stadium" size={26} className="text-white" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-extrabold text-lg text-[#111812] dark:text-white truncate">
                            {room?.title || 'Phòng Đấu Trường'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-[#556958] dark:text-[#a5b5a8]">
                            {room?.folderName && (
                                <span className="flex items-center gap-0.5">
                                    <Icon name="folder" size={13} />
                                    {room.folderName}
                                </span>
                            )}
                            {room?.grade && <span>Khối {room.grade}</span>}
                        </div>
                    </div>
                </div>

                {/* Thể lệ ngắn */}
                <div className="mt-3 p-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 text-xs text-[#556958] dark:text-[#a5b5a8] space-y-1">
                    <p className="font-bold text-[#111812] dark:text-white">Thể lệ</p>
                    <p>· 3 câu trắc nghiệm (0,5đ — 30 giây/câu)</p>
                    <p>· 1 câu đúng-sai 4 ý (2đ — 3,5 phút)</p>
                    <p>· 1 câu điền đáp án (1đ)</p>
                    <p>· Bằng điểm thì ai làm nhanh hơn xếp trên</p>
                    <p className="text-primary-dark dark:text-primary font-bold pt-0.5">
                        Top 5 nhận 50/40/30/20/20 điểm tích luỹ
                    </p>
                </div>
            </div>

            {/* Vật phẩm của mình */}
            {ownedList.length > 0 && (
                <div className="clay-card p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Icon name="backpack" size={18} className="text-primary" />
                        <span className="text-sm font-extrabold text-[#111812] dark:text-white">
                            Vật phẩm của bạn ({ownedList.length})
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {ownedList.map((effect) => (
                            <span
                                key={effect}
                                title={ARENA_ITEM_EFFECTS[effect].description}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f5f1] dark:bg-white/5 text-xs font-bold text-[#111812] dark:text-white"
                            >
                                <Icon name={ARENA_ITEM_EFFECTS[effect].icon} size={14} className="text-primary" />
                                {ARENA_ITEM_EFFECTS[effect].label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Danh sách người chơi */}
            <div className="clay-card p-4">
                <div className="flex items-center gap-1.5 mb-3">
                    <Icon name="group" size={20} className="text-primary" />
                    <h3 className="font-extrabold text-[#111812] dark:text-white">
                        Người chơi
                    </h3>
                    <span
                        className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            enough
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                        }`}
                    >
                        {count}/{minPlayers}
                    </span>
                </div>

                <div className="space-y-1.5">
                    {playerList.map((p) => (
                        <div
                            key={p.uid}
                            className={`flex items-center gap-3 p-2 rounded-2xl ${
                                p.uid === myUid ? 'bg-primary/10' : 'bg-[#f0f5f1] dark:bg-white/5'
                            } ${p.online === false ? 'opacity-50' : ''}`}
                        >
                            <Avatar
                                src={p.avatar}
                                name={p.name}
                                borderUrl={p.borderUrl}
                                size="sm"
                                lazy={false}
                            />
                            <span className="flex-1 min-w-0 font-bold text-[#111812] dark:text-white truncate">
                                {p.name}
                                {p.uid === myUid && (
                                    <span className="ml-1 text-xs text-primary font-extrabold">(bạn)</span>
                                )}
                            </span>
                            {room?.hostUid === p.uid && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">
                                    Chủ phòng
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {!enough && (
                    <p className="mt-3 text-sm text-center text-[#556958] dark:text-[#a5b5a8]">
                        Cần thêm <b>{minPlayers - count}</b> người nữa mới bắt đầu được
                    </p>
                )}
            </div>

            {/* Điều khiển */}
            <div className="flex gap-2">
                <Button variant="secondary" icon="logout" onClick={onLeave} className="flex-1">
                    Rời phòng
                </Button>
                {isHost && (
                    <Button
                        variant="primary"
                        icon="play_arrow"
                        loading={starting}
                        disabled={!enough || starting}
                        onClick={handleStart}
                        className="flex-[2]"
                    >
                        Sẵn sàng!
                    </Button>
                )}
            </div>

            {!isHost && (
                <p className="text-sm text-center text-[#556958] dark:text-[#a5b5a8]">
                    Đang chờ chủ phòng bắt đầu trận...
                </p>
            )}
        </div>
    );
}
