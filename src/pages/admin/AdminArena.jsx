import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    DEFAULT_ARENA_SETTINGS,
    TIME_PRESETS,
    formatSeconds,
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
    reopenArenaRoom,
    ARENA_MODE,
} from '../../services/arenaSessionService';
import {
    getArenaHistory,
    getArenaSessionDetail,
    getSessionDisplayStatus,
} from '../../services/arenaHistoryService';
import { deleteArenaHistory } from '../../services/arenaRewardService';
import ArenaSessionDetail from '../../components/arena/ArenaSessionDetail';
import { getFolders } from '../../services/questionFolderService';
import { getAllStoreItems } from '../../services/storeService';
import { ARENA_ITEM_EFFECTS, ARENA_ITEM_CATEGORY } from '../../services/arenaItemService';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { useConfirm } from '../../hooks/useConfirm';

const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1';

// Thời lượng từng dạng câu — có mốc dựng sẵn để admin bấm chọn nhanh
const TIME_FIELDS = [
    { key: 'abcdSeconds', label: 'Thời gian mỗi câu trắc nghiệm', min: 5 },
    { key: 'tfSeconds', label: 'Thời gian câu đúng-sai', min: 10 },
    { key: 'shortAnswerSeconds', label: 'Thời gian câu điền đáp án', min: 5 },
];

const SETTINGS_FIELDS = [
    { key: 'abcdPoints', label: 'Điểm mỗi câu trắc nghiệm', min: 0, step: 0.1 },
    { key: 'abcdCount', label: 'Số câu trắc nghiệm', min: 1 },
    { key: 'tfPoints', label: 'Điểm câu đúng-sai', min: 0, step: 0.1 },
    { key: 'shortAnswerPoints', label: 'Điểm câu điền đáp án', min: 0, step: 0.1 },
    { key: 'countdownSeconds', label: 'Đếm ngược trước câu đầu (giây)', min: 0 },
    { key: 'interstitialSeconds', label: 'Khoảng chuyển câu (giây)', min: 1 },
    { key: 'minPlayers', label: 'Số người tối thiểu để bắt đầu', min: 2 },
    { key: 'maxPlayers', label: 'Sức chứa tối đa mỗi phòng', min: 2 },
    { key: 'maxOpenRooms', label: 'Số phòng mở tối đa cùng lúc', min: 1 },
    { key: 'dailyCapPoints', label: 'Trần điểm tích luỹ mỗi ngày', min: 0 },
    { key: 'practiceMaxPerDay', label: 'Số lượt luyện tập mỗi ngày (0 = không giới hạn)', min: 0 },
];

/**
 * Ô chọn thời lượng: dropdown mốc dựng sẵn + ô nhập số tự do.
 * Giá trị không nằm trong mốc nào thì dropdown hiện "Tuỳ chỉnh".
 */
function TimeField({ label, value, min, onChange }) {
    const current = Number(value) || 0;
    const isPreset = TIME_PRESETS.some((p) => p.seconds === current);

    return (
        <div>
            <label className={labelCls}>{label}</label>
            <div className="flex gap-2">
                <select
                    value={isPreset ? String(current) : 'custom'}
                    onChange={(e) => {
                        if (e.target.value !== 'custom') onChange(e.target.value);
                    }}
                    className={inputCls}
                >
                    {TIME_PRESETS.map((p) => (
                        <option key={p.seconds} value={p.seconds}>
                            {p.label}
                        </option>
                    ))}
                    <option value="custom">Tuỳ chỉnh...</option>
                </select>
                <input
                    type="number"
                    min={min}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    title="Số giây"
                    className={`${inputCls} w-24 shrink-0`}
                />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                = {formatSeconds(current)}
            </p>
        </div>
    );
}

const GRADES = [6, 7, 8, 9, 10, 11, 12];

/** Firestore Timestamp (hoặc số ms) → chuỗi ngày giờ tiếng Việt */
const formatHistoryDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

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
        mode: ARENA_MODE.LIVE,
    });
    const [folderCheck, setFolderCheck] = useState(null);
    const [watchingRoomId, setWatchingRoomId] = useState(null);

    // Lịch sử trận
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [detail, setDetail] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [deleting, setDeleting] = useState(false);

    // Cài đặt
    const [settings, setSettings] = useState(DEFAULT_ARENA_SETTINGS);
    const [savingSettings, setSavingSettings] = useState(false);

    // Viền avatar đã gán hiệu ứng — không có cái nào thì HS không có vật phẩm để dùng
    const [effectBorders, setEffectBorders] = useState(null);

    // ===== Tải dữ liệu =====
    useEffect(() => {
        getFolders()
            .then(setFolders)
            .catch(() => setToast({ type: 'error', message: 'Không tải được thư mục đề' }));
        getArenaSettings(true).then(setSettings);

        // Đếm xem có viền nào thực sự gán hiệu ứng chưa. Đây là nguyên nhân số
        // một khiến học sinh "không dùng được vật phẩm": viền avatar không bắt
        // buộc gán effect, nên kho có thể toàn viền trang trí.
        getAllStoreItems()
            .then((items) =>
                setEffectBorders(
                    items.filter((i) => i.category === ARENA_ITEM_CATEGORY && i.effect)
                )
            )
            .catch(() => setEffectBorders([]));
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

    // Chỉ tải khi admin thực sự mở tab lịch sử — đây là truy vấn nặng nhất trang
    useEffect(() => {
        if (tab !== 'history') return;
        setHistoryLoading(true);
        getArenaHistory({ mode: historyFilter === 'all' ? null : historyFilter })
            .then(setHistory)
            .catch(() => setToast({ type: 'error', message: 'Không tải được lịch sử' }))
            .finally(() => setHistoryLoading(false));
    }, [tab, historyFilter]);

    const reloadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getArenaHistory({
                mode: historyFilter === 'all' ? null : historyFilter,
            });
            setHistory(data);
            setSelectedIds([]);
        } catch {
            setToast({ type: 'error', message: 'Không tải được lịch sử' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    /** Xoá các trận đã tick chọn */
    const handleDeleteSelected = () => {
        if (!selectedIds.length) return;
        showConfirm({
            title: `Xoá ${selectedIds.length} trận`,
            message: 'Xoá hẳn đề, kết quả và bản ghi thưởng của các trận này. Không thể hoàn tác.',
            onConfirm: async () => {
                setDeleting(true);
                try {
                    const res = await deleteArenaHistory({ sessionIds: selectedIds });
                    setToast({
                        type: 'success',
                        message: `Đã xoá ${res.deleted} trận${
                            res.skippedRunning ? ` (giữ lại ${res.skippedRunning} trận đang chạy)` : ''
                        }`,
                    });
                    await reloadHistory();
                } catch (error) {
                    setToast({ type: 'error', message: error.message || 'Không xoá được' });
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    /** Xoá mọi trận cũ hơn N ngày */
    const handleDeleteOlder = (days) => {
        showConfirm({
            title: `Xoá trận cũ hơn ${days} ngày`,
            message: 'Dọn bớt cho nhẹ dữ liệu. Trận đang chạy vẫn được giữ. Không thể hoàn tác.',
            onConfirm: async () => {
                setDeleting(true);
                try {
                    const res = await deleteArenaHistory({ olderThanDays: days });
                    setToast({
                        type: res.deleted ? 'success' : 'info',
                        message: res.deleted
                            ? `Đã xoá ${res.deleted} trận cũ`
                            : 'Không có trận nào đủ cũ để xoá',
                    });
                    await reloadHistory();
                } catch (error) {
                    setToast({ type: 'error', message: error.message || 'Không xoá được' });
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    /** Mở chi tiết một trận (đề đầy đủ + kết quả) */
    const openDetail = async (sessionId) => {
        try {
            const data = await getArenaSessionDetail(sessionId);
            if (!data) {
                setToast({ type: 'error', message: 'Không tìm thấy trận này' });
                return;
            }
            setDetail(data);
        } catch {
            setToast({ type: 'error', message: 'Không mở được chi tiết trận' });
        }
    };

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
                mode: form.mode,
            });

            if (!res.ok) {
                const messages = {
                    limit_reached: `Đã mở tối đa ${settings.maxOpenRooms} phòng cùng lúc`,
                    not_enough_questions: 'Thư mục đề không đủ câu theo cơ cấu 3 trắc nghiệm + 1 đúng-sai + 1 điền',
                };
                setToast({ type: 'error', message: messages[res.reason] || 'Không mở được phòng' });
                return;
            }

            setToast({
                type: 'success',
                message:
                    form.mode === ARENA_MODE.PRACTICE
                        ? 'Đã mở phòng luyện tập! Học sinh vào lúc nào cũng được.'
                        : 'Đã mở phòng thi đấu!',
            });
            setForm({
                title: '',
                folderId: '',
                grade: '',
                allowStudentHost: false,
                mode: form.mode,
            });
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
                    <Icon name="swords" size={28} className="text-blue-500" />
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
                    { key: 'history', label: 'Lịch sử', icon: 'history' },
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

                        {/* Chọn chế độ TRƯỚC, vì nó đổi ý nghĩa của các ô bên dưới */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                            {[
                                {
                                    key: ARENA_MODE.LIVE,
                                    icon: 'groups',
                                    title: 'Thi đấu trực tiếp',
                                    desc: 'Cả phòng thi cùng lúc. Chờ đủ người rồi chủ phòng bấm bắt đầu. Top 5 nhận thưởng theo hạng.',
                                },
                                {
                                    key: ARENA_MODE.PRACTICE,
                                    icon: 'self_improvement',
                                    title: 'Luyện tập ở nhà',
                                    desc: 'Phòng mở thường trực. HS vào lúc nào cũng được, làm một mình với đề random. Được mấy điểm cộng bấy nhiêu điểm tích luỹ.',
                                },
                            ].map((m) => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => setForm({ ...form, mode: m.key })}
                                    className={`p-3 rounded-lg text-left border-2 transition-colors ${
                                        form.mode === m.key
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                                    }`}
                                >
                                    <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                                        <Icon
                                            name={m.icon}
                                            size={18}
                                            className={form.mode === m.key ? 'text-blue-500' : 'text-gray-400'}
                                        />
                                        {m.title}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {m.desc}
                                    </p>
                                </button>
                            ))}
                        </div>

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

                        {/* Phòng luyện tập không có chủ phòng — ai vào cũng tự làm bài ngay */}
                        {form.mode === ARENA_MODE.LIVE && (
                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.allowStudentHost}
                                    onChange={(e) =>
                                        setForm({ ...form, allowStudentHost: e.target.checked })
                                    }
                                    className="size-4 rounded"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Cho học sinh tự bắt đầu (HS vào đầu tiên làm chủ phòng — chơi được ngoài giờ)
                                </span>
                            </label>
                        )}

                        {form.mode === ARENA_MODE.PRACTICE && (
                            <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sm text-sky-800 dark:text-sky-300">
                                <Icon name="info" size={16} className="inline mr-1 align-text-bottom" />
                                Phòng luyện tập mở thường trực: không cần đủ người, không có chủ phòng.
                                Mỗi HS vào là nhận một đề random riêng, làm xong xem được đáp án ngay.
                                Giới hạn <b>{settings.practiceMaxPerDay || 'không giới hạn'}</b> lượt/ngày
                                (sửa ở tab Cài đặt).
                            </div>
                        )}

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

                                        {room.mode === ARENA_MODE.PRACTICE ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300">
                                                Luyện tập
                                            </span>
                                        ) : (
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    room.status === 'running'
                                                        ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                                        : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                                }`}
                                            >
                                                {room.status === 'running' ? 'Đang đấu' : 'Đang chờ'}
                                            </span>
                                        )}

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
                                                    onOpenDetail={openDetail}
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

            {/* ===== TAB LỊCH SỬ ===== */}
            {tab === 'history' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h2 className="font-bold text-gray-900 dark:text-white">
                            Lịch sử ({history.length})
                        </h2>
                        <div className="ml-auto flex gap-1">
                            {[
                                { key: 'all', label: 'Tất cả' },
                                { key: 'live', label: 'Thi đấu' },
                                { key: 'practice', label: 'Luyện tập' },
                            ].map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setHistoryFilter(f.key)}
                                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                                        historyFilter === f.key
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dọn bớt cho nhẹ dữ liệu — mỗi trận lưu cả bộ đề */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="delete"
                            disabled={!selectedIds.length || deleting}
                            onClick={handleDeleteSelected}
                            className="text-red-500"
                        >
                            Xoá mục chọn{selectedIds.length ? ` (${selectedIds.length})` : ''}
                        </Button>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Xoá trận cũ hơn:</span>
                        {[7, 30, 90].map((d) => (
                            <button
                                key={d}
                                disabled={deleting}
                                onClick={() => handleDeleteOlder(d)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                            >
                                {d} ngày
                            </button>
                        ))}
                        {history.length > 0 && (
                            <button
                                onClick={() =>
                                    setSelectedIds(
                                        selectedIds.length === history.length
                                            ? []
                                            : history.map((h) => h.id)
                                    )
                                }
                                className="ml-auto text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {selectedIds.length === history.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                        )}
                    </div>

                    {historyLoading ? (
                        <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                            <Icon name="progress_activity" size={20} className="inline animate-spin mr-1" />
                            Đang tải...
                        </p>
                    ) : history.length === 0 ? (
                        <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                            Chưa có trận nào
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {history.map((h) => {
                                const top = (h.ranking || [])[0];
                                const isPractice = h.mode === 'practice';
                                return (
                                    <div
                                        key={h.id}
                                        className={`flex flex-wrap items-center gap-2 p-3 rounded-lg transition-colors ${
                                            selectedIds.includes(h.id)
                                                ? 'bg-red-50 dark:bg-red-500/10'
                                                : 'bg-gray-50 dark:bg-gray-700/50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(h.id)}
                                            onChange={() => toggleSelect(h.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="shrink-0 size-4 rounded cursor-pointer"
                                        />
                                        <span
                                            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${
                                                isPractice
                                                    ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300'
                                                    : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                            }`}
                                        >
                                            {isPractice ? 'Luyện tập' : 'Thi đấu'}
                                        </span>

                                        <button
                                            onClick={() => openDetail(h.id)}
                                            className="flex-1 min-w-[160px] text-left"
                                        >
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatHistoryDate(h.createdAt)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {h.playerCount || 0} thí sinh · {(h.questions || []).length} câu
                                                {isPractice && h.practiceResult && (
                                                    <> · {h.practiceResult.score}/{h.practiceResult.maxScore}đ</>
                                                )}
                                                {!isPractice && top && (
                                                    <> · Nhất: {top.name || 'HS'} ({top.score}đ)</>
                                                )}
                                            </p>
                                        </button>

                                        {getSessionDisplayStatus(h) === 'running' && (
                                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-bold animate-pulse">
                                                Đang chạy
                                            </span>
                                        )}
                                        {getSessionDisplayStatus(h) === 'abandoned' && (
                                            <span
                                                title="Trận không được chấm điểm vì cả phòng đã thoát hoặc phòng bị mở lại/đóng giữa chừng"
                                                className="shrink-0 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold"
                                            >
                                                Bỏ dở
                                            </span>
                                        )}
                                        <button
                                            onClick={() => openDetail(h.id)}
                                            className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                                            aria-label="Xem chi tiết"
                                        >
                                            <Icon name="chevron_right" size={18} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB CÀI ĐẶT ===== */}
            {tab === 'settings' && (
                <div className="space-y-5">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                        <h2 className="font-bold text-gray-900 dark:text-white mb-3">Luật chơi</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {TIME_FIELDS.map((f) => (
                                <TimeField
                                    key={f.key}
                                    label={f.label}
                                    value={settings[f.key]}
                                    min={f.min}
                                    onChange={(v) => setSettingValue(f.key, v)}
                                />
                            ))}
                        </div>

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

                        {effectBorders !== null && (
                            effectBorders.length === 0 ? (
                                <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
                                    <Icon name="error" size={16} className="inline mr-1 align-text-bottom" />
                                    <b>Chưa có viền nào được gán hiệu ứng</b> — nên học sinh vào trận
                                    sẽ không có vật phẩm nào để dùng. Vào{' '}
                                    <b>Cửa Hàng → sửa một viền avatar → Hiệu ứng Đấu Trường</b> để gán.
                                </div>
                            ) : (
                                <div className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-500/10 text-sm text-green-700 dark:text-green-300">
                                    <Icon name="check_circle" size={16} className="inline mr-1 align-text-bottom" />
                                    Đang có <b>{effectBorders.length} viền</b> gắn hiệu ứng:{' '}
                                    {effectBorders
                                        .map((b) => `${b.name} (${ARENA_ITEM_EFFECTS[b.effect]?.label || b.effect})`)
                                        .join(', ')}
                                    . Học sinh phải <b>sở hữu viền</b> mới dùng được skill tương ứng.
                                </div>
                            )
                        )}
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

            {detail && (
                <ArenaSessionDetail session={detail} onClose={() => setDetail(null)} />
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
function ArenaSpectator({ roomId, onToast, onOpenDetail }) {
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

    const handleReopen = async () => {
        try {
            await reopenArenaRoom(roomId);
            onToast?.({ type: 'success', message: 'Đã mở lại phòng, sẵn sàng cho lượt mới' });
        } catch {
            onToast?.({ type: 'error', message: 'Không mở lại được phòng' });
        }
    };

    const players = Object.entries(room?.players || {});
    const onlineCount = players.filter(([, p]) => p.online !== false).length;

    return (
        <div className="mt-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Trong phòng: {onlineCount} đang kết nối
                    {players.length !== onlineCount && ` / ${players.length} đã vào`}
                </span>
                <div className="flex gap-1">
                    {/* Xem trước đề của trận đang chạy, để kịp chuẩn bị giảng lại */}
                    {room?.status === 'running' && room?.sessionId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="quiz"
                            onClick={() => onOpenDetail?.(room.sessionId)}
                        >
                            Xem đề
                        </Button>
                    )}
                    {room?.status === 'running' && (
                        <Button variant="ghost" size="sm" icon="stop_circle" onClick={handleForceFinish}>
                            Dừng trận
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" icon="restart_alt" onClick={handleReopen}>
                        Mở lại phòng
                    </Button>
                </div>
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
