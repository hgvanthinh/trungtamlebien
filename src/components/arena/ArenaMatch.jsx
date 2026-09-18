import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { MathText } from '../math';
import ArenaItemBar from './ArenaItemBar';
import ArenaDisplaySettings from './ArenaDisplaySettings';
import ArenaLiveBoard from './ArenaLiveBoard';
import { useArenaPhase } from '../../hooks/useArenaPhase';
import { useArenaDisplayPrefs } from '../../hooks/useArenaDisplayPrefs';
import { useArenaAntiCheat } from '../../hooks/useArenaAntiCheat';
import {
    getArenaQuestions,
    listenToArenaEffects,
    listenToArenaAnswers,
    submitArenaAnswer,
    freezeOpponent,
    burnIce,
    setDoubleBet,
    trackArenaPresence,
    endQuestionEarly,
} from '../../services/arenaSessionService';
import { getArenaItems } from '../../services/arenaItemService';
import { requestArenaHint } from '../../services/arenaRewardService';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const STATEMENT_LABELS = ['a', 'b', 'c', 'd'];

/**
 * Màn thi đấu Đấu Trường.
 *
 * KHÔNG CHẤM ĐIỂM Ở ĐÂY. Client không có đáp án — chỉ ghi lựa chọn thô lên RTDB,
 * Cloud Function chấm và công bố cuối trận. Vì vậy sau khi nộp, HS chỉ thấy
 * "đã ghi nhận", không thấy đúng/sai.
 *
 * SỬA ĐÁP ÁN: nộp rồi vẫn đổi được tới khi hết giờ câu đó. Bản ghi sau đè lên
 * bản trước, và `elapsedMs` tính lại theo lần nộp cuối — đổi ý thì mất lợi thế
 * tốc độ khi so kè điểm bằng nhau.
 */
export default function ArenaMatch({ sessionId, settings, room, mode = 'live', onFinished, onToast }) {
    const uid = room?.myUid;
    // Luyện tập một mình: không đối thủ nên bỏ hết vật phẩm và bảng theo dõi.
    const isPractice = mode === 'practice';
    const [questions, setQuestions] = useState([]);
    const questionsRef = useRef([]);
    const [effects, setEffects] = useState({});
    const [answers, setAnswers] = useState({});
    const answersRef = useRef({});
    const [ownedItems, setOwnedItems] = useState({});
    const [itemBusy, setItemBusy] = useState(null);

    // Lựa chọn đang soạn cho câu hiện tại
    const [choice, setChoice] = useState(null);
    const [tfAnswers, setTfAnswers] = useState({});
    const [shortText, setShortText] = useState('');

    const [now, setNow] = useState(Date.now());

    // Cỡ chữ / cỡ ảnh do HS tự chỉnh, nhớ theo từng máy
    const { prefs, setFontScale, setImageMaxHeight, reset: resetPrefs } = useArenaDisplayPrefs();

    // Giám sát gian lận. Bật trong suốt lúc làm bài; số lần vi phạm được gửi kèm
    // mỗi câu trả lời để thầy cô xem lại được.
    const antiCheat = useArenaAntiCheat({ enabled: true });
    const antiCheatRef = useRef(antiCheat);
    antiCheatRef.current = antiCheat;

    // Giữ bản mới nhất của bài đang soạn để hàm tự-nộp (chạy trong interval)
    // luôn đọc được giá trị hiện tại, không bị kẹt ở closure cũ.
    const draftRef = useRef({ choice: null, tf: {}, text: '' });
    draftRef.current = { choice, tf: tfAnswers, text: shortText };

    // Bài đang soạn có khác bản đã nộp không — dùng để biết còn gì cần gửi.
    const isDraftDirtyRef = useRef(false);

    // Chỉ dùng để tránh tự-nộp trùng lúc hết giờ — KHÔNG dùng để khoá nút,
    // vì HS được phép nộp lại nhiều lần trong cùng một câu.
    const submittedRef = useRef({});
    const [submitting, setSubmitting] = useState(false);
    const [skipping, setSkipping] = useState(false);
    // Ảnh đang xem toàn màn hình (null = không mở)
    const [zoomImage, setZoomImage] = useState(null);

    // doSubmit duoc gan lai moi lan render (ben duoi) de luon doc duoc
    // questionStart / serverNow moi nhat. Dung ref vi handleAutoSubmit chay
    // trong interval cua hook, khong the phu thuoc closure cua mot render cu.
    const doSubmitRef = useRef(null);

    // ===== Nhip tran =====
    const handleAutoSubmit = useCallback(
        async (qIndex) => {
            if (submittedRef.current[qIndex]) return;
            const q = questionsRef.current[qIndex];
            if (!q) return;

            const draft = draftRef.current;
            // Khong tra loi gi thi bo qua: server tu tinh 0 diem va tron thoi gian cau
            // cho nhung cau khong co ban ghi, nen khong can ghi ban rong.
            const hasAnswer =
                (q.type === 'abcd' && draft.choice !== null) ||
                (q.type === 'true_false' && Object.keys(draft.tf).length > 0) ||
                (q.type === 'short_answer' && draft.text.trim());
            if (!hasAnswer) return;
            // Bản nháp trùng với bản đã nộp → không ghi lại, tránh đội elapsedMs
            // lên sát hết giờ cho người không hề đổi ý.
            if (!isDraftDirtyRef.current) return;

            submittedRef.current[qIndex] = true;
            try {
                await doSubmitRef.current?.(qIndex, q);
            } catch (error) {
                console.error('Error auto-submitting arena answer:', error);
                submittedRef.current[qIndex] = false;
            }
        },
        []
    );

    const {
        meta,
        phase,
        questionIndex,
        totalQuestions,
        remainingMs,
        remainingSec,
        isGrading,
        isFinished,
        serverNow,
    } = useArenaPhase(sessionId, settings, handleAutoSubmit);

    // ===== Tải đề (1 lần — đề không đổi trong trận) =====
    useEffect(() => {
        if (!sessionId) return;
        getArenaQuestions(sessionId)
            .then((list) => {
                questionsRef.current = list;
                setQuestions(list);
            })
            .catch((error) => {
                console.error('Error loading arena questions:', error);
                onToast?.({ type: 'error', message: 'Không tải được đề bài' });
            });
    }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ===== Vật phẩm HS sở hữu =====
    useEffect(() => {
        if (!uid) return;
        getArenaItems(uid).then(setOwnedItems);
    }, [uid]);

    // ===== Listeners =====
    useEffect(() => {
        if (!sessionId || !uid) return undefined;
        return listenToArenaEffects(sessionId, uid, setEffects);
    }, [sessionId, uid]);

    useEffect(() => {
        if (!sessionId) return undefined;
        return listenToArenaAnswers(sessionId, (data) => {
            answersRef.current = data;
            setAnswers(data);
        });
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !uid) return undefined;
        return trackArenaPresence(sessionId, uid);
    }, [sessionId, uid]);

    // ===== Đồng hồ cho lớp băng =====
    useEffect(() => {
        const t = setInterval(() => setNow(serverNow()), 200);
        return () => clearInterval(t);
    }, [serverNow]);

    // ===== Reset bài soạn khi sang câu mới =====
    // Nạp lại từ bản đã nộp (nếu có) thay vì xoá trắng: HS mở lại tab giữa câu
    // vẫn thấy đúng lựa chọn của mình và sửa tiếp được.
    useEffect(() => {
        const saved = answersRef.current?.[uid]?.[questionIndex];
        setChoice(saved?.choice ?? null);
        setTfAnswers(saved?.tf || {});
        setShortText(saved?.text || '');
        isDraftDirtyRef.current = false;
    }, [questionIndex, uid]);

    // ===== Báo cho cha khi trận kết thúc =====
    useEffect(() => {
        if (isGrading || isFinished) onFinished?.();
    }, [isGrading, isFinished]); // eslint-disable-line react-hooks/exhaustive-deps

    // ===== Cả phòng đã trả lời → qua câu luôn, khỏi ngồi chờ hết giờ =====
    //
    // Chỉ đếm người ĐANG KẾT NỐI: một người rớt mạng không được phép bắt cả
    // phòng ngồi chờ hết 5 phút. Mọi client cùng phát hiện và cùng gọi —
    // endQuestionEarly idempotent nên chỉ lần đầu có tác dụng.
    const allAnsweredRef = useRef(null);
    useEffect(() => {
        if (phase !== 'question' || !sessionId || isPractice) return;

        const activeUids = Object.entries(room?.players || {})
            .filter(([, p]) => p.online !== false)
            .map(([id]) => id);
        // Một mình trong phòng thì để đồng hồ chạy như thường: rút ngắn ở đây
        // biến trận thành bấm-là-xong, không còn là thi đấu nữa.
        if (activeUids.length < 2) return;

        const everyoneDone = activeUids.every((id) => answers?.[id]?.[questionIndex] !== undefined);
        if (!everyoneDone) return;

        const key = `${sessionId}:${questionIndex}`;
        if (allAnsweredRef.current === key) return;
        allAnsweredRef.current = key;

        endQuestionEarly(sessionId, questionIndex).catch((error) => {
            console.error('Error ending arena question early:', error);
            allAnsweredRef.current = null;
        });
    }, [answers, phase, questionIndex, sessionId, room?.players, isPractice]);

    const question = questions[questionIndex] || null;
    const qType = question?.type || 'abcd';
    const alreadyAnswered = answers?.[uid]?.[questionIndex] !== undefined;
    const isFrozen = (effects.frozenUntil || 0) > now;
    const freezeRemainSec = Math.max(0, Math.ceil(((effects.frozenUntil || 0) - now) / 1000));
    const hiddenIndices = effects.fifty?.[questionIndex] || [];
    const tfHint = effects.hintTf?.[questionIndex] || null;

    // Thời điểm câu hiện tại bắt đầu. Đọc mốc tường minh từ meta chứ KHÔNG suy
    // ngược từ deadline: khi cả phòng trả lời xong, deadline bị kéo về gần nên
    // phép trừ sẽ ra mốc bắt đầu sai và elapsedMs thành số âm.
    const questionStart =
        meta?.questionStartsAt ||
        (meta?.questionEndsAt && question ? meta.questionEndsAt - question.seconds * 1000 : 0);

    // ===== Nộp bài =====
    const doSubmit = async (qIndex, q) => {
        const draft = draftRef.current;
        const payload = {};
        if (q.type === 'abcd') payload.choice = draft.choice;
        else if (q.type === 'true_false') payload.tf = draft.tf;
        else payload.text = draft.text.trim();

        const elapsed = questionStart ? serverNow() - questionStart : 0;
        // Gửi kèm số lần rời màn hình / bấm PrintScreen tính tới lúc nộp câu này
        const ac = antiCheatRef.current;
        payload.flags = {
            tabSwitches: ac.blurCount,
            screenshots: ac.screenshotCount,
            awayMs: Math.round(ac.awayMs),
        };
        await submitArenaAnswer(sessionId, uid, qIndex, payload, elapsed);
    };
    doSubmitRef.current = doSubmit;

    const handleSubmit = async () => {
        if (!question || submitting) return;
        setSubmitting(true);
        submittedRef.current[questionIndex] = true;
        try {
            await doSubmit(questionIndex, question);
            isDraftDirtyRef.current = false;
            onToast?.({
                type: 'success',
                message: alreadyAnswered ? 'Đã cập nhật câu trả lời!' : 'Đã ghi nhận câu trả lời!',
            });
        } catch {
            submittedRef.current[questionIndex] = false;
            onToast?.({ type: 'error', message: 'Không gửi được câu trả lời' });
        } finally {
            setSubmitting(false);
        }
    };

    /** Bài soạn đã đủ để nộp chưa (chưa xét đã nộp hay chưa) */
    const isDraftComplete = () => {
        if (!question) return false;
        if (qType === 'abcd') return choice !== null;
        if (qType === 'true_false') {
            return Object.keys(tfAnswers).length === (question.statements || []).length;
        }
        return shortText.trim().length > 0;
    };

    const canSubmit = () => {
        if (isFrozen || submitting || phase !== 'question') return false;
        if (!isDraftComplete()) return false;
        // Đã nộp rồi thì chỉ cho gửi lại khi thực sự có thay đổi
        if (alreadyAnswered && !isDraftDirtyRef.current) return false;
        return true;
    };

    // Người dùng vừa đổi lựa chọn → đánh dấu có thay đổi cần gửi
    const markDirty = () => {
        isDraftDirtyRef.current = true;
    };

    /**
     * Luyện tập: bỏ qua phần thời gian còn lại của câu hiện tại.
     *
     * Dùng chung endQuestionEarly với chế độ thi đấu, nhưng không cần ân hạn:
     * chỉ có một mình nên bấm là ý đã chốt.
     */
    const handleNextQuestion = async () => {
        if (skipping) return;
        setSkipping(true);
        try {
            await endQuestionEarly(sessionId, questionIndex, 0);
        } catch {
            onToast?.({ type: 'error', message: 'Không chuyển câu được' });
        } finally {
            setSkipping(false);
        }
    };

    // ===== Vật phẩm =====
    const handleFreeze = async (targetUid, targetName) => {
        setItemBusy('freeze');
        try {
            const res = await freezeOpponent(sessionId, targetUid, uid);
            if (res.ok) {
                onToast?.({ type: 'success', message: `Đã đóng băng ${targetName}! ❄️` });
            } else {
                onToast?.({ type: 'info', message: `${targetName} đang bị đóng băng rồi — bạn vẫn giữ vật phẩm.` });
            }
        } catch {
            onToast?.({ type: 'error', message: 'Không dùng được vật phẩm' });
        } finally {
            setItemBusy(null);
        }
    };

    const handleFire = async () => {
        setItemBusy('fire');
        try {
            const res = await burnIce(sessionId, uid);
            if (res.ok) onToast?.({ type: 'success', message: 'Đã thiêu tan lớp băng! 🔥' });
            else onToast?.({ type: 'info', message: 'Bạn không bị đóng băng — vẫn giữ vật phẩm.' });
        } catch {
            onToast?.({ type: 'error', message: 'Không dùng được vật phẩm' });
        } finally {
            setItemBusy(null);
        }
    };

    /**
     * Cược x2. Đặt cho CÂU ĐANG LÀM nếu đang trong câu, cho câu kế tiếp nếu
     * đang ở khoảng chuyển câu.
     *
     * Trước đây chỉ cho đặt trong 5 giây chuyển câu — quá gấp, HS hoặc không kịp
     * bấm hoặc quên mất mình đã cược câu nào. Server vẫn kiểm tra lại loại câu
     * khi chấm nên cược vào câu đúng-sai vẫn không được nhân đôi.
     */
    const handleDouble = async () => {
        setItemBusy('double');
        try {
            const target = phase === 'interstitial' ? questionIndex + 1 : questionIndex;
            const res = await setDoubleBet(sessionId, uid, target);
            if (res.ok) onToast?.({ type: 'success', message: `Đã cược x2 cho câu ${target + 1}! ⚡` });
            else onToast?.({ type: 'info', message: 'Bạn đã dùng vật phẩm này rồi' });
        } catch {
            onToast?.({ type: 'error', message: 'Không đặt được cược' });
        } finally {
            setItemBusy(null);
        }
    };

    const handleFifty = async () => {
        setItemBusy('fifty');
        try {
            await requestArenaHint(sessionId, questionIndex, 'fifty');
            onToast?.({ type: 'success', message: 'Đã loại 2 đáp án sai!' });
        } catch (error) {
            onToast?.({ type: 'error', message: error.message || 'Không dùng được 50/50' });
        } finally {
            setItemBusy(null);
        }
    };

    const handleHintTf = async (statementIndex) => {
        setItemBusy('hint_tf');
        try {
            const res = await requestArenaHint(sessionId, questionIndex, 'hint_tf', statementIndex);
            onToast?.({
                type: 'success',
                message: `Ý ${STATEMENT_LABELS[statementIndex]}) là ${res.isTrue ? 'ĐÚNG' : 'SAI'}`,
            });
        } catch (error) {
            onToast?.({ type: 'error', message: error.message || 'Không dùng được gợi ý' });
        } finally {
            setItemBusy(null);
        }
    };

    // ===== Màn chờ chấm điểm =====
    if (isGrading || isFinished) {
        return (
            <div className="clay-card p-8 flex flex-col items-center gap-3">
                <Icon name="hourglass_top" size={44} className="text-primary animate-pulse" />
                <p className="text-lg font-extrabold text-[#111812] dark:text-white">
                    Hết giờ! Đang chấm điểm...
                </p>
                <p className="text-sm text-[#556958] dark:text-[#a5b5a8] text-center">
                    {isPractice
                        ? 'Xong là xem được đáp án đúng ngay.'
                        : 'Bảng xếp hạng sẽ hiện ra ngay khi chấm xong.'}
                </p>
            </div>
        );
    }

    // ===== Đếm ngược trước câu đầu =====
    const notStartedYet = meta?.startedAt && serverNow() < meta.startedAt;
    if (notStartedYet) {
        const sec = Math.ceil((meta.startedAt - serverNow()) / 1000);
        return (
            <div className="clay-card p-10 flex flex-col items-center gap-3">
                <div className="text-6xl font-black text-primary animate-scale-in" key={sec}>
                    {sec}
                </div>
                <p className="text-lg font-extrabold text-[#111812] dark:text-white">
                    Chuẩn bị vào trận!
                </p>
            </div>
        );
    }

    // Chia cho thời lượng THỰC TẾ của câu (có thể đã bị rút ngắn), để thanh
    // tiến độ không đứng yên một chỗ rồi biến mất đột ngột.
    const questionTotalMs =
        meta?.questionStartsAt && meta?.questionEndsAt
            ? meta.questionEndsAt - meta.questionStartsAt
            : (question?.seconds || 0) * 1000;
    const timePercent = questionTotalMs > 0 ? (remainingMs / questionTotalMs) * 100 : 0;
    const isUrgent = remainingSec <= 10 && phase === 'question';
    // Câu bị rút ngắn vì cả phòng đã xong — báo rõ để HS biết vì sao đồng hồ nhảy
    const endedEarly = !!meta?.endedEarly && phase === 'question';

    return (
        <div className="space-y-3">
            {/* Thanh tiến độ + đồng hồ */}
            <div className="clay-card p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold text-[#111812] dark:text-white">
                        Câu {questionIndex + 1}/{totalQuestions}
                        {question && (
                            <span className="ml-2 text-xs font-bold text-primary">
                                {question.points}đ
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-2">
                        <span
                            className={`flex items-center gap-1 text-lg font-black tabular-nums ${
                                isUrgent ? 'text-red-500 animate-pulse' : 'text-[#111812] dark:text-white'
                            }`}
                        >
                            <Icon name="timer" size={18} />
                            {phase === 'interstitial' ? `Câu sau: ${remainingSec}s` : `${remainingSec}s`}
                        </span>
                        <ArenaDisplaySettings
                            prefs={prefs}
                            onFontScale={setFontScale}
                            onImageMaxHeight={setImageMaxHeight}
                            onReset={resetPrefs}
                            hasImage={!!question?.questionImage}
                        />
                    </div>
                </div>
                {antiCheat.totalViolations > 0 && (
                    <p className="mb-2 text-xs font-bold text-red-600 dark:text-red-400 text-center">
                        ⚠️ Đã ghi nhận {antiCheat.blurCount > 0 && `${antiCheat.blurCount} lần rời màn hình`}
                        {antiCheat.blurCount > 0 && antiCheat.screenshotCount > 0 && ' · '}
                        {antiCheat.screenshotCount > 0 && `${antiCheat.screenshotCount} lần chụp màn hình`}
                    </p>
                )}
                {endedEarly && (
                    <p className="mb-2 text-xs font-bold text-amber-600 dark:text-amber-400 text-center">
                        ⚡ Cả phòng đã trả lời — qua câu sau {remainingSec}s. Muốn đổi đáp án thì làm ngay!
                    </p>
                )}
                <div className="h-2 rounded-full bg-[#f0f5f1] dark:bg-white/10 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-200 ${
                            isUrgent ? 'bg-red-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, timePercent))}%` }}
                    />
                </div>
            </div>

            {/* Khu vực câu hỏi */}
            <div className="clay-card p-4 sm:p-6 relative">
                {/* Lớp băng — che đề nhưng đồng hồ vẫn chạy */}
                {isFrozen && (
                    <div className="absolute inset-0 z-10 rounded-[inherit] bg-sky-100/95 dark:bg-sky-950/95 flex flex-col items-center justify-center p-6 animate-scale-in backdrop-blur-sm">
                        <div className="text-6xl mb-2">❄️</div>
                        <p className="font-extrabold text-sky-700 dark:text-sky-300 mb-1">
                            Đề bị đóng băng {freezeRemainSec}s
                        </p>
                        <p className="text-xs text-sky-600 dark:text-sky-400 text-center">
                            Đồng hồ vẫn chạy! Dùng 🔥 Lửa để thoát sớm.
                        </p>
                    </div>
                )}

                {/* Rời tab → che đề ngay. Không ngăn được việc chụp màn hình từ
                    trước đó, nhưng chặn được kiểu mở tab tra Google rồi quay lại
                    đọc tiếp, và mọi lần rời đi đều bị ghi lại. */}
                {antiCheat.isAway && (
                    <div className="absolute inset-0 z-20 rounded-[inherit] bg-red-50 dark:bg-red-950 flex flex-col items-center justify-center p-6 backdrop-blur-md">
                        <Icon name="visibility_off" size={44} className="text-red-500 mb-2" />
                        <p className="font-extrabold text-red-700 dark:text-red-300 text-center">
                            Đề đã bị ẩn vì bạn rời khỏi màn hình
                        </p>
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 text-center">
                            Quay lại tab này để làm tiếp. Đồng hồ vẫn chạy và thầy cô
                            thấy được số lần rời đi.
                        </p>
                    </div>
                )}

                {phase === 'interstitial' ? (
                    <div className="py-8 flex flex-col items-center gap-2">
                        <Icon name="hourglass_bottom" size={36} className="text-primary animate-pulse" />
                        <p className="font-extrabold text-[#111812] dark:text-white">
                            Chuẩn bị câu tiếp theo...
                        </p>
                        <p className="text-sm text-[#556958] dark:text-[#a5b5a8] text-center">
                            Đây là lúc đặt cược ⚡ Nhân đôi điểm.
                        </p>
                    </div>
                ) : question ? (
                    <>
                        {question.questionImage && (
                            <div className="text-center mb-3">
                                <button
                                    type="button"
                                    onClick={() => setZoomImage(question.questionImage)}
                                    title="Bấm để phóng to ảnh"
                                    className="relative inline-block max-w-full group"
                                >
                                    <img
                                        src={question.questionImage}
                                        alt=""
                                        className="inline-block max-w-full rounded-xl"
                                        style={{ maxHeight: `${prefs.imageMaxHeight}px` }}
                                    />
                                    <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                                        <Icon name="zoom_in" size={12} />
                                        Phóng to
                                    </span>
                                </button>
                            </div>
                        )}
                        <MathText
                            as="div"
                            className="text-lg sm:text-xl font-bold text-center text-[#111812] dark:text-white mb-5"
                            style={{ fontSize: `${1.125 * prefs.fontScale}rem` }}
                            content={question.questionText}
                        />

                        {/* Đã nộp — vẫn sửa được tới khi hết giờ */}
                        {alreadyAnswered && (
                            <div className="mb-4 p-3 rounded-2xl bg-green-100 dark:bg-green-500/20 flex items-start gap-2">
                                <Icon name="check_circle" size={20} className="shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                    Đã ghi nhận. Vẫn đổi được đáp án tới khi hết giờ câu này —
                                    chọn lại rồi bấm <b>Gửi lại</b>.
                                </span>
                            </div>
                        )}

                        {/* ABCD */}
                        {qType === 'abcd' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(question.answers || []).map((answer, idx) => {
                                    const hidden = hiddenIndices.includes(idx);
                                    const isSelected = choice === idx;
                                    return (
                                        <button
                                            key={idx}
                                            disabled={hidden || isFrozen}
                                            onClick={() => {
                                                markDirty();
                                                setChoice(idx);
                                            }}
                                            className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-left font-medium transition-all
                                                ${hidden
                                                    ? 'opacity-25 line-through bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8] cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-primary/20 border-2 border-primary text-[#111812] dark:text-white'
                                                        : 'bg-[#f0f5f1] dark:bg-white/5 text-[#111812] dark:text-white hover:bg-primary/10 hover:scale-[1.01] active:scale-95 disabled:opacity-60'
                                                }`}
                                        >
                                            <span className="shrink-0 size-7 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-sm font-extrabold text-primary-dark dark:text-primary">
                                                {ANSWER_LABELS[idx]}
                                            </span>
                                            <MathText
                                                className="min-w-0 pt-0.5"
                                                style={{ fontSize: `${prefs.fontScale}rem` }}
                                                content={answer.text}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ĐÚNG - SAI 4 ý */}
                        {qType === 'true_false' && (
                            <div className="space-y-2.5">
                                {(question.statements || []).map((st, si) => {
                                    const hinted = tfHint && tfHint.index === si;
                                    return (
                                        <div
                                            key={si}
                                            className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                                                hinted
                                                    ? 'bg-amber-100 dark:bg-amber-500/20 ring-1 ring-amber-400'
                                                    : tfAnswers[si] !== undefined
                                                        ? 'bg-primary/10'
                                                        : 'bg-[#f0f5f1] dark:bg-white/5'
                                            }`}
                                        >
                                            <span className="shrink-0 size-6 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-xs font-extrabold text-primary-dark dark:text-primary">
                                                {STATEMENT_LABELS[si]}
                                            </span>
                                            <MathText
                                                as="div"
                                                className="flex-1 min-w-0 font-medium text-[#111812] dark:text-white"
                                                style={{ fontSize: `${prefs.fontScale}rem` }}
                                                content={st.text}
                                            />
                                            {hinted && (
                                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-extrabold">
                                                    💡 {tfHint.isTrue ? 'ĐÚNG' : 'SAI'}
                                                </span>
                                            )}
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    disabled={isFrozen}
                                                    onClick={() => {
                                                        markDirty();
                                                        setTfAnswers((p) => ({ ...p, [si]: true }));
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-sm font-extrabold transition-all disabled:opacity-50 ${
                                                        tfAnswers[si] === true
                                                            ? 'bg-green-500 text-white shadow-md'
                                                            : 'bg-white dark:bg-white/10 text-[#556958] dark:text-[#a5b5a8] hover:bg-green-100 dark:hover:bg-green-500/20'
                                                    }`}
                                                >
                                                    Đúng
                                                </button>
                                                <button
                                                    disabled={isFrozen}
                                                    onClick={() => {
                                                        markDirty();
                                                        setTfAnswers((p) => ({ ...p, [si]: false }));
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-sm font-extrabold transition-all disabled:opacity-50 ${
                                                        tfAnswers[si] === false
                                                            ? 'bg-red-500 text-white shadow-md'
                                                            : 'bg-white dark:bg-white/10 text-[#556958] dark:text-[#a5b5a8] hover:bg-red-100 dark:hover:bg-red-500/20'
                                                    }`}
                                                >
                                                    Sai
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <p className="text-xs text-[#556958] dark:text-[#a5b5a8] text-center pt-1">
                                    Đúng 1 ý = 0,2đ · 2 ý = 0,5đ · 3 ý = 1đ · cả 4 ý = {question.points}đ
                                </p>
                            </div>
                        )}

                        {/* ĐIỀN ĐÁP ÁN */}
                        {qType === 'short_answer' && (
                            <input
                                type="text"
                                value={shortText}
                                onChange={(e) => {
                                    markDirty();
                                    setShortText(e.target.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canSubmit()) handleSubmit();
                                }}
                                placeholder="Nhập đáp án..."
                                autoFocus
                                disabled={isFrozen}
                                style={{ fontSize: `${prefs.fontScale}rem` }}
                                className="w-full px-4 py-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 text-[#111812] dark:text-white font-medium placeholder:text-[#556958]/60 dark:placeholder:text-[#a5b5a8]/60 outline-none focus:ring-2 focus:ring-primary transition-shadow disabled:opacity-60"
                            />
                        )}

                        <Button
                            variant="primary"
                            icon={alreadyAnswered ? 'sync' : 'send'}
                            loading={submitting}
                            disabled={!canSubmit()}
                            onClick={handleSubmit}
                            className="w-full mt-4"
                        >
                            {alreadyAnswered ? 'Gửi lại đáp án' : 'Trả lời'}
                        </Button>

                        {/* Luyện tập: xong câu nào đi tiếp câu đó, không phải
                            ngồi chờ hết giờ như khi thi đấu với người khác */}
                        {isPractice && alreadyAnswered && (
                            <button
                                onClick={handleNextQuestion}
                                disabled={skipping}
                                className="w-full mt-2 py-2.5 rounded-2xl font-extrabold text-primary-dark dark:text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                            >
                                {questionIndex >= totalQuestions - 1
                                    ? 'Nộp bài và xem đáp án →'
                                    : 'Câu tiếp theo →'}
                            </button>
                        )}
                    </>
                ) : (
                    <div className="py-10 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                        <Icon name="progress_activity" size={22} className="animate-spin" />
                        Đang tải đề...
                    </div>
                )}
            </div>

            {/* Vật phẩm — chỉ có ở chế độ thi đấu */}
            {!isPractice && (
            <ArenaItemBar
                owned={ownedItems}
                used={effects.used || {}}
                phase={phase}
                questionType={qType}
                nextQuestionType={questions[questionIndex + 1]?.type}
                isFrozen={isFrozen}
                doubleArmedFor={effects.doubleOn ?? null}
                currentQuestionIndex={questionIndex}
                isLastQuestion={questionIndex >= totalQuestions - 1}
                players={room?.players || {}}
                myUid={uid}
                busy={itemBusy}
                onFreeze={handleFreeze}
                onDouble={handleDouble}
                onFifty={handleFifty}
                onHintTf={handleHintTf}
                onFire={handleFire}
            />
            )}

            {/* Bảng theo dõi — chỉ có ý nghĩa khi có nhiều người */}
            {!isPractice && (
                <ArenaLiveBoard
                    players={room?.players || {}}
                    answers={answers}
                    questionIndex={questionIndex}
                    myUid={uid}
                />
            )}

            {/* Xem ảnh đề toàn màn hình — nhiều câu có đề nằm trong ảnh, thu nhỏ
                trong khung thì học sinh không đọc nổi chữ số trong hình. */}
            {zoomImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-3"
                    onClick={() => setZoomImage(null)}
                >
                    <img
                        src={zoomImage}
                        alt=""
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setZoomImage(null)}
                        aria-label="Đóng"
                        className="absolute top-3 right-3 size-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
                    >
                        <Icon name="close" size={22} />
                    </button>
                    <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">
                        Bấm nền để đóng · Chụm hai ngón để phóng to thêm
                    </p>
                </div>
            )}
        </div>
    );
}
