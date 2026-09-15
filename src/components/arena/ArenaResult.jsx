import { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { listenToArenaResults } from '../../services/arenaSessionService';
import { finalizeArenaMatch, claimArenaReward } from '../../services/arenaRewardService';

/**
 * Bảng xếp hạng cuối trận + nhận thưởng điểm tích luỹ.
 *
 * MỌI client đều gọi chấm điểm — đó là chủ ý, để ai đó rớt mạng thì người còn
 * lại vẫn kích hoạt được. Cloud Function idempotent nên lần đầu chấm thật, các
 * lần sau trả về đúng bảng xếp hạng đã chốt.
 */

const RANK_STYLES = {
    1: { medal: '🥇', ring: 'ring-2 ring-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
    2: { medal: '🥈', ring: 'ring-2 ring-gray-300', bg: 'bg-gray-50 dark:bg-white/5' },
    3: { medal: '🥉', ring: 'ring-2 ring-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
};

const formatTime = (ms) => {
    const total = Math.round((Number(ms) || 0) / 100) / 10;
    return `${total.toFixed(1)}s`;
};

const CLAIM_MESSAGES = {
    out_of_top5: 'Chỉ Top 5 được thưởng. Cố lên trận sau nhé!',
    zero_score: 'Cần ít nhất 1 câu đúng mới được nhận thưởng.',
    daily_cap: 'Bạn đã đạt trần điểm tích luỹ hôm nay từ Đấu Trường.',
    not_enough_players: 'Trận không đủ số người tối thiểu nên không có thưởng.',
    already_claimed: 'Bạn đã nhận thưởng trận này rồi.',
    not_participant: 'Bạn không tham gia trận này.',
    no_reward_configured: 'Trận này chưa cấu hình phần thưởng.',
};

export default function ArenaResult({ sessionId, myUid, onExit, onToast }) {
    const [ranking, setRanking] = useState(null);
    const [grading, setGrading] = useState(true);
    const [gradeError, setGradeError] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [claimResult, setClaimResult] = useState(null);

    const finalizeStartedRef = useRef(false);

    // ===== Nghe bảng xếp hạng (client khác có thể chấm trước) =====
    useEffect(() => {
        if (!sessionId) return undefined;
        return listenToArenaResults(sessionId, (data) => {
            if (data?.ranking) {
                setRanking(data.ranking);
                setGrading(false);
            }
        });
    }, [sessionId]);

    // ===== Kích hoạt chấm điểm =====
    useEffect(() => {
        if (!sessionId || finalizeStartedRef.current) return;
        finalizeStartedRef.current = true;

        finalizeArenaMatch(sessionId)
            .then((res) => {
                if (res?.ranking) {
                    setRanking(res.ranking);
                    setGrading(false);
                }
            })
            .catch((error) => {
                console.error('Error finalizing arena match:', error);
                // Listener vẫn có thể nhận kết quả từ client khác chấm — chỉ báo lỗi
                // khi sau một lúc vẫn chưa có bảng xếp hạng nào về.
                setGradeError(error.message || 'Không chấm được điểm');
            });
    }, [sessionId]);

    const handleClaim = async () => {
        setClaiming(true);
        try {
            const res = await claimArenaReward(sessionId);
            setClaimResult(res);

            if (res.awarded) {
                onToast?.({
                    type: 'success',
                    message: res.capped
                        ? `Nhận ${res.points} điểm (đã chạm trần ${res.cap}đ/ngày)`
                        : `Nhận ${res.points} điểm tích luỹ!`,
                });
            } else {
                onToast?.({
                    type: 'info',
                    message: CLAIM_MESSAGES[res.reason] || 'Không có thưởng cho trận này',
                });
            }
        } catch (error) {
            onToast?.({ type: 'error', message: error.message || 'Không nhận được thưởng' });
        } finally {
            setClaiming(false);
        }
    };

    // ===== Đang chấm =====
    if (grading && !ranking) {
        return (
            <div className="clay-card p-10 flex flex-col items-center gap-3">
                <Icon name="calculate" size={44} className="text-primary animate-pulse" />
                <p className="text-lg font-extrabold text-[#111812] dark:text-white">
                    Đang chấm điểm...
                </p>
                {gradeError && (
                    <p className="text-sm text-[#556958] dark:text-[#a5b5a8] text-center max-w-xs">
                        {gradeError}
                    </p>
                )}
            </div>
        );
    }

    const list = ranking || [];
    const me = list.find((r) => r.uid === myUid);
    const inTop5 = me && me.rank <= 5 && me.score > 0;
    const canClaim = inTop5 && !claimResult;

    return (
        <div className="space-y-3">
            {/* Kết quả của mình */}
            {me && (
                <div className="clay-card p-5 text-center">
                    <div className="text-5xl mb-1">
                        {RANK_STYLES[me.rank]?.medal || '🎯'}
                    </div>
                    <p className="text-2xl font-black text-[#111812] dark:text-white">
                        Hạng {me.rank}
                    </p>
                    <p className="text-sm text-[#556958] dark:text-[#a5b5a8] mt-0.5">
                        {me.score}đ · {formatTime(me.totalMs)}
                    </p>

                    {canClaim && (
                        <Button
                            variant="primary"
                            icon="redeem"
                            loading={claiming}
                            onClick={handleClaim}
                            className="w-full mt-4"
                        >
                            Nhận điểm tích luỹ
                        </Button>
                    )}

                    {claimResult && (
                        <div
                            className={`mt-4 p-3 rounded-2xl text-sm font-bold ${
                                claimResult.awarded
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                    : 'bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8]'
                            }`}
                        >
                            {claimResult.awarded ? (
                                <>
                                    <Icon name="check_circle" size={18} className="inline mr-1 align-text-bottom" />
                                    +{claimResult.points} điểm tích luỹ
                                    {claimResult.capped && ' (chạm trần hôm nay)'}
                                </>
                            ) : (
                                CLAIM_MESSAGES[claimResult.reason] || 'Không có thưởng'
                            )}
                        </div>
                    )}

                    {me && !inTop5 && !claimResult && (
                        <p className="mt-3 text-sm text-[#556958] dark:text-[#a5b5a8]">
                            {me.score > 0
                                ? 'Chỉ Top 5 được thưởng. Cố lên trận sau nhé!'
                                : 'Chưa có câu nào đúng. Trận sau cố gắng nhé!'}
                        </p>
                    )}
                </div>
            )}

            {/* Bảng xếp hạng */}
            <div className="clay-card p-4">
                <div className="flex items-center gap-1.5 mb-3">
                    <Icon name="leaderboard" size={20} className="text-primary" />
                    <h3 className="font-extrabold text-[#111812] dark:text-white">
                        Bảng xếp hạng
                    </h3>
                </div>

                <div className="space-y-1.5">
                    {list.map((r) => {
                        const style = RANK_STYLES[r.rank];
                        const isMe = r.uid === myUid;

                        return (
                            <div
                                key={r.uid}
                                className={`flex items-center gap-3 p-2.5 rounded-2xl transition-colors
                                    ${style?.bg || 'bg-[#f0f5f1] dark:bg-white/5'}
                                    ${isMe ? 'ring-2 ring-primary' : ''}`}
                            >
                                <span className="shrink-0 w-8 text-center font-black text-[#111812] dark:text-white">
                                    {style?.medal || r.rank}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[#111812] dark:text-white truncate">
                                        {r.name || 'Học sinh'}
                                        {isMe && (
                                            <span className="ml-1 text-xs text-primary font-extrabold">
                                                (bạn)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-[#556958] dark:text-[#a5b5a8]">
                                        {formatTime(r.totalMs)}
                                    </p>
                                </div>
                                <span className="shrink-0 font-black text-primary-dark dark:text-primary">
                                    {r.score}đ
                                </span>
                            </div>
                        );
                    })}
                </div>

                {list.length === 0 && (
                    <p className="py-6 text-center text-[#556958] dark:text-[#a5b5a8]">
                        Chưa có kết quả
                    </p>
                )}
            </div>

            <Button variant="secondary" icon="arrow_back" onClick={onExit} className="w-full">
                Về danh sách phòng
            </Button>
        </div>
    );
}
