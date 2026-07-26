import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, addDoc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
    listenToSessionMeta,
    listenToPlayerQuestion,
    submitAnswer,
    claimFirestoreSubmission,
    claimReward,
    scheduleSessionCleanup,
    updatePlayerStatus,
    registerDisconnect,
    claimWinByDisconnect,
    surrender,
    savePlayerRounds,
    waitForPlayerRounds,
} from '../../services/versusSessionService';
import { getVersusGame } from '../../services/versusGameService';
import { getVersusItems, consumeVersusItem, VERSUS_ITEM_EFFECTS } from '../../services/versusItemService';
import { getVersusSettings } from '../../services/versusSettingsService';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Avatar from '../common/Avatar';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const DISCONNECT_GRACE_MS = 45 * 1000; // đối thủ mất kết nối quá 45s → được claim thắng

/**
 * Thanh tiến độ score/winSteps của 1 đấu thủ
 */
function RaceBar({ score, winSteps, colorClass }) {
    const percent = Math.min(100, Math.max(0, ((score || 0) / (winSteps || 1)) * 100));
    return (
        <div className="h-3 rounded-full bg-[#f0f5f1] dark:bg-white/10 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

/**
 * VersusMatch — phòng đấu 1v1 realtime của tính năng "Đấu Trí 1v1".
 * Port từ VersusMatchRoom (giaoviendoimoi), giữ nguyên trình tự logic chống race:
 *  - playerKeyRef chống stale closure trong handleMatchEnd
 *  - resultHandledRef chống double-run (StrictMode + meta listener bắn nhiều lần)
 *  - thứ tự handleMatchEnd: cancel disconnect → savePlayerRounds → effect 3s → modal
 *    → waitForPlayerRounds → claimFirestoreSubmission → ghi Firestore → cleanup
 *
 * Props: { sessionId, gameId, onExit }
 */
export default function VersusMatch({ sessionId, gameId, onExit }) {
    const { currentUser, userProfile, updateUserProfile } = useAuth();
    const { showConfirm, ConfirmDialog } = useConfirm();
    const playerId = currentUser?.uid || null;

    // ===== State chính =====
    const [meta, setMeta] = useState(null);
    const [question, setQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [playerKey, setPlayerKey] = useState(null); // 'player1' | 'player2'
    const [notParticipant, setNotParticipant] = useState(false); // uid không thuộc trận
    const [loading, setLoading] = useState(true);

    // Multi-type state
    const [tfAnswers, setTfAnswers] = useState({}); // { statementIndex: true|false }
    const [shortText, setShortText] = useState('');

    // Freeze (client-side timer)
    const [frozenUntil, setFrozenUntil] = useState(0);
    const [freezeProgress, setFreezeProgress] = useState(0);
    const [freezeRemainingSec, setFreezeRemainingSec] = useState(0);

    // Kết thúc trận
    const [matchResult, setMatchResult] = useState(null); // { won, forceStopped?, myScore, opponentScore, opponentName }
    const [endEffect, setEndEffect] = useState(null); // { won, forceStopped } — overlay 3s trước modal
    const [rewardCoins, setRewardCoins] = useState(0); // xu thưởng đã cộng (hiện trong modal)
    const [disconnectCountdown, setDisconnectCountdown] = useState(null);
    const [exiting, setExiting] = useState(false);

    // Vật phẩm
    const [items, setItems] = useState({ double_step: [], fifty_fifty: [] });
    const [usedDouble, setUsedDouble] = useState(false);
    const [usedFifty, setUsedFifty] = useState(false);
    const [doubleArmed, setDoubleArmed] = useState(false);
    const [hiddenIndices, setHiddenIndices] = useState([]); // 50/50: index đáp án bị ẩn (theo vị trí hiển thị)

    // ===== Refs chống stale closure / double-run (giữ như nguồn) =====
    const playerKeyRef = useRef(null); // mirror playerKey cho handleMatchEnd
    const resultHandledRef = useRef(false); // chỉ xử lý kết thúc 1 lần
    const roundsLogRef = useRef([]); // lịch sử câu hỏi của bản thân
    const cancelDisconnectRef = useRef(null); // hàm hủy onDisconnect trigger
    const disconnectTimerRef = useRef(null); // timer 45s claim thắng do disconnect
    const disconnectWinRef = useRef(false); // client này thắng nhờ đối thủ disconnect
    const gameSnapshotRef = useRef(null); // mirror gameSnapshot cho handleMatchEnd
    const userProfileRef = useRef(null); // mirror userProfile (cộng xu local đúng số dư mới nhất)
    const doubleArmedRef = useRef(false); // mirror doubleArmed cho handleAnswer
    const hiddenIndicesRef = useRef([]); // mirror hiddenIndices (ghi itemUsed vào rounds log)
    const questionStartRef = useRef(0); // đo timeMs mỗi câu (set khi câu hỏi đến)
    const handleMatchEndRef = useRef(null); // mirror handleMatchEnd cho listener khai báo trước nó

    useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);
    useEffect(() => { doubleArmedRef.current = doubleArmed; }, [doubleArmed]);
    useEffect(() => { hiddenIndicesRef.current = hiddenIndices; }, [hiddenIndices]);

    // ===== Load gameSnapshot (questions, shuffleAnswers, freezeDuration...) =====
    useEffect(() => {
        if (!gameId) return;
        let alive = true;
        getVersusGame(gameId)
            .then((g) => {
                if (!alive) return;
                gameSnapshotRef.current = g;
            })
            .catch((e) => console.error('[VersusMatch] Load gameSnapshot error:', e));
        return () => { alive = false; };
    }, [gameId]);

    // ===== Load vật phẩm versus trong túi đồ =====
    useEffect(() => {
        if (!playerId) return;
        let alive = true;
        getVersusItems(playerId)
            .then((result) => { if (alive) setItems(result); })
            .catch((e) => console.error('[VersusMatch] Load items error:', e));
        return () => { alive = false; };
    }, [playerId]);

    // ===== Đăng ký onDisconnect khi playerKey xác định xong =====
    useEffect(() => {
        if (!sessionId || !playerKey) return;
        let cancelled = false;
        registerDisconnect(sessionId, playerKey).then((cancelFn) => {
            if (cancelled) { cancelFn(); return; }
            cancelDisconnectRef.current = cancelFn;
        });
        return () => {
            cancelled = true;
            // Hủy trigger khi unmount bình thường (không phải disconnect thật)
            if (cancelDisconnectRef.current) cancelDisconnectRef.current();
            if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        };
    }, [sessionId, playerKey]);

    // ===== Listen meta =====
    useEffect(() => {
        if (!sessionId) return;
        const unsubscribe = listenToSessionMeta(sessionId, (data) => {
            setMeta(data);
            setLoading(false);
            if (!data) return;

            // Xác định playerKey lần đầu từ meta (chống stale closure bằng ref)
            if (!playerKeyRef.current && playerId) {
                if (data.player1?.id === playerId) { playerKeyRef.current = 'player1'; setPlayerKey('player1'); }
                else if (data.player2?.id === playerId) { playerKeyRef.current = 'player2'; setPlayerKey('player2'); }
                else setNotParticipant(true); // đích không có chế độ khán giả trong file này
            }

            // Sync freeze từ RTDB (trường hợp reload giữa lúc bị đóng băng)
            if (playerKey) {
                const myFrozen = data[playerKey]?.frozenUntil || 0;
                if (myFrozen > Date.now()) setFrozenUntil(myFrozen);
            }

            // Phát hiện đối thủ disconnect → timer 45s claim thắng
            if (playerKey && data.status !== 'finished') {
                const oppKey = playerKey === 'player1' ? 'player2' : 'player1';
                const oppDisconnectedAt = data[oppKey]?.disconnectedAt;
                if (oppDisconnectedAt && !disconnectTimerRef.current) {
                    const elapsed = Date.now() - oppDisconnectedAt;
                    const remaining = Math.max(0, DISCONNECT_GRACE_MS - elapsed);
                    disconnectTimerRef.current = setTimeout(async () => {
                        const won = await claimWinByDisconnect(sessionId, playerKey);
                        if (won) disconnectWinRef.current = true;
                        // meta listener sẽ tự trigger handleMatchEnd khi status = finished
                    }, remaining);
                } else if (!oppDisconnectedAt && disconnectTimerRef.current) {
                    // Đối thủ reconnect → hủy timer
                    clearTimeout(disconnectTimerRef.current);
                    disconnectTimerRef.current = null;
                }
            }

            // Trận kết thúc — chỉ xử lý khi đã có playerKey (qua ref, tránh stale closure)
            if (data.status === 'finished' && !resultHandledRef.current && playerKeyRef.current) {
                resultHandledRef.current = true;
                handleMatchEndRef.current?.(data);
            }
        });
        return () => unsubscribe();
    }, [sessionId, playerKey, playerId]);

    // ===== Listen câu hỏi của mình =====
    useEffect(() => {
        if (!sessionId || !playerKey) return;
        const unsubscribe = listenToPlayerQuestion(sessionId, playerKey, (data) => {
            setQuestion(data);
            setSelectedAnswer(null);
            setHiddenIndices([]); // reset 50/50 khi sang câu mới
            questionStartRef.current = Date.now();
        });
        return () => unsubscribe();
    }, [sessionId, playerKey]);

    // ===== Freeze progress bar (client-side) =====
    useEffect(() => {
        if (!frozenUntil) return;
        const freezeDuration = gameSnapshotRef.current?.freezeDuration ?? 3;
        const interval = setInterval(() => {
            const remaining = frozenUntil - Date.now();
            if (remaining <= 0) {
                setFreezeProgress(0);
                setFreezeRemainingSec(0);
                setFrozenUntil(0);
                setSelectedAnswer(null);
                clearInterval(interval);
            } else {
                setFreezeProgress((remaining / (freezeDuration * 1000)) * 100);
                setFreezeRemainingSec(Math.max(1, Math.ceil(remaining / 1000)));
            }
        }, 50);
        return () => clearInterval(interval);
    }, [frozenUntil]);

    // ===== Countdown 45s khi đối thủ disconnect (đặt trước mọi early return) =====
    const oppKeyForCountdown = playerKey === 'player1' ? 'player2' : 'player1';
    const oppDisconnectedAtForCountdown = playerKey ? meta?.[oppKeyForCountdown]?.disconnectedAt : null;
    useEffect(() => {
        // Banner chỉ render khi oppDisconnectedAt còn tồn tại nên không cần reset state ở nhánh này
        if (!oppDisconnectedAtForCountdown) return;
        const update = () => {
            const remaining = Math.ceil((DISCONNECT_GRACE_MS - (Date.now() - oppDisconnectedAtForCountdown)) / 1000);
            setDisconnectCountdown(Math.max(0, remaining));
        };
        const first = setTimeout(update, 0); // tick đầu async để không setState đồng bộ trong effect
        const id = setInterval(update, 500);
        return () => { clearTimeout(first); clearInterval(id); };
    }, [oppDisconnectedAtForCountdown]);

    // ===== Kết thúc trận — GIỮ NGUYÊN trình tự nguồn =====
    const handleMatchEnd = useCallback(async (finalMeta) => {
        if (!finalMeta) return;
        // Dùng ref để tránh stale closure khi playerKey chưa kịp set qua useState
        const resolvedKey = playerKeyRef.current || playerKey;
        if (!resolvedKey) return;

        // Hủy onDisconnect trigger vì trận đã kết thúc bình thường
        if (cancelDisconnectRef.current) { cancelDisconnectRef.current(); cancelDisconnectRef.current = null; }
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }

        const myPlayer = finalMeta[resolvedKey];
        const oppKey = resolvedKey === 'player1' ? 'player2' : 'player1';
        const oppPlayer = finalMeta[oppKey];
        const forceStopped = !!finalMeta.forceStopped;
        const won = !forceStopped && finalMeta.winner === resolvedKey;

        // Bước 1: lưu rounds NGAY — trước animation để winner có đủ thời gian chờ
        try {
            await savePlayerRounds(sessionId, resolvedKey, roundsLogRef.current);
        } catch (e) {
            console.error('[VersusMatch] savePlayerRounds error:', e);
        }

        // Hiệu ứng kết thúc ~3s + âm thanh (theo mẫu ForgeEffect), rồi mới show modal
        setEndEffect({ won, forceStopped });
        if (!forceStopped) {
            try {
                const audio = new Audio(won ? '/congratulations.wav' : '/lost.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { });
            } catch { /* ignore */ }
        }
        await new Promise((r) => setTimeout(r, 3000));
        setEndEffect(null);

        setMatchResult({
            won,
            forceStopped,
            myScore: myPlayer?.score || 0,
            opponentScore: oppPlayer?.score || 0,
            opponentName: oppPlayer?.name || 'Đối thủ',
        });

        // THƯỞNG XU: chỉ winner, kể cả thắng do surrender/disconnect, TRỪ forceStopped.
        // claimReward = transaction trên cờ rewardClaimed → chống cộng 2 lần khi reload.
        if (won && playerId) {
            try {
                const canReward = await claimReward(sessionId);
                if (canReward) {
                    const settings = await getVersusSettings();
                    const winCoins = settings.winCoins || 0;
                    if (winCoins > 0) {
                        await updateDoc(doc(db, 'users', playerId), { coins: increment(winCoins) });
                        // Refresh local profile (AuthContext.updateUserProfile chỉ update state, không ghi Firestore)
                        updateUserProfile({ coins: (userProfileRef.current?.coins || 0) + winCoins });
                        setRewardCoins(winCoins);
                    }
                }
            } catch (e) {
                console.error('[VersusMatch] Reward error:', e);
            }
        }

        // Bước 2: chờ rounds đối thủ có trên RTDB rồi mới claim+submit
        // (tránh race: winner claim trước khi loser kịp save)
        let oppRounds = [];
        try {
            oppRounds = await waitForPlayerRounds(sessionId, oppKey, 6000);
        } catch (e) {
            console.error('[VersusMatch] waitForPlayerRounds error:', e);
        }

        // Bước 3: chỉ 1 client submit Firestore (transaction trên cờ submittedToFirestore)
        const canSubmit = await claimFirestoreSubmission(sessionId);
        if (canSubmit) {
            try {
                const roundsP1 = resolvedKey === 'player1' ? roundsLogRef.current : oppRounds;
                const roundsP2 = resolvedKey === 'player2' ? roundsLogRef.current : oppRounds;
                let coinsAwarded = 0;
                if (!forceStopped) {
                    try {
                        const settings = await getVersusSettings();
                        coinsAwarded = settings.winCoins || 0;
                    } catch { /* ignore */ }
                }

                await addDoc(collection(db, 'versusMatchResults'), {
                    gameId,
                    sessionId,
                    winnerUid: finalMeta.winner ? (finalMeta[finalMeta.winner]?.id || null) : null,
                    winnerName: finalMeta.winner ? (finalMeta[finalMeta.winner]?.name || null) : null,
                    player1: {
                        uid: finalMeta.player1?.id || null,
                        name: finalMeta.player1?.name || '',
                        score: finalMeta.player1?.score || 0,
                    },
                    player2: {
                        uid: finalMeta.player2?.id || null,
                        name: finalMeta.player2?.name || '',
                        score: finalMeta.player2?.score || 0,
                    },
                    surrendered: !!finalMeta.surrendered,
                    disconnectWin: disconnectWinRef.current,
                    forceStopped,
                    coinsAwarded,
                    duration: Math.round((Date.now() - (finalMeta.startedAt || Date.now())) / 1000),
                    roundsP1,
                    roundsP2,
                    createdAt: serverTimestamp(),
                });

                await updateDoc(doc(db, 'versusGames', gameId), { matchesPlayed: increment(1) });
            } catch (e) {
                console.error('[VersusMatch] Firestore submit error:', e);
            }

            // Cleanup RTDB sau 5 phút
            scheduleSessionCleanup(sessionId);
        }
    }, [playerKey, sessionId, gameId, playerId, updateUserProfile]);

    useEffect(() => { handleMatchEndRef.current = handleMatchEnd; }, [handleMatchEnd]);

    // Bug fix từ nguồn: meta=finished đến TRƯỚC khi playerKey kịp set
    // → trigger handleMatchEnd ngay khi playerKey sẵn sàng
    useEffect(() => {
        if (playerKey && meta?.status === 'finished' && !resultHandledRef.current) {
            resultHandledRef.current = true;
            // Gọi async qua ref — không setState đồng bộ trong effect; guard bằng resultHandledRef nên không cần clear
            setTimeout(() => handleMatchEndRef.current?.(meta), 0);
        }
    }, [playerKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ===== Trả lời câu hỏi (abcd: answerIndex là vị trí hiển thị; typed: 1 đúng / 0 sai) =====
    const handleAnswer = async (answerIndex) => {
        if (!playerKey || !question || !meta || meta.status === 'finished') return;
        if (frozenUntil > Date.now()) return; // đang đóng băng

        const snapshot = gameSnapshotRef.current;
        const questions = snapshot?.questions || [];
        if (questions.length === 0) return;

        const currentScore = meta[playerKey]?.score || 0;
        const currentQIndex = question.questionIndex || 0;
        const winSteps = meta.winSteps || 5;
        const questionOrder = meta.questionOrder || null;

        const q = questions[currentQIndex % questions.length];
        const qType = q?.type || 'abcd';
        const isAbcd = qType === 'abcd' || !q?.type;
        // question.answers từ RTDB có thể đã shuffle, mỗi item có originalIndex
        const chosenAnswer = isAbcd ? (question.answers || [])[answerIndex] : null;
        const correct = isAbcd ? chosenAnswer?.isCorrect === true : answerIndex === 1;

        // Vật phẩm đã dùng ở câu này (ghi vào rounds log)
        const armed = doubleArmedRef.current;
        const usedItems = [];
        if (armed) usedItems.push('double_step');
        if (isAbcd && hiddenIndicesRef.current.length > 0) usedItems.push('fifty_fifty');

        // Rounds log: { questionIndex, correct, timeMs, itemUsed? }
        if (q) {
            roundsLogRef.current.push({
                questionIndex: currentQIndex,
                correct,
                timeMs: Date.now() - questionStartRef.current,
                ...(usedItems.length ? { itemUsed: usedItems.join(',') } : {}),
            });
        }

        try {
            const shuffle = snapshot?.shuffleAnswers === true;
            // Khi shuffle: gửi originalIndex để service chấm trên câu hỏi gốc
            const serverIndex = (isAbcd && shuffle && chosenAnswer?.originalIndex !== undefined)
                ? chosenAnswer.originalIndex
                : answerIndex;
            const freezeDuration = snapshot?.freezeDuration ?? 3;
            const steps = armed ? 2 : 1; // Nhân đôi bước

            const result = await submitAnswer(
                sessionId, playerKey, serverIndex,
                questions, currentQIndex, winSteps, currentScore,
                shuffle, questionOrder, freezeDuration, steps
            );

            // Arm tiêu hao dù đúng hay sai (vật phẩm đã dùng)
            if (armed) setDoubleArmed(false);

            // Reset state các loại câu cho câu tiếp theo
            setTfAnswers({});
            setShortText('');

            if (result === 'wrong') {
                setFrozenUntil(Date.now() + freezeDuration * 1000);
            }
        } catch (e) {
            console.error('[VersusMatch] Submit answer error:', e);
        }
    };

    // Chấm client cho true_false / short_answer rồi gửi 1 (đúng) / 0 (sai) — như nguồn
    const handleTypedSubmit = () => {
        if (!question) return;
        const qType = question.type || 'abcd';
        let isCorrect = false;
        if (qType === 'true_false') {
            const sts = question.statements || [];
            isCorrect = sts.length > 0 && sts.every((st, i) => tfAnswers[i] === st.isTrue);
        } else if (qType === 'short_answer') {
            const ans = shortText.trim().toLowerCase();
            const correctAns = (question.shortAnswer || '').trim().toLowerCase();
            const alts = (question.alternativeAnswers || []).map((a) => String(a).trim().toLowerCase());
            isCorrect = ans === correctAns || alts.includes(ans);
        }
        handleAnswer(isCorrect ? 1 : 0);
    };

    const canSubmitTyped = () => {
        if (!question) return false;
        const qType = question.type || 'abcd';
        if (qType === 'true_false') return Object.keys(tfAnswers).length === (question.statements?.length || 0);
        if (qType === 'short_answer') return shortText.trim().length > 0;
        return false;
    };

    // ===== Đầu hàng =====
    const handleSurrender = () => {
        showConfirm({
            title: 'Đầu hàng?',
            message: 'Bạn sẽ thua trận này và đối thủ sẽ thắng ngay lập tức.',
            confirmText: 'Đầu hàng',
            cancelText: 'Tiếp tục đấu',
            type: 'danger',
            onConfirm: async () => {
                if (!sessionId || !playerKey) return;
                try {
                    await surrender(sessionId, playerKey);
                    // handleMatchEnd sẽ được trigger bởi meta listener khi status = finished
                } catch (e) {
                    console.error('[VersusMatch] Surrender error:', e);
                }
            },
        });
    };

    // ===== Vật phẩm =====
    const handleUseDouble = () => {
        if (usedDouble || doubleArmed || items.double_step.length === 0) return;
        if (frozenUntil > Date.now()) return;
        showConfirm({
            title: 'Dùng Nhân đôi bước?',
            message: 'Câu hiện tại nếu trả lời đúng sẽ tiến 2 bước. Trả lời sai vẫn mất vật phẩm. Mỗi trận chỉ dùng được 1 lần.',
            confirmText: 'Dùng ngay',
            cancelText: 'Để sau',
            type: 'info',
            onConfirm: async () => {
                const invId = items.double_step[0];
                try {
                    await consumeVersusItem(invId);
                    setItems((prev) => ({ ...prev, double_step: prev.double_step.slice(1) }));
                    setUsedDouble(true);
                    setDoubleArmed(true);
                } catch (e) {
                    console.error('[VersusMatch] Use double_step error:', e);
                }
            },
        });
    };

    const handleUseFifty = async () => {
        if (usedFifty || items.fifty_fifty.length === 0) return;
        if (frozenUntil > Date.now()) return;
        const qType = question?.type || 'abcd';
        if (qType !== 'abcd') return;
        const answers = question?.answers || [];
        const wrongIndices = answers
            .map((a, i) => ({ i, isCorrect: a.isCorrect === true }))
            .filter((a) => !a.isCorrect)
            .map((a) => a.i);
        if (wrongIndices.length < 2) return;

        const invId = items.fifty_fifty[0];
        try {
            await consumeVersusItem(invId);
            setItems((prev) => ({ ...prev, fifty_fifty: prev.fifty_fifty.slice(1) }));
            setUsedFifty(true);
            // Chọn ngẫu nhiên 2 đáp án sai để ẩn
            const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
            setHiddenIndices(shuffled.slice(0, 2));
        } catch (e) {
            console.error('[VersusMatch] Use fifty_fifty error:', e);
        }
    };

    // ===== Về phòng chờ =====
    const handleExit = async () => {
        setExiting(true);
        try {
            if (gameId && playerId) await updatePlayerStatus(gameId, playerId, 'done');
        } catch (e) {
            console.error('[VersusMatch] Update player status error:', e);
        }
        onExit?.();
    };

    // ==================== RENDER ====================

    if (loading) {
        return (
            <div className="clay-card p-10 flex items-center justify-center gap-3 text-[#556958] dark:text-[#a5b5a8]">
                <Icon name="progress_activity" size={28} className="animate-spin text-primary" />
                <span className="font-medium">Đang kết nối trận đấu...</span>
            </div>
        );
    }

    // Session không tồn tại (đã bị cleanup) — cho lối thoát, không kẹt loading mãi
    if (!meta) {
        return (
            <div className="clay-card max-w-md mx-auto p-8 text-center animate-scale-in">
                <div className="text-5xl mb-3">⚠️</div>
                <h3 className="text-xl font-extrabold text-[#111812] dark:text-white mb-2">Trận đã kết thúc</h3>
                <p className="text-[#556958] dark:text-[#a5b5a8] mb-6">
                    Không tìm thấy trận đấu này. Có thể trận đã kết thúc hoặc hết hạn.
                </p>
                <Button variant="primary" icon="arrow_back" onClick={handleExit} loading={exiting} className="w-full">
                    Về phòng chờ
                </Button>
            </div>
        );
    }

    // uid không thuộc trận này (đích không có chế độ khán giả trong file này)
    if (notParticipant) {
        return (
            <div className="clay-card max-w-md mx-auto p-8 text-center animate-scale-in">
                <div className="text-5xl mb-3">🚫</div>
                <h3 className="text-xl font-extrabold text-[#111812] dark:text-white mb-2">Bạn không thuộc trận này</h3>
                <p className="text-[#556958] dark:text-[#a5b5a8] mb-6">
                    Trận đấu này thuộc về hai đấu thủ khác. Hãy quay lại phòng chờ nhé!
                </p>
                <Button variant="primary" icon="arrow_back" onClick={handleExit} loading={exiting} className="w-full">
                    Về phòng chờ
                </Button>
            </div>
        );
    }

    const { player1, player2 } = meta;
    const winSteps = meta.winSteps || 5;
    const p1Score = player1?.score || 0;
    const p2Score = player2?.score || 0;
    const myPlayer = playerKey ? meta[playerKey] : null;
    const oppKey = playerKey === 'player1' ? 'player2' : 'player1';
    const oppPlayer = playerKey ? meta[oppKey] : null;

    // frozenUntil được interval trong effect freeze đưa về 0 khi hết hạn → render thuần
    const isFrozen = frozenUntil > 0;
    const oppDisconnectedAt = playerKey ? meta[oppKey]?.disconnectedAt : null;
    const isFrozenByDisconnect = !!oppDisconnectedAt && meta.status === 'playing';
    const locked = isFrozen || isFrozenByDisconnect;

    // Ảnh đẩy gậy dịch theo hiệu số điểm (giới hạn ±40%)
    const pushOffsetPercent = Math.max(-40, Math.min(40, ((p1Score - p2Score) / winSteps) * 40));

    // ===== Overlay hiệu ứng kết thúc (3s trước modal) =====
    if (endEffect) {
        const emoji = endEffect.forceStopped ? '⚖️' : endEffect.won ? '🏆' : '😢';
        const title = endEffect.forceStopped ? 'Trận bị dừng' : endEffect.won ? 'Chiến thắng!' : 'Thất bại...';
        return (
            <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
                <div className="animate-scale-in text-center">
                    <div className="text-[7rem] leading-none mb-4 animate-glow-pulse">
                        {endEffect.won && !endEffect.forceStopped ? '🎉' : ''}{emoji}
                    </div>
                    <h2 className={`text-4xl font-extrabold ${endEffect.won ? 'text-amber-300' : 'text-gray-300'}`}>
                        {title}
                    </h2>
                </div>
            </div>
        );
    }

    // ===== Modal kết quả =====
    if (matchResult) {
        return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="clay-card max-w-md w-full p-6 sm:p-8 text-center animate-scale-in">
                    <div className="text-6xl mb-2">
                        {matchResult.forceStopped ? '⚖️' : matchResult.won ? '🏆' : '😢'}
                    </div>
                    <h2 className={`text-2xl font-extrabold mb-1 ${matchResult.forceStopped
                        ? 'text-amber-600 dark:text-amber-400'
                        : matchResult.won
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {matchResult.forceStopped ? 'Trận bị dừng' : matchResult.won ? 'Bạn thắng!' : 'Bạn thua!'}
                    </h2>
                    {matchResult.forceStopped && (
                        <p className="text-sm text-[#556958] dark:text-[#a5b5a8] mb-2">
                            Thầy cô đã dừng trận đấu này. Kết quả tính hòa.
                        </p>
                    )}

                    {/* Tỉ số */}
                    <div className="rounded-2xl bg-[#f0f5f1] dark:bg-white/5 p-4 my-4">
                        <p className="text-xs font-bold text-[#556958] dark:text-[#a5b5a8] uppercase mb-3">Kết quả trận đấu</p>
                        <div className="flex items-center justify-around gap-2">
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-[#111812] dark:text-white truncate">{myPlayer?.name || 'Bạn'}</p>
                                <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">{matchResult.myScore}</p>
                                <p className="text-xs text-[#556958] dark:text-[#a5b5a8]">bước</p>
                            </div>
                            <span className="text-lg font-extrabold text-[#556958] dark:text-[#a5b5a8]">VS</span>
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-[#111812] dark:text-white truncate">{matchResult.opponentName}</p>
                                <p className="text-3xl font-extrabold text-red-500">{matchResult.opponentScore}</p>
                                <p className="text-xs text-[#556958] dark:text-[#a5b5a8]">bước</p>
                            </div>
                        </div>
                    </div>

                    {/* Xu thưởng */}
                    {rewardCoins > 0 && (
                        <div className="flex items-center justify-center gap-2 mb-4 py-2.5 px-4 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold animate-slide-up">
                            <Icon name="paid" size={22} filled />
                            +{rewardCoins} xu
                        </div>
                    )}

                    <Button variant="primary" icon="arrow_back" onClick={handleExit} loading={exiting} className="w-full">
                        Về phòng chờ
                    </Button>
                </div>
            </div>
        );
    }

    const qType = question?.type || 'abcd';

    // ===== Màn hình đấu chính =====
    return (
        <section className="max-w-2xl mx-auto space-y-4 animate-scale-in">
            {/* Thanh đua 2 người */}
            <div className="clay-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Đấu thủ 1 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar name={player1?.name} size="xs" lazy={false} />
                                <span className="font-bold text-sm text-[#111812] dark:text-white truncate">
                                    {player1?.name || 'Người chơi 1'}
                                    {playerKey === 'player1' && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(bạn)</span>}
                                </span>
                            </div>
                            <span className="text-sm font-extrabold text-red-500 shrink-0">{p1Score}/{winSteps}</span>
                        </div>
                        <RaceBar score={p1Score} winSteps={winSteps} colorClass="bg-red-400" />
                    </div>

                    {/* Ảnh đẩy gậy ở giữa — dịch theo hiệu số điểm */}
                    <div className="shrink-0 self-center overflow-hidden w-40 sm:w-44">
                        <img
                            src="/versus-push.png"
                            alt="Hai đấu thủ đẩy gậy"
                            className="h-16 sm:h-20 mx-auto object-contain transition-transform duration-500 ease-out"
                            style={{ transform: `translateX(${pushOffsetPercent}%)` }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>

                    {/* Đấu thủ 2 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar name={player2?.name} size="xs" lazy={false} />
                                <span className="font-bold text-sm text-[#111812] dark:text-white truncate">
                                    {player2?.name || 'Người chơi 2'}
                                    {playerKey === 'player2' && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(bạn)</span>}
                                </span>
                            </div>
                            <span className="text-sm font-extrabold text-blue-500 shrink-0">{p2Score}/{winSteps}</span>
                        </div>
                        <RaceBar score={p2Score} winSteps={winSteps} colorClass="bg-blue-400" />
                    </div>
                </div>

                {/* Đầu hàng */}
                <div className="flex justify-end mt-2">
                    <button
                        onClick={handleSurrender}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                        <Icon name="flag" size={14} />
                        Đầu hàng
                    </button>
                </div>
            </div>

            {/* Banner đối thủ mất kết nối */}
            {isFrozenByDisconnect && (
                <div className="clay-card p-4 text-center border-2 border-amber-300 dark:border-amber-500/40 animate-slide-up">
                    <p className="font-bold text-amber-600 dark:text-amber-400">
                        ⏳ Đối thủ mất kết nối — đang chờ quay lại ({disconnectCountdown ?? '...'}s)
                    </p>
                    <p className="text-xs text-[#556958] dark:text-[#a5b5a8] mt-1">
                        Trận tạm dừng, bạn chưa thể ghi điểm lúc này. Hết giờ chờ bạn sẽ thắng.
                    </p>
                </div>
            )}

            {/* Thanh vật phẩm */}
            <div className="flex gap-3">
                {/* Nhân đôi bước */}
                <button
                    onClick={handleUseDouble}
                    disabled={usedDouble || doubleArmed || items.double_step.length === 0 || locked}
                    className={`flex-1 clay-card !p-3 flex items-center justify-center gap-2 text-sm font-bold transition-all
                        ${doubleArmed
                            ? 'text-amber-600 dark:text-amber-400 animate-glow-pulse'
                            : usedDouble || items.double_step.length === 0
                                ? 'opacity-40 cursor-not-allowed text-[#556958] dark:text-[#a5b5a8]'
                                : 'text-[#111812] dark:text-white hover:scale-[1.02] active:scale-95'
                        }`}
                >
                    <Icon name={VERSUS_ITEM_EFFECTS.double_step.icon} size={20} className="text-amber-500" filled />
                    <span>{doubleArmed ? 'Đang kích hoạt!' : VERSUS_ITEM_EFFECTS.double_step.label}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        x{items.double_step.length}
                    </span>
                </button>

                {/* 50/50 */}
                <button
                    onClick={handleUseFifty}
                    disabled={usedFifty || items.fifty_fifty.length === 0 || qType !== 'abcd' || locked || !question}
                    className={`flex-1 clay-card !p-3 flex items-center justify-center gap-2 text-sm font-bold transition-all
                        ${usedFifty || items.fifty_fifty.length === 0 || qType !== 'abcd'
                            ? 'opacity-40 cursor-not-allowed text-[#556958] dark:text-[#a5b5a8]'
                            : 'text-[#111812] dark:text-white hover:scale-[1.02] active:scale-95'
                        }`}
                >
                    <Icon name={VERSUS_ITEM_EFFECTS.fifty_fifty.icon} size={20} className="text-blue-500" filled />
                    <span>{VERSUS_ITEM_EFFECTS.fifty_fifty.label}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        x{items.fifty_fifty.length}
                    </span>
                </button>
            </div>

            {/* Khu vực câu hỏi */}
            <div className="clay-card p-4 sm:p-6 relative">
                {/* Overlay đóng băng */}
                {isFrozen && (
                    <div className="absolute inset-0 z-10 rounded-[inherit] bg-sky-100/90 dark:bg-sky-950/90 flex flex-col items-center justify-center p-6 animate-scale-in">
                        <div className="text-5xl mb-2">❄️</div>
                        <p className="font-extrabold text-sky-700 dark:text-sky-300 mb-3">
                            Đóng băng {Math.max(1, freezeRemainingSec)}s...
                        </p>
                        <div className="w-full max-w-xs h-2.5 rounded-full bg-sky-200 dark:bg-sky-500/20 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-sky-500 transition-all duration-100"
                                style={{ width: `${freezeProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {question ? (
                    <>
                        {/* Câu hỏi */}
                        {question.questionImage && (
                            <div className="text-center mb-3">
                                <img
                                    src={question.questionImage}
                                    alt=""
                                    className="inline-block max-w-full max-h-48 rounded-xl"
                                />
                            </div>
                        )}
                        <p className="text-lg sm:text-xl font-bold text-center text-[#111812] dark:text-white mb-5">
                            {question.questionText}
                        </p>

                        {/* ABCD */}
                        {qType === 'abcd' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(question.answers || []).map((answer, idx) => {
                                    const hidden = hiddenIndices.includes(idx);
                                    const isSelected = selectedAnswer === idx;
                                    return (
                                        <button
                                            key={idx}
                                            disabled={locked || hidden || selectedAnswer !== null}
                                            onClick={() => { setSelectedAnswer(idx); handleAnswer(idx); }}
                                            className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-left font-medium transition-all
                                                ${hidden
                                                    ? 'opacity-25 line-through bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8] cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-primary/20 border-2 border-primary text-[#111812] dark:text-white'
                                                        : 'bg-[#f0f5f1] dark:bg-white/5 text-[#111812] dark:text-white hover:bg-primary/10 hover:scale-[1.01] active:scale-95 disabled:opacity-60'
                                                } ${doubleArmed && !hidden ? 'animate-glow-pulse' : ''}`}
                                        >
                                            <span className="shrink-0 size-7 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-sm font-extrabold text-primary-dark dark:text-primary">
                                                {ANSWER_LABELS[idx]}
                                            </span>
                                            <span className="min-w-0 pt-0.5">{answer.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* TRUE / FALSE */}
                        {qType === 'true_false' && (
                            <div className="space-y-2.5">
                                {(question.statements || []).map((st, si) => (
                                    <div
                                        key={si}
                                        className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${tfAnswers[si] !== undefined
                                            ? 'bg-primary/10'
                                            : 'bg-[#f0f5f1] dark:bg-white/5'
                                            }`}
                                    >
                                        <p className="flex-1 min-w-0 font-medium text-[#111812] dark:text-white">{st.text}</p>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                disabled={locked}
                                                onClick={() => setTfAnswers((p) => ({ ...p, [si]: true }))}
                                                className={`px-3 py-1.5 rounded-xl text-sm font-extrabold transition-all ${tfAnswers[si] === true
                                                    ? 'bg-green-500 text-white shadow-md'
                                                    : 'bg-white dark:bg-white/10 text-[#556958] dark:text-[#a5b5a8] hover:bg-green-100 dark:hover:bg-green-500/20'
                                                    }`}
                                            >
                                                Đúng
                                            </button>
                                            <button
                                                disabled={locked}
                                                onClick={() => setTfAnswers((p) => ({ ...p, [si]: false }))}
                                                className={`px-3 py-1.5 rounded-xl text-sm font-extrabold transition-all ${tfAnswers[si] === false
                                                    ? 'bg-red-500 text-white shadow-md'
                                                    : 'bg-white dark:bg-white/10 text-[#556958] dark:text-[#a5b5a8] hover:bg-red-100 dark:hover:bg-red-500/20'
                                                    }`}
                                            >
                                                Sai
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    variant="primary"
                                    icon="send"
                                    disabled={!canSubmitTyped() || locked}
                                    onClick={handleTypedSubmit}
                                    className={`w-full mt-1 ${doubleArmed ? 'animate-glow-pulse' : ''}`}
                                >
                                    Trả lời
                                </Button>
                            </div>
                        )}

                        {/* SHORT ANSWER */}
                        {qType === 'short_answer' && (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={shortText}
                                    onChange={(e) => setShortText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && canSubmitTyped() && !locked) handleTypedSubmit();
                                    }}
                                    placeholder="Nhập đáp án..."
                                    autoFocus
                                    disabled={locked}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 text-[#111812] dark:text-white font-medium placeholder:text-[#556958]/60 dark:placeholder:text-[#a5b5a8]/60 outline-none focus:ring-2 focus:ring-primary transition-shadow"
                                />
                                <Button
                                    variant="primary"
                                    icon="send"
                                    disabled={!canSubmitTyped() || locked}
                                    onClick={handleTypedSubmit}
                                    className={`w-full ${doubleArmed ? 'animate-glow-pulse' : ''}`}
                                >
                                    Trả lời
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-10 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                        <Icon name="progress_activity" size={22} className="animate-spin" />
                        <span className="font-medium">Đang tải câu hỏi...</span>
                    </div>
                )}
            </div>

            {/* Thông tin đối thủ nhỏ gọn */}
            {oppPlayer && (
                <p className="text-center text-xs text-[#556958] dark:text-[#a5b5a8]">
                    Đang đấu với <span className="font-bold">{oppPlayer.name}</span> — về đích trước ({winSteps} bước) để thắng!
                </p>
            )}

            <ConfirmDialog />
        </section>
    );
}
