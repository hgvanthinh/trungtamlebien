import Icon from '../common/Icon';
import { MathText } from '../math';
import { QUESTION_TYPE_LABELS, describeCorrectAnswer, getSessionDisplayStatus } from '../../services/arenaHistoryService';

/**
 * Chi tiết một trận cho ADMIN: đề đầy đủ (có đáp án) + kết quả từng thí sinh.
 *
 * Dùng cho cả hai tình huống:
 * - Trận đã xong: xem lại ai được mấy điểm, đề gồm câu nào.
 * - Trận ĐANG CHẠY: xem trước đề để kịp chuẩn bị giảng lại cho cả phòng.
 *   Lúc này chưa có bảng xếp hạng nên chỉ hiện phần đề.
 *
 * Component này CHỈ render trong trang admin. Đáp án hiển thị ở đây là dữ liệu
 * mà firestore.rules đã chặn học sinh đọc.
 */

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const STATEMENT_LABELS = ['a', 'b', 'c', 'd'];

const formatTime = (ms) => `${(Math.round((Number(ms) || 0) / 100) / 10).toFixed(1)}s`;

const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/** Một câu trong phần xem đề */
function QuestionCard({ q, index }) {
    return (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="shrink-0 size-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {QUESTION_TYPE_LABELS[q.type] || q.type}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {q.points}đ
                </span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {q.seconds}s
                </span>
            </div>

            {q.questionImage && (
                <img src={q.questionImage} alt="" className="mb-2 max-h-40 rounded-lg" />
            )}
            <MathText
                as="div"
                className="font-medium text-gray-900 dark:text-white mb-2"
                content={q.questionText}
            />

            {/* ABCD */}
            {q.type === 'abcd' && (
                <div className="space-y-1">
                    {(q.answers || []).map((a, i) => (
                        <div
                            key={i}
                            className={`flex items-start gap-2 p-1.5 rounded text-sm ${
                                a.isCorrect
                                    ? 'bg-green-100 dark:bg-green-500/20 font-semibold'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            <span className="shrink-0 font-bold">{ANSWER_LABELS[i]}.</span>
                            <MathText className="flex-1 min-w-0" content={a.text} />
                            {a.isCorrect && (
                                <Icon name="check_circle" size={16} className="shrink-0 text-green-600" />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Đúng - Sai */}
            {q.type === 'true_false' && (
                <div className="space-y-1">
                    {(q.statements || []).map((st, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 p-1.5 rounded text-sm bg-white dark:bg-gray-800"
                        >
                            <span className="shrink-0 font-bold text-gray-500 dark:text-gray-400">
                                {STATEMENT_LABELS[i]})
                            </span>
                            <MathText
                                className="flex-1 min-w-0 text-gray-700 dark:text-gray-300"
                                content={st.text}
                            />
                            <span
                                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                                    st.isTrue ? 'bg-green-500' : 'bg-red-500'
                                }`}
                            >
                                {st.isTrue ? 'ĐÚNG' : 'SAI'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Điền đáp án */}
            {q.type === 'short_answer' && (
                <div className="p-2 rounded bg-green-100 dark:bg-green-500/20 text-sm">
                    <span className="text-green-700 dark:text-green-300">Đáp án: </span>
                    <b className="text-green-800 dark:text-green-200">
                        {describeCorrectAnswer(q)}
                    </b>
                </div>
            )}
        </div>
    );
}

export default function ArenaSessionDetail({ session, onClose }) {
    if (!session) return null;

    const displayStatus = getSessionDisplayStatus(session);
    const isRunning = displayStatus === 'running';
    const ranking = session.ranking || [];
    const questions = session.questions || [];
    const isPractice = session.mode === 'practice';

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-3"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-[96vw] h-[96vh] overflow-y-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header dính, để cuộn dài vẫn đóng được */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {isPractice ? 'Lượt luyện tập' : 'Trận đấu'}
                            {isRunning && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-bold animate-pulse">
                                    Đang diễn ra
                                </span>
                            )}
                            {displayStatus === 'abandoned' && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold">
                                    Bỏ dở — không chấm điểm
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(session.createdAt)} · {session.playerCount || 0} thí sinh
                            {session.folderId && ` · ${questions.length} câu`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 size-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Cảnh báo khi xem đề trận đang chạy */}
                    {isRunning && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-800 dark:text-amber-300">
                            <Icon name="warning" size={16} className="inline mr-1 align-text-bottom" />
                            Trận đang diễn ra — đây là đề học sinh đang làm. Không chiếu màn hình này
                            cho cả phòng xem.
                        </div>
                    )}

                    {/* Kết quả */}
                    {ranking.length > 0 && (
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                                <Icon name="leaderboard" size={18} className="text-blue-500" />
                                Kết quả
                            </h4>
                            <div className="space-y-1">
                                {ranking.map((r) => (
                                    <div
                                        key={r.uid}
                                        className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                                    >
                                        <span className="shrink-0 w-7 text-center font-bold text-gray-700 dark:text-gray-300">
                                            {r.rank}
                                        </span>
                                        <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-white truncate">
                                            {r.name || 'Học sinh'}
                                        </span>
                                        {/* Cờ nghi vấn: rời màn hình / bấm PrintScreen */}
                                        {r.flags && (
                                            <span
                                                title={`Rời màn hình ${r.flags.tabSwitches} lần${
                                                    r.flags.awayMs
                                                        ? ` (tổng ${Math.round(r.flags.awayMs / 1000)}s)`
                                                        : ''
                                                }${
                                                    r.flags.screenshots
                                                        ? ` · Chụp màn hình ${r.flags.screenshots} lần`
                                                        : ''
                                                }`}
                                                className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-[11px] font-bold"
                                            >
                                                <Icon name="warning" size={12} />
                                                {r.flags.tabSwitches > 0 && `${r.flags.tabSwitches}↗`}
                                                {r.flags.screenshots > 0 && ` ${r.flags.screenshots}📷`}
                                            </span>
                                        )}
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                            {formatTime(r.totalMs)}
                                        </span>
                                        <span className="shrink-0 font-bold text-blue-600 dark:text-blue-400 w-14 text-right">
                                            {r.score}đ
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Kết quả lượt luyện tập (không có ranking) */}
                    {isPractice && session.practiceResult && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <b>{session.playerNames?.[session.playerUids?.[0]] || 'Học sinh'}</b> được{' '}
                                <b>
                                    {session.practiceResult.score}/{session.practiceResult.maxScore}đ
                                </b>{' '}
                                · nhận {session.practiceResult.points} điểm tích luỹ
                            </p>
                        </div>
                    )}

                    {/* Đề */}
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                            <Icon name="quiz" size={18} className="text-blue-500" />
                            Đề bài ({questions.length} câu)
                        </h4>
                        <div className="space-y-2">
                            {questions.map((q, i) => (
                                <QuestionCard key={i} q={q} index={i} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
