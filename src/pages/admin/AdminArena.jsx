import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    DEFAULT_ARENA_SETTINGS,
    getArenaSettings,
    updateArenaSettings,
} from '../../services/arenaSettingsService';
import {
    openArenaRoom,
    closeArenaRoom,
    deleteArenaRoom,
    listenToOpenArenaRooms,
    listenToArenaRoom,
    checkFolderAvailability,
    forceFinishArenaMatch,
} from '../../services/arenaSessionService';
import { getFolders } from '../../services/questionFolderService';
import { ARENA_ITEM_EFFECTS } from '../../services/arenaItemService';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import Avatar from '../../components/common/Avatar';
import { useConfirm } from '../../hooks/useConfirm';

const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1';

const SETTINGS_FIELDS = [
    { key: 'abcdSeconds', label: 'Giây mỗi câu trắc nghiệm', min: 5 },
    { key: 'abcdPoints', label: 'Điểm mỗi câu trắc nghiệm', min: 0, step: 0.1 },
    { key: 'abcdCount', label: 'Số câu trắc nghiệm', min: 1 },
    { key: 'tfSeconds', label: 'Giây câu đúng-sai', min: 10 },
    { key: 'tfPoints', label: 'Điểm câu đúng-sai', min: 0, step: 0.1 },
    { key: 'shortAnswerSeconds', label: 'Giây câu điền đáp án', min: 5 },
    { key: 'shortAnswerPoints', label: 'Điểm câu điền đáp án', min: 0, step: 0.1 },
    { key: 'countdownSeconds', label: 'Đếm ngược trước câu đầu (giây)', min: 0 },
    { key: 'interstitialSeconds', label: 'Khoảng chuyển câu (giây)', min: 1 },
    { key: 'minPlayers', label: 'Số người tối thiểu để bắt đầu', min: 2 },
    { key: 'maxPlayers', label: 'Sức chứa tối đa mỗi phòng', min: 2 },
    { key: 'maxOpenRooms', label: 'Số phòng mở tối đa cùng lúc', min: 1 },
    { key: 'dailyCapPoints', label: 'Trần điểm tích luỹ mỗi ngày', min: 0 },
];

const GRADES = [6, 7, 8, 9, 10, 11, 12];

export default function AdminArena() {
    const { currentUser } = useAuth();
    const { showConfirm, ConfirmDialog } = useConfirm();

    const [tab, setTab] = useState('rooms');
    const [toast, setToast] = useState(null);

    // Phòng
    const [rooms, setRooms] = useState([]);
    const [folders, setFolders] = useState([]);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        title: '',
        folderId: '',
        grade: '',
        allowStudentHost: false,
    });
    const [folderCheck, setFolderCheck] = useState(null);
    const [watchingRoomId, setWatchingRoomId] = useState(null);

    // Cài đặt
    const [settings, setSettings] = useState(DEFAULT_ARENA_SETTINGS);
    const [savingSettings, setSavingSettings] = useState(false);

    // ===== Tải dữ liệu =====
    useEffect(() => {
        getFolders()
            .then(setFolders)
            .catch(() => setToast({ type: 'error', message: 'Không tải được thư mục đề' }));
        getArenaSettings(true).then(setSettings);
    }, []);

    useEffect(() => {
        return listenToOpenArenaRooms(setRooms);
    }, []);

    // Kiểm tra thư mục có đủ câu không, ngay khi admin chọn
    useEffect(() => {
        if (!form.folderId) {
            setFolderCheck(null);
            return;
        }
        checkFolderAvailability(form.folderId)
            .then(setFolderCheck)
            .catch(() => setFolderCheck(null));
    }, [form.folderId]);

    const handleCreate = async () => {
        if (!form.title.trim()) {
            setToast({ type: 'error', message: 'Vui lòng nhập tên phòng' });
            return;
        }
        if (!form.folderId) {
            setToast({ type: 'error', message: 'Vui lòng chọn thư mục đề' });
            return;
        }

        setCreating(true);
        try {
            const folder = folders.find((f) => f.id === form.folderId);
            const res = await openArenaRoom({
                teacherId: currentUser.uid,
                title: form.title.trim(),
                folderId: form.folderId,
                folderName: folder?.name || '',
                grade: form.grade ? Number(form.grade) : null,
                allowStudentHost: form.allowStudentHost,
            });

            if (!res.ok) {
                const messages = {
                    limit_reached: `Đã mở tối đa ${settings.maxOpenRooms} phòng cùng lúc`,
                    not_enough_questions: 'Thư mục đề không đủ câu theo cơ cấu 3 trắc nghiệm + 1 đúng-sai + 1 điền',
                };
                setToast({ type: 'error', message: messages[res.reason] || 'Không mở được phòng' });
                return;
            }

            setToast({ type: 'success', message: 'Đã mở phòng!' });
            setForm({ title: '', folderId: '', grade: '', allowStudentHost: false });
        } catch (error) {
            setToast({ type: 'error', message: error.message || 'Không mở được phòng' });
        } finally {
            setCreating(false);
        }
    };

    const handleClose = (roomId) => {
        showConfirm({
            title: 'Đóng phòng',
            message: 'Học sinh đang trong phòng sẽ bị đưa ra ngoài. Tiếp tục?',
            onConfirm: async () => {
                await closeArenaRoom(roomId, currentUser.uid);
                setToast({ type: 'success', message: 'Đã đóng phòng' });
            },
        });
    };

    const handleDelete = (roomId) => {
        showConfirm({
            title: 'Xoá phòng',
            message: 'Xoá hẳn phòng và dữ liệu trận đang chạy. Không thể hoàn tác.',
            onConfirm: async () => {
                await deleteArenaRoom(roomId, currentUser.uid);
                setToast({ type: 'success', message: 'Đã xoá phòng' });
            },
        });
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await updateArenaSettings(settings);
            setToast({ type: 'success', message: 'Đã lưu cài đặt' });
        } catch {
            setToast({ type: 'error', message: 'Không lưu được cài đặt' });
        } finally {
            setSavingSettings(false);
        }
    };

    const setSettingValue = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value === '' ? '' : Number(value) }));
    };

    const setRewardValue = (rank, value) => {
        setSettings((prev) => ({
            ...prev,
            rewards: { ...prev.rewards, [rank]: Number(value) || 0 },
        }));
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <div className="mb-5">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="stadium" size={28} className="text-blue-500" />
                    Đấu Trường
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Quiz nhiều người chơi — đề random từ kho câu hỏi, Top 5 nhận điểm tích luỹ
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
                {[
                    { key: 'rooms', label: 'Phòng đấu', icon: 'meeting_room' },
                    { key: 'settings', label: 'Cài đặt', icon: 'settings' },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold transition-colors ${
                            tab === t.key
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        <Icon name={t.icon} size={18} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB PHÒNG ===== */}
            {tab === 'rooms' && (
                <div className="space-y-5">
                    {/* Mở phòng mới */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-3">Mở phòng mới</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Tên phòng *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="VD: Đấu Trường Toán 9 — Tuần 3"
                                    className={inputCls}
                                />
                            </div>

                            <div>
                                <label className={labelCls}>Thư mục đề *</label>
                                <select
                                    value={form.folderId}
                                    onChange={(e) => setForm({ ...form, folderId: e.target.value })}
                                    className={inputCls}
                                >
                                    <option value="">-- Chọn thư mục --</option>
                                    {folders.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.icon} {f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelCls}>Khối được chơi</label>
                                <select
                                    value={form.grade}
                                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                                    className={inputCls}
                                >
                                    <option value="">Tất cả các khối</option>
                                    {GRADES.map((g) => (
                                        <option key={g} value={g}>
                                            Khối {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Cảnh báo thiếu câu */}
                        {folderCheck && (
                            <div
                                className={`mt-3 p-3 rounded-lg text-sm ${
                                    folderCheck.ok
                                        ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
                                        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                                }`}
                            >
                                <Icon
                                    name={folderCheck.ok ? 'check_circle' : 'error'}
                                    size={16}
                                    className="inline mr-1 align-text-bottom"
                                />
                                {folderCheck.ok ? 'Thư mục đủ câu để mở phòng. ' : 'Thư mục KHÔNG đủ câu. '}
                                Trắc nghiệm: {folderCheck.counts.abcd}/{folderCheck.need.abcd} ·
                                Đúng-sai: {folderCheck.counts.true_false}/{folderCheck.need.true_false} ·
                                Điền đáp án: {folderCheck.counts.short_answer}/{folderCheck.need.short_answer}
                            </div>
                        )}

                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.allowStudentHost}
                                onChange={(e) => setForm({ ...form, allowStudentHost: e.target.checked })}
                                className="size-4 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Cho học sinh tự bắt đầu (HS vào đầu tiên làm chủ phòng — chơi được ngoài giờ)
                            </span>
                        </label>

                        <Button
                            variant="primary"
                            icon="add"
                            loading={creating}
                            disabled={creating || (folderCheck && !folderCheck.ok)}
                            onClick={handleCreate}
                            className="mt-4"
                        >
                            Mở phòng
                        </Button>
                    </div>

                    {/* Danh sách phòng đang mở */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-3">
                            Phòng đang mở ({rooms.length})
                        </h2>

                        {rooms.length === 0 ? (
                            <p className="py-6 text-center text-gray-500 dark:text-gray-400">
                                Chưa có phòng nào đang mở
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {rooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                                    >
                                        <div className="flex-1 min-w-[180px]">
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {room.title}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {room.folderName} ·{' '}
                                                {room.grade ? `Khối ${room.grade}` : 'Mọi khối'} ·{' '}
                                                {room.playerCount || 0} người
                                            </p>
                                        </div>

                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                room.status === 'running'
                                                    ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                                    : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                            }`}
                                        >
                                            {room.status === 'running' ? 'Đang đấu' : 'Đang chờ'}
                                        </span>

                                        <div className="flex gap-1.5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="visibility"
                                                onClick={() =>
                                                    setWatchingRoomId(
                                                        watchingRoomId === room.id ? null : room.id
                                                    )
                                                }
                                            >
                                                {watchingRoomId === room.id ? 'Ẩn' : 'Xem'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="close"
                                                onClick={() => handleClose(room.id)}
                                            >
                                                Đóng
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="delete"
                                                onClick={() => handleDelete(room.id)}
                                                className="text-red-500"
                                            >
                                                Xoá
                                            </Button>
                                        </div>

                                        {watchingRoomId === room.id && (
                                            <div className="w-full">
                                                <ArenaSpectator
                                                    roomId={room.id}
                                                    onToast={setToast}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB CÀI ĐẶT ===== */}
            {tab === 'settings' && (
                <div className="space-y-5">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-3">Luật chơi</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {SETTINGS_FIELDS.map((f) => (
                                <div key={f.key}>
                                    <label className={labelCls}>{f.label}</label>
                                    <input
                                        type="number"
                                        min={f.min}
                                        step={f.step || 1}
                                        value={settings[f.key] ?? ''}
                                        onChange={(e) => setSettingValue(f.key, e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-sm text-blue-700 dark:text-blue-300">
                            <Icon name="info" size={16} className="inline mr-1 align-text-bottom" />
                            Câu đúng-sai chấm theo bậc thang: đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%,
                            cả 4 ý = 100% số điểm. Bậc thang này cố định trong mã nguồn.
                        </div>
                    </div>

                    {/* Phần thưởng */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-3">
                            Thưởng điểm tích luỹ (Top 5)
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {[1, 2, 3, 4, 5].map((rank) => (
                                <div key={rank}>
                                    <label className={labelCls}>Hạng {rank}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={settings.rewards?.[rank] ?? ''}
                                        onChange={(e) => setRewardValue(rank, e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            Trần <b>{settings.dailyCapPoints}</b> điểm/ngày từ Đấu Trường. Chạm trần
                            thì vẫn nhận phần còn lại chứ không mất trắng.
                        </p>
                    </div>

                    {/* Hướng dẫn vật phẩm */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-1">Vật phẩm</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Vật phẩm chính là <b>viền avatar</b> trong Cửa Hàng. Vào{' '}
                            <b>Cửa Hàng → sửa viền → Hiệu ứng Đấu Trường</b> để gán. Học sinh sở hữu
                            viền nào thì mỗi trận dùng được skill đó 1 lần, <b>viền không bị mất</b>.
                        </p>
                        <div className="space-y-2">
                            {Object.entries(ARENA_ITEM_EFFECTS).map(([key, eff]) => (
                                <div
                                    key={key}
                                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                                >
                                    <Icon name={eff.icon} size={20} className="text-blue-500 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                            {eff.label}
                                            <code className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                {key}
                                            </code>
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {eff.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        icon="save"
                        loading={savingSettings}
                        onClick={handleSaveSettings}
                    >
                        Lưu cài đặt
                    </Button>
                </div>
            )}

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
            <ConfirmDialog />
        </div>
    );
}

/**
 * Khán đài: xem ai đang trong phòng, và dừng trận nếu bị treo.
 */
function ArenaSpectator({ roomId, onToast }) {
    const [room, setRoom] = useState(null);

    useEffect(() => {
        return listenToArenaRoom(roomId, setRoom);
    }, [roomId]);

    const handleForceFinish = async () => {
        if (!room?.sessionId) return;
        try {
            await forceFinishArenaMatch(room.sessionId);
            onToast?.({ type: 'success', message: 'Đã dừng trận, hệ thống sẽ chấm điểm' });
        } catch {
            onToast?.({ type: 'error', message: 'Không dừng được trận' });
        }
    };

    const players = Object.entries(room?.players || {});

    return (
        <div className="mt-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Trong phòng ({players.length})
                </span>
                {room?.status === 'running' && (
                    <Button variant="ghost" size="sm" icon="stop_circle" onClick={handleForceFinish}>
                        Dừng trận
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {players.map(([uid, p]) => (
                    <div
                        key={uid}
                        title={p.name}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${
                            p.online === false ? 'opacity-50' : ''
                        }`}
                    >
                        <Avatar src={p.avatar} name={p.name} borderUrl={p.borderUrl} size="xs" lazy={false} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {p.name}
                        </span>
                        {room?.hostUid === uid && <span className="text-xs">👑</span>}
                    </div>
                ))}
                {players.length === 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Chưa có ai</span>
                )}
            </div>
        </div>
    );
}
