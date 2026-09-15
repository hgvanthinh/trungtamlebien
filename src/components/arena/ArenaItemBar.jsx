import { useState } from 'react';
import Icon from '../common/Icon';
import { ARENA_ITEM_EFFECTS, isEffectUsableForType } from '../../services/arenaItemService';

/**
 * Thanh vật phẩm trong trận Đấu Trường.
 *
 * Vật phẩm = viền avatar HS sở hữu trong kho. Mỗi trận dùng được 1 lần / vật phẩm,
 * viền KHÔNG bị mất. Nút bị mờ khi không dùng được, kèm lời giải thích ngắn để HS
 * hiểu vì sao (sai loại câu, đã dùng rồi, chưa tới lúc đặt cược...).
 */

const ORDER = ['freeze', 'double', 'fifty', 'hint_tf', 'fire'];

const ITEM_STYLES = {
    freeze: 'from-sky-400 to-blue-500',
    double: 'from-amber-400 to-orange-500',
    fifty: 'from-violet-400 to-purple-500',
    hint_tf: 'from-yellow-300 to-amber-400',
    fire: 'from-red-400 to-rose-500',
};

export default function ArenaItemBar({
    owned = {},
    used = {},
    phase,
    questionType,
    nextQuestionType,
    isFrozen,
    doubleArmedFor = null,
    currentQuestionIndex = 0,
    answered = false,
    players = {},
    myUid,
    onFreeze,
    onDouble,
    onFifty,
    onHintTf,
    onFire,
    busy = null,
}) {
    const [showTargets, setShowTargets] = useState(false);
    const [showStatementPicker, setShowStatementPicker] = useState(false);

    const ownedEffects = ORDER.filter((e) => owned[e]);
    if (ownedEffects.length === 0) return null;

    /**
     * Vì sao vật phẩm này chưa dùng được? null = dùng được.
     * Trả về chuỗi ngắn để hiển thị dưới nút.
     */
    const getBlockReason = (effect) => {
        if (used[effect]) return 'Đã dùng';
        if (busy === effect) return 'Đang dùng...';

        switch (effect) {
            case 'freeze': {
                if (phase !== 'question') return 'Chờ vào câu';
                const others = Object.keys(players).filter((id) => id !== myUid);
                if (others.length === 0) return 'Không có đối thủ';
                return null;
            }
            case 'double': {
                // Đặt cược TRƯỚC khi vào câu kế — chỉ mở trong khoảng chuyển câu
                if (phase !== 'interstitial') return 'Chỉ đặt giữa 2 câu';
                if (!nextQuestionType) return 'Đã hết câu';
                if (!isEffectUsableForType('double', nextQuestionType)) return 'Câu sau không áp dụng';
                return null;
            }
            case 'fifty': {
                if (phase !== 'question') return 'Chờ vào câu';
                if (!isEffectUsableForType('fifty', questionType)) return 'Chỉ câu 4 đáp án';
                if (answered) return 'Đã trả lời';
                return null;
            }
            case 'hint_tf': {
                if (phase !== 'question') return 'Chờ vào câu';
                if (!isEffectUsableForType('hint_tf', questionType)) return 'Chỉ câu đúng-sai';
                if (answered) return 'Đã trả lời';
                return null;
            }
            case 'fire':
                if (!isFrozen) return 'Chưa bị đóng băng';
                return null;
            default:
                return 'Không khả dụng';
        }
    };

    const handleClick = (effect) => {
        if (getBlockReason(effect)) return;

        switch (effect) {
            case 'freeze':
                setShowTargets(true);
                break;
            case 'double':
                onDouble?.();
                break;
            case 'fifty':
                onFifty?.();
                break;
            case 'hint_tf':
                setShowStatementPicker(true);
                break;
            case 'fire':
                onFire?.();
                break;
            default:
                break;
        }
    };

    const opponents = Object.entries(players).filter(([id]) => id !== myUid);

    return (
        <>
            <div className="clay-card p-3">
                <div className="flex items-center gap-1.5 mb-2.5">
                    <Icon name="backpack" size={18} className="text-primary" />
                    <span className="text-sm font-extrabold text-[#111812] dark:text-white">
                        Vật phẩm
                    </span>
                    {doubleArmedFor === currentQuestionIndex && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-extrabold animate-pulse">
                            ⚡ Đang cược x2
                        </span>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                    {ownedEffects.map((effect) => {
                        const def = ARENA_ITEM_EFFECTS[effect];
                        const blocked = getBlockReason(effect);
                        const isUsed = !!used[effect];

                        return (
                            <button
                                key={effect}
                                onClick={() => handleClick(effect)}
                                disabled={!!blocked}
                                title={blocked || def.description}
                                className={`shrink-0 w-[92px] p-2 rounded-2xl flex flex-col items-center gap-1 transition-all
                                    ${blocked
                                        ? 'bg-[#f0f5f1] dark:bg-white/5 opacity-50 cursor-not-allowed'
                                        : 'bg-white dark:bg-white/10 shadow-sm hover:scale-105 active:scale-95'
                                    }`}
                            >
                                <span
                                    className={`size-10 rounded-full flex items-center justify-center bg-gradient-to-br ${ITEM_STYLES[effect]} ${isUsed ? 'grayscale' : ''}`}
                                >
                                    <Icon name={def.icon} size={22} className="text-white" />
                                </span>
                                <span className="text-[11px] font-bold text-[#111812] dark:text-white leading-tight text-center">
                                    {def.label}
                                </span>
                                {blocked && (
                                    <span className="text-[10px] text-[#556958] dark:text-[#a5b5a8] leading-none text-center">
                                        {blocked}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chọn đối thủ để đóng băng */}
            {showTargets && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setShowTargets(false)}
                >
                    <div
                        className="clay-card w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">❄️</span>
                            <h3 className="text-lg font-extrabold text-[#111812] dark:text-white">
                                Đóng băng ai?
                            </h3>
                        </div>
                        <p className="text-sm text-[#556958] dark:text-[#a5b5a8] mb-4">
                            Đối thủ sẽ không nhìn thấy đề trong 10 giây, nhưng đồng hồ vẫn chạy.
                        </p>

                        <div className="space-y-2">
                            {opponents.map(([uid, p]) => (
                                <button
                                    key={uid}
                                    onClick={() => {
                                        setShowTargets(false);
                                        onFreeze?.(uid, p.name);
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                                >
                                    <Icon name="person" size={20} className="shrink-0 text-[#556958] dark:text-[#a5b5a8]" />
                                    <span className="flex-1 text-left font-bold text-[#111812] dark:text-white truncate">
                                        {p.name}
                                    </span>
                                    {p.online === false && (
                                        <span className="text-xs text-[#556958] dark:text-[#a5b5a8]">
                                            offline
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowTargets(false)}
                            className="w-full mt-4 py-2.5 rounded-2xl font-bold text-[#556958] dark:text-[#a5b5a8] hover:bg-[#f0f5f1] dark:hover:bg-white/10"
                        >
                            Huỷ
                        </button>
                    </div>
                </div>
            )}

            {/* Chọn ý cần gợi ý (câu đúng-sai) */}
            {showStatementPicker && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setShowStatementPicker(false)}
                >
                    <div
                        className="clay-card w-full max-w-sm p-5 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">💡</span>
                            <h3 className="text-lg font-extrabold text-[#111812] dark:text-white">
                                Gợi ý ý nào?
                            </h3>
                        </div>
                        <p className="text-sm text-[#556958] dark:text-[#a5b5a8] mb-4">
                            Bạn sẽ biết ý đó đúng hay sai. Chỉ chọn được 1 ý.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            {['a', 'b', 'c', 'd'].map((label, idx) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        setShowStatementPicker(false);
                                        onHintTf?.(idx);
                                    }}
                                    className="py-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5 hover:bg-amber-100 dark:hover:bg-amber-500/20 font-extrabold text-[#111812] dark:text-white transition-colors"
                                >
                                    Ý {label})
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowStatementPicker(false)}
                            className="w-full mt-4 py-2.5 rounded-2xl font-bold text-[#556958] dark:text-[#a5b5a8] hover:bg-[#f0f5f1] dark:hover:bg-white/10"
                        >
                            Huỷ
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
