import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { MathText } from '../math';
import ArenaItemBar from './ArenaItemBar';
import ArenaLiveBoard from './ArenaLiveBoard';
import { useArenaPhase } from '../../hooks/useArenaPhase';
import {
    getArenaQuestions,
    listenToArenaEffects,
    listenToArenaAnswers,
    submitArenaAnswer,
    freezeOpponent,
    burnIce,
    setDoubleBet,
    trackArenaPresence,
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
 */
export default function ArenaMatch({ sessionId, settings, room, onFinished, onToast }) {
    const uid = room?.myUid;
    const [questions, setQuestions] = useState([]);
    const questionsRef = useRef([]);
    const [effects, setEffects] = useState({});
    const [answers, setAnswers] = useState({});
    const [ownedItems, setOwnedItems] = useState({});
    const [itemBusy, setItemBusy] = useState(null);

    // Lựa chọn đang soạn cho câu hiện tại
    const [choice, setChoice] = useState(null);
    const [tfAnswers, setTfAnswers] = useState({});
    const [shortText, setShortText] = useState('');

    const [now, setNow] = useState(Date.now());

    // Giữ bản mới nhất của bài đang soạn để hàm tự-nộp (chạy trong interval)
    // luôn đọc được giá trị hiện tại, không bị kẹt ở closure cũ.
    const draftRef = useRef({ choice: null, tf: {}, text: '' });
    draftRef.current = { choice, tf: tfAnswers, text: shortText };

    const submittedRef = useRef({});

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
        return listenToArenaAnswers(sessionId, setAnswers);
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
    useEffect(() => {
        setChoice(null);
        setTfAnswers({});
        setShortText('');
    }, [questionIndex]);

    // ===== Báo cho cha khi trận kết thúc =====
    useEffect(() => {
        if (isGrading || isFinished) onFinished?.();
    }, [isGrading, isFinished]); // eslint-disable-line react-hooks/exhaustive-deps

    const question = questions[questionIndex] || null;
    const qType = question?.type || 'abcd';
    const alreadyAnswered = answers?.[uid]?.[questionIndex] !== undefined;
    const isFrozen = (effects.frozenUntil || 0) > now;
    const freezeRemainSec = Math.max(0, Math.ceil(((effects.frozenUntil || 0) - now) / 1000));
    const hiddenIndices = effects.fifty?.[questionIndex] || [];
    const tfHint = effects.hintTf?.[questionIndex] || null;

    // Thời điểm câu hiện tại bắt đầu — suy từ deadline trừ đi thời lượng câu
    const questionStart =
        meta?.questionEndsAt && question ? meta.questionEndsAt - question.seconds * 1000 : 0;

    // ===== Nộp bài =====
    const doSubmit = async (qIndex, q) => {
        const draft = draftRef.current;
        const payload = {};
        if (q.type === 'abcd') payload.choice = draft.choice;
        else if (q.type === 'true_false') payload.tf = draft.tf;
        else payload.text = draft.text.trim();

        const elapsed = questionStart ? serverNow() - questionStart : 0;
        await submitArenaAnswer(sessionId, uid, qIndex, payload, elapsed);
    };
    doSubmitRef.current = doSubmit;

    const handleSubmit = async () => {
        if (!question || alreadyAnswered || submittedRef.current[questionIndex]) return;
        submittedRef.current[questionIndex] = true;
        try {
            await doSubmit(questionIndex, question);
            onToast?.({ type: 'success', message: 'Đã ghi nhận câu trả lời!' });
        } catch {
            submittedRef.current[questionIndex] = false;
            onToast?.({ type: 'error', message: 'Không gửi được câu trả lời' });
        }
    };

    const canSubmit = () => {
        if (!question || alreadyAnswered || isFrozen) return false;
        if (qType === 'abcd') return choice !== null;
        if (qType === 'true_false') return Object.keys(tfAnswers).length === (question.statements || []).length;
        return shortText.trim().length > 0;
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

    const handleDouble = async () => {
        setItemBusy('double');
        try {
            const next = questionIndex + 1;
            const res = await setDoubleBet(sessionId, uid, next);
            if (res.ok) onToast?.({ type: 'success', message: `Đã cược x2 cho câu ${next + 1}! ⚡` });
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
                    Bảng xếp hạng sẽ hiện ra ngay khi chấm xong.
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

    const timePercent = question ? (remainingMs / (question.seconds * 1000)) * 100 : 0;
    const isUrgent = remainingSec <= 10 && phase === 'question';

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
                    <span
                        className={`flex items-center gap-1 text-lg font-black tabular-nums ${
                            isUrgent ? 'text-red-500 animate-pulse' : 'text-[#111812] dark:text-white'
                        }`}
                    >
                        <Icon name="timer" size={18} />
                        {phase === 'interstitial' ? `Câu sau: ${remainingSec}s` : `${remainingSec}s`}
                    </span>
                </div>
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
                                <img
                                    src={question.questionImage}
                                    alt=""
                                    className="inline-block max-w-full max-h-48 rounded-xl"
                                />
                            </div>
                        )}
                        <MathText
                            as="div"
                            className="text-lg sm:text-xl font-bold text-center text-[#111812] dark:text-white mb-5"
                            content={question.questionText}
                        />

                        {/* Đã nộp — chờ cả phòng */}
                        {alreadyAnswered && (
                            <div className="mb-4 p-3 rounded-2xl bg-green-100 dark:bg-green-500/20 flex items-center gap-2">
                                <Icon name="check_circle" size={20} className="text-green-600 dark:text-green-400" />
                                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                    Đã ghi nhận. Kết quả công bố cuối trận.
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
                                            disabled={hidden || alreadyAnswered || isFrozen}
                                            onClick={() => setChoice(idx)}
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
                                            <MathText className="min-w-0 pt-0.5" content={answer.text} />
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
                                                content={st.text}
                                            />
                                            {hinted && (
                                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-extrabold">
                                                    💡 {tfHint.isTrue ? 'ĐÚNG' : 'SAI'}
                                                </span>
                                            )}
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    disabled={alreadyAnswered || isFrozen}
                                                    onClick={() => setTfAnswers((p) => ({ ...p, [si]: true }))}
                                                    className={`px-3 py-1.5 rounded-xl text-sm font-extrabold transition-all disabled:opacity-50 ${
                                                        tfAnswers[si] === true
                                                            ? 'bg-green-500 text-white shadow-md'
                                                            : 'bg-white dark:bg-white/10 text-[#556958] dark:text-[#a5b5a8] hover:bg-green-100 dark:hover:bg-green-500/20'
                                                    }`}
                                                >
                                                    Đúng
                                                </button>
                                                <button
                                                    disabled={alreadyAnswered || isFrozen}
                                                    onClick={() => setTfAnswers((p) => ({ ...p, [si]: false }))}
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
                                onChange={(e) => setShortText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canSubmit()) handleSubmit();
                                }}
                                placeholder="Nhập đáp án..."
                                autoFocus
                                disabled={alreadyAnswered || isFrozen}
                                className="w-full px-4 py-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 text-[#111812] dark:text-white font-medium placeholder:text-[#556958]/60 dark:placeholder:text-[#a5b5a8]/60 outline-none focus:ring-2 focus:ring-primary transition-shadow disabled:opacity-60"
                            />
                        )}

                        {!alreadyAnswered && (
                            <Button
                                variant="primary"
                                icon="send"
                                disabled={!canSubmit()}
                                onClick={handleSubmit}
                                className="w-full mt-4"
                            >
                                Trả lời
                            </Button>
                        )}
                    </>
                ) : (
                    <div className="py-10 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                        <Icon name="progress_activity" size={22} className="animate-spin" />
                        Đang tải đề...
                    </div>
                )}
            </div>

            {/* Vật phẩm */}
            <ArenaItemBar
                owned={ownedItems}
                used={effects.used || {}}
                phase={phase}
                questionType={qType}
                nextQuestionType={questions[questionIndex + 1]?.type}
                isFrozen={isFrozen}
                doubleArmedFor={effects.doubleOn ?? null}
                currentQuestionIndex={questionIndex}
                answered={alreadyAnswered}
                players={room?.players || {}}
                myUid={uid}
                busy={itemBusy}
                onFreeze={handleFreeze}
                onDouble={handleDouble}
                onFifty={handleFifty}
                onHintTf={handleHintTf}
                onFire={handleFire}
            />

            {/* Bảng theo dõi */}
            <ArenaLiveBoard
                players={room?.players || {}}
                answers={answers}
                questionIndex={questionIndex}
                myUid={uid}
            />
        </div>
    );
}
