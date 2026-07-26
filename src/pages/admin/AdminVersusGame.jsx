import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    getVersusGames,
    deleteVersusGame
} from '../../services/versusGameService';
import {
    DEFAULT_VERSUS_SETTINGS,
    getVersusSettings,
    updateVersusSettings
} from '../../services/versusSettingsService';
import {
    getActiveLobbies,
    openLobby,
    closeLobby,
    deleteLobby
} from '../../services/versusSessionService';
import { VERSUS_ITEM_EFFECTS } from '../../services/versusItemService';
import VersusGameForm from '../../components/versus/VersusGameForm';
import VersusSpectator from '../../components/versus/VersusSpectator';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import { useConfirm } from '../../hooks/useConfirm';

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

const SETTINGS_FIELDS = [
    { key: 'winCoins', label: 'Xu thưởng người thắng', min: 0 },
    { key: 'loseCoins', label: 'Xu cho người thua', min: 0 },
    { key: 'defaultWinSteps', label: 'Số bước thắng mặc định (khi tạo bài)', min: 1 },
    { key: 'defaultFreezeDuration', label: 'Giây đóng băng khi trả lời sai (mặc định)', min: 0 },
    { key: 'maxOpenLobbies', label: 'Số phòng mở tối đa cùng lúc', min: 1 },
    { key: 'maxMatchesPerRoom', label: 'Số trận tối đa mỗi phòng (mặc định)', min: 1 }
];

export default function AdminVersusGame() {
    const { currentUser } = useAuth();
    const { showConfirm, ConfirmDialog } = useConfirm();

    const [activeTab, setActiveTab] = useState('games');
    const [toast, setToast] = useState(null);

    // Tab bài đấu
    const [games, setGames] = useState([]);
    const [activeLobbies, setActiveLobbies] = useState([]); // [gameId]
    const [loading, setLoading] = useState(true);
    const [lobbyBusy, setLobbyBusy] = useState(null); // gameId đang xử lý mở/đóng phòng

    // Form tạo/sửa & spectator
    const [showForm, setShowForm] = useState(false);
    const [editingGame, setEditingGame] = useState(null);
    const [spectating, setSpectating] = useState(null); // { gameId, gameTitle }

    // Tab cài đặt
    const [settingsForm, setSettingsForm] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);

    const loadGames = useCallback(async () => {
        try {
            setLoading(true);
            const [gameList, lobbies] = await Promise.all([
                getVersusGames(),
                currentUser?.uid ? getActiveLobbies(currentUser.uid) : Promise.resolve([])
            ]);
            setGames(gameList);
            setActiveLobbies(lobbies);
        } catch (error) {
            console.error('Error loading versus games:', error);
            setToast({ type: 'error', message: 'Lỗi khi tải danh sách bài đấu' });
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadGames();
    }, [loadGames]);

    useEffect(() => {
        if (activeTab === 'settings' && !settingsForm) {
            getVersusSettings(true)
                .then(s => setSettingsForm({ ...DEFAULT_VERSUS_SETTINGS, ...s }))
                .catch(() => setSettingsForm({ ...DEFAULT_VERSUS_SETTINGS }));
        }
    }, [activeTab, settingsForm]);

    // ===== Phòng đấu =====

    const handleOpenLobby = async (game) => {
        try {
            setLobbyBusy(game.id);
            const result = await openLobby(game.id, currentUser.uid, game.title);
            if (!result.ok) {
                if (result.reason === 'limit_reached') {
                    setToast({ type: 'warning', message: 'Đã đạt giới hạn phòng mở. Hãy đóng bớt phòng khác trước.' });
                } else {
                    setToast({ type: 'error', message: 'Không mở được phòng.' });
                }
                return;
            }
            setActiveLobbies(prev => prev.includes(game.id) ? prev : [...prev, game.id]);
            setToast({ type: 'success', message: `Đã mở phòng "${game.title}"! Học sinh có thể vào phòng chờ.` });
        } catch (error) {
            setToast({ type: 'error', message: 'Lỗi khi mở phòng: ' + error.message });
        } finally {
            setLobbyBusy(null);
        }
    };

    const handleCloseLobby = (game) => {
        showConfirm({
            title: 'Đóng phòng đấu',
            message: `Đóng phòng "${game.title}"? Học sinh đang trong phòng chờ sẽ không ghép trận mới được nữa.`,
            confirmText: 'Đóng phòng',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLobbyBusy(game.id);
                    await closeLobby(game.id, currentUser.uid);
                    setActiveLobbies(prev => prev.filter(id => id !== game.id));
                    setToast({ type: 'success', message: `Đã đóng phòng "${game.title}"` });
                } catch (error) {
                    setToast({ type: 'error', message: 'Lỗi khi đóng phòng: ' + error.message });
                } finally {
                    setLobbyBusy(null);
                }
            }
        });
    };

    const handleDeleteGame = (game) => {
        const isOpen = activeLobbies.includes(game.id);
        showConfirm({
            title: 'Xóa bài đấu',
            message: `Bạn có chắc muốn xóa bài đấu "${game.title}"?${isOpen ? ' Phòng đang mở sẽ bị xóa luôn.' : ''} Không thể hoàn tác!`,
            confirmText: 'Xóa',
            type: 'danger',
            onConfirm: async () => {
                try {
                    if (isOpen) {
                        await deleteLobby(game.id, currentUser.uid);
                        setActiveLobbies(prev => prev.filter(id => id !== game.id));
                    }
                    await deleteVersusGame(game.id);
                    setGames(prev => prev.filter(g => g.id !== game.id));
                    setToast({ type: 'success', message: `Đã xóa bài đấu "${game.title}"` });
                } catch (error) {
                    setToast({ type: 'error', message: 'Lỗi khi xóa bài đấu: ' + error.message });
                }
            }
        });
    };

    // ===== Cài đặt =====

    const handleSaveSettings = async () => {
        try {
            setSavingSettings(true);
            const partial = {};
            SETTINGS_FIELDS.forEach(({ key, min }) => {
                const num = Number(settingsForm[key]);
                partial[key] = Number.isFinite(num) ? Math.max(min, num) : DEFAULT_VERSUS_SETTINGS[key];
            });
            await updateVersusSettings(partial);
            setSettingsForm(prev => ({ ...prev, ...partial }));
            setToast({ type: 'success', message: 'Đã lưu cài đặt Đấu Trí 1v1!' });
        } catch (error) {
            setToast({ type: 'error', message: 'Lỗi khi lưu cài đặt: ' + error.message });
        } finally {
            setSavingSettings(false);
        }
    };

    // ===== Chế độ xem phụ (spectator / form) =====

    if (spectating) {
        return (
            <VersusSpectator
                gameId={spectating.gameId}
                gameTitle={spectating.gameTitle}
                onClose={() => { setSpectating(null); loadGames(); }}
            />
        );
    }

    if (showForm) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <button
                    onClick={() => { setShowForm(false); setEditingGame(null); }}
                    className="inline-flex items-center gap-1 mb-4 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    <Icon name="arrow_back" size={18} /> Quay lại danh sách
                </button>
                <VersusGameForm
                    game={editingGame}
                    onSaved={() => {
                        setShowForm(false);
                        setEditingGame(null);
                        setToast({ type: 'success', message: editingGame ? 'Đã cập nhật bài đấu!' : 'Đã tạo bài đấu mới!' });
                        loadGames();
                    }}
                    onCancel={() => { setShowForm(false); setEditingGame(null); }}
                />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">⚔️ Đấu Trí 1v1 - Quản lý</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Tạo bài đấu, mở phòng cho học sinh thách đấu nhau và cài đặt luật chơi
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {[
                    { id: 'games', label: '⚔️ Bài đấu' },
                    { id: 'settings', label: '⚙️ Cài đặt' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-colors ${activeTab === tab.id
                            ? 'bg-primary text-[#052e16]'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB: BÀI ĐẤU ===== */}
            {activeTab === 'games' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <Button icon="add" onClick={() => { setEditingGame(null); setShowForm(true); }}>
                            Tạo bài đấu mới
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : games.length === 0 ? (
                        <div className="clay-card p-12 text-center">
                            <div className="text-6xl mb-4">⚔️</div>
                            <p className="text-gray-600 dark:text-gray-400 text-lg">
                                Chưa có bài đấu nào. Bấm "Tạo bài đấu mới" để bắt đầu!
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {games.map(game => {
                                const isOpen = activeLobbies.includes(game.id);
                                const busy = lobbyBusy === game.id;
                                return (
                                    <div key={game.id} className="clay-card p-5">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                                {game.title}
                                            </h3>
                                            {isOpen && (
                                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 text-xs font-bold">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                    Đang mở phòng
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                            <span className="inline-flex items-center gap-1">
                                                <Icon name="quiz" size={16} /> {game.questions?.length || 0} câu
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Icon name="flag" size={16} /> {game.winSteps} bước thắng
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Icon name="swords" size={16} /> {game.matchesPlayed || 0}/{game.maxMatches || 20} trận
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Icon name="calendar_today" size={16} />
                                                {game.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || '—'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {isOpen ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        icon="visibility"
                                                        onClick={() => setSpectating({ gameId: game.id, gameTitle: game.title })}
                                                    >
                                                        Xem live
                                                    </Button>
                                                    <button
                                                        onClick={() => handleCloseLobby(game)}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50"
                                                    >
                                                        <Icon name="door_front" size={18} /> Đóng phòng
                                                    </button>
                                                </>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    icon="meeting_room"
                                                    loading={busy}
                                                    onClick={() => handleOpenLobby(game)}
                                                >
                                                    Mở phòng
                                                </Button>
                                            )}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon="edit"
                                                onClick={() => { setEditingGame(game); setShowForm(true); }}
                                            >
                                                Sửa
                                            </Button>
                                            <button
                                                onClick={() => handleDeleteGame(game)}
                                                className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
                                            >
                                                <Icon name="delete" size={18} /> Xóa
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB: CÀI ĐẶT ===== */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {!settingsForm ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <>
                            <div className="clay-card p-6">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">⚙️ Luật chơi & giới hạn</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {SETTINGS_FIELDS.map(({ key, label, min }) => (
                                        <div key={key}>
                                            <label className={labelCls}>{label}</label>
                                            <input
                                                type="number"
                                                min={min}
                                                className={inputCls}
                                                value={settingsForm[key]}
                                                onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    className="mt-6"
                                    icon="save"
                                    loading={savingSettings}
                                    onClick={handleSaveSettings}
                                >
                                    {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
                                </Button>
                            </div>

                            <div className="clay-card p-6">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-3">🎒 Vật phẩm Đấu Trí (bán ở Cửa Hàng)</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Để học sinh mua vật phẩm dùng trong trận, vào <b>Quản Lý Cửa Hàng</b>:
                                    tạo loại hàng có key <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400">versus-item</code> (đặt
                                    tên loại là "Versus Item" để key tự sinh đúng), rồi thêm món hàng thuộc loại đó và chọn "Hiệu ứng Đấu Trí":
                                </p>
                                <div className="space-y-2">
                                    {Object.entries(VERSUS_ITEM_EFFECTS).map(([key, effect]) => (
                                        <div key={key} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
                                            <Icon name={effect.icon} size={24} className="text-primary shrink-0" />
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                    {effect.label}
                                                    <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400">({key})</span>
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{effect.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <ConfirmDialog />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
