import { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { MathText } from '../math';
import { finalizeArenaPractice } from '../../services/arenaRewardService';

/**
 * Kết quả một lượt luyện tập + xem lại đáp án đúng.
 *
 * Khác bảng xếp hạng thi đấu: không có đối thủ, không xếp hạng. Điểm tích luỹ
 * bằng đúng điểm bài làm, và HS được xem mình sai câu nào, đáp án đúng là gì —
 * vì mục đích của chế độ này là học, không phải so kè.
 */

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const STATEMENT_LABELS = ['a', 'b', 'c', 'd'];

/** Một câu trong phần xem lại */
function ReviewItem({ item }) {
    const isPerfect = item.earned >= item.points;
    const isZero = !item.earned;

    return (
        <div
            className={`p-3.5 rounded-2xl ${
                isPerfect
                    ? 'bg-green-50 dark:bg-green-500/10'
                    : isZero
                        ? 'bg-red-50 dark:bg-red-500/10'
                        : 'bg-amber-50 dark:bg-amber-500/10'
            }`}
        >
            <div className="flex items-center gap-2 mb-2">
                <span className="shrink-0 size-6 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-xs font-extrabold text-[#556958] dark:text-[#a5b5a8]">
                    {item.index + 1}
                </span>
                <span
                    className={`text-sm font-extrabold ${
                        isPerfect
                            ? 'text-green-700 dark:text-green-300'
                            : isZero
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-amber-700 dark:text-amber-300'
                    }`}
                >
                    {item.earned}/{item.points}đ
                </span>
                <Icon
                    name={isPerfect ? 'check_circle' : isZero ? 'cancel' : 'contrast'}
                    size={18}
                    className={`ml-auto ${
                        isPerfect
                            ? 'text-green-600 dark:text-green-400'
                            : isZero
                                ? 'text-red-500'
                                : 'text-amber-500'
                    }`}
                />
            </div>

            {item.questionImage && (
                <img
                    src={item.questionImage}
                    alt=""
                    className="mb-2 max-w-full max-h-40 rounded-xl mx-auto"
                />
            )}
            <MathText
                as="div"
                className="font-bold text-[#111812] dark:text-white mb-2.5"
                content={item.questionText}
            />

            {/* ABCD */}
            {item.type === 'abcd' && (
                <div className="space-y-1.5">
                    {(item.answers || []).map((a, idx) => {
                        const picked = item.chosen === idx;
                        return (
                            <div
                                key={idx}
                                className={`flex items-start gap-2 p-2 rounded-xl text-sm ${
                                    a.isCorrect
                                        ? 'bg-green-100 dark:bg-green-500/20 ring-1 ring-green-400'
                                        : picked
                                            ? 'bg-red-100 dark:bg-red-500/20 ring-1 ring-red-400'
                                            : 'bg-white/60 dark:bg-white/5'
                                }`}
                            >
                                <span className="shrink-0 size-5 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-[11px] font-extrabold text-[#556958] dark:text-[#a5b5a8]">
                                    {ANSWER_LABELS[idx]}
                                </span>
                                <MathText className="flex-1 min-w-0 text-[#111812] dark:text-white" content={a.text} />
                                {a.isCorrect && (
                                    <span className="shrink-0 text-[11px] font-extrabold text-green-700 dark:text-green-300">
                                        Đáp án đúng
                                    </span>
                                )}
                                {picked && !a.isCorrect && (
                                    <span className="shrink-0 text-[11px] font-extrabold text-red-600 dark:text-red-400">
                                        Bạn chọn
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {item.chosen === null && (
                        <p className="text-xs italic text-[#556958] dark:text-[#a5b5a8] pt-0.5">
                            Bạn không trả lời câu này.
                        </p>
                    )}
                </div>
            )}

            {/* Đúng - Sai */}
            {item.type === 'true_false' && (
                <div className="space-y-1.5">
                    {(item.statements || []).map((st, si) => {
                        const right = st.chosen === st.isTrue;
                        return (
                            <div
                                key={si}
                                className={`flex items-center gap-2 p-2 rounded-xl text-sm ${
                                    right
                                        ? 'bg-green-100 dark:bg-green-500/20'
                                        : 'bg-red-100 dark:bg-red-500/20'
                                }`}
                            >
                                <span className="shrink-0 size-5 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-[11px] font-extrabold text-[#556958] dark:text-[#a5b5a8]">
                                    {STATEMENT_LABELS[si]}
                                </span>
                                <MathText className="flex-1 min-w-0 text-[#111812] dark:text-white" content={st.text} />
                                <span className="shrink-0 text-[11px] font-extrabold text-[#556958] dark:text-[#a5b5a8]">
                                    {st.chosen === null
                                        ? 'Bỏ trống'
                                        : st.chosen
                                            ? 'Chọn Đúng'
                                            : 'Chọn Sai'}
                                </span>
                                <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                        st.isTrue
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                    }`}
                                >
                                    {st.isTrue ? 'ĐÚNG' : 'SAI'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Điền đáp án */}
            {item.type === 'short_answer' && (
                <div className="space-y-1.5 text-sm">
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-white/5">
                        <span className="text-[#556958] dark:text-[#a5b5a8]">Bạn trả lời: </span>
                        <b className="text-[#111812] dark:text-white">
                            {item.given?.trim() || '(bỏ trống)'}
                        </b>
                    </div>
                    <div className="p-2 rounded-xl bg-green-100 dark:bg-green-500/20">
                        <span className="text-green-700 dark:text-green-300">Đáp án đúng: </span>
                        <b className="text-green-800 dark:text-green-200">{item.correctAnswer}</b>
                        {item.alternativeAnswers?.length > 0 && (
                            <span className="text-xs text-green-700 dark:text-green-300">
                                {' '}
                                (hoặc: {item.alternativeAnswers.join(', ')})
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ArenaPracticeResult({ sessionId, onAgain, onExit, onToast }) {
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showReview, setShowReview] = useState(true);
    const startedRef = useRef(false);

    useEffect(() => {
        if (!sessionId || startedRef.current) return;
        startedRef.current = true;

        finalizeArenaPractice(sessionId)
            .then((res) => {
                setResult(res);
                if (res.points > 0) {
                    onToast?.({
                        type: 'success',
                        message: res.capped
                            ? `+${res.points} điểm tích luỹ (đã chạm trần ${res.cap}đ/ngày)`
                            : `+${res.points} điểm tích luỹ!`,
                    });
                }
            })
            .catch((err) => setError(err.message || 'Không chấm được bài'));
    }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <div className="clay-card p-8 flex flex-col items-center gap-3">
                <Icon name="error" size={40} className="text-red-500" />
                <p className="font-extrabold text-[#111812] dark:text-white text-center">{error}</p>
                <Button variant="secondary" icon="arrow_back" onClick={onExit}>
                    Về danh sách phòng
                </Button>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="clay-card p-10 flex flex-col items-center gap-3">
                <Icon name="calculate" size={44} className="text-primary animate-pulse" />
                <p className="text-lg font-extrabold text-[#111812] dark:text-white">
                    Đang chấm bài...
                </p>
            </div>
        );
    }

    const percent = result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0;

    return (
        <div className="space-y-3">
            {/* Điểm */}
            <div className="clay-card p-5 text-center">
                <div className="text-5xl mb-1">
                    {percent >= 80 ? '🌟' : percent >= 50 ? '💪' : '📚'}
                </div>
                <p className="text-3xl font-black text-[#111812] dark:text-white">
                    {result.score}
                    <span className="text-lg text-[#556958] dark:text-[#a5b5a8]">
                        /{result.maxScore}đ
                    </span>
                </p>

                <div
                    className={`mt-4 p-3 rounded-2xl text-sm font-bold ${
                        result.points > 0
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                            : 'bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8]'
                    }`}
                >
                    {result.points > 0 ? (
                        <>
                            <Icon name="check_circle" size={18} className="inline mr-1 align-text-bottom" />
                            +{result.points} điểm tích luỹ
                            {result.capped && ' (chạm trần hôm nay)'}
                        </>
                    ) : result.score > 0 ? (
                        `Bạn đã đạt trần ${result.cap} điểm tích luỹ hôm nay rồi.`
                    ) : (
                        'Chưa có câu nào đúng. Xem lại đáp án bên dưới rồi thử lại nhé!'
                    )}
                </div>

                {result.usedToday !== undefined && (
                    <p className="mt-2 text-xs text-[#556958] dark:text-[#a5b5a8]">
                        Hôm nay đã nhận {result.usedToday}/{result.cap} điểm từ Đấu Trường
                    </p>
                )}
            </div>

            {/* Xem lại đáp án */}
            <div className="clay-card p-4">
                <button
                    onClick={() => setShowReview((v) => !v)}
                    className="w-full flex items-center gap-1.5 mb-1"
                >
                    <Icon name="fact_check" size={20} className="text-primary" />
                    <h3 className="font-extrabold text-[#111812] dark:text-white">
                        Xem lại đáp án
                    </h3>
                    <Icon
                        name={showReview ? 'expand_less' : 'expand_more'}
                        size={20}
                        className="ml-auto text-[#556958] dark:text-[#a5b5a8]"
                    />
                </button>

                {showReview && (
                    <div className="space-y-2.5 mt-3">
                        {(result.review || []).map((item) => (
                            <ReviewItem key={item.index} item={item} />
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <Button variant="secondary" icon="arrow_back" onClick={onExit} className="flex-1">
                    Thoát
                </Button>
                <Button variant="primary" icon="refresh" onClick={onAgain} className="flex-[2]">
                    Luyện tiếp
                </Button>
            </div>
        </div>
    );
}
