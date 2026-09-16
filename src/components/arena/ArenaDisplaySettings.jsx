import { useState } from 'react';
import Icon from '../common/Icon';
import { FONT_SCALES, IMAGE_SCALES } from '../../hooks/useArenaDisplayPrefs';

/**
 * Nút chỉnh cỡ chữ / cỡ ảnh trong lúc làm bài.
 *
 * Đặt ngay cạnh đồng hồ để HS chỉnh được giữa chừng mà không phải rời màn thi.
 * Mọi thay đổi áp dụng tức thì và được nhớ lại cho lần sau.
 */
export default function ArenaDisplaySettings({
    prefs,
    onFontScale,
    onImageMaxHeight,
    onReset,
    hasImage = false,
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                title="Cỡ chữ và cỡ ảnh"
                aria-label="Chỉnh cỡ chữ và cỡ ảnh"
                className="shrink-0 size-8 rounded-full bg-[#f0f5f1] dark:bg-white/10 flex items-center justify-center text-[#556958] dark:text-[#a5b5a8] hover:bg-primary/15 hover:text-primary-dark dark:hover:text-primary transition-colors active:scale-95"
            >
                <Icon name="format_size" size={18} />
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="clay-card w-full max-w-sm p-5 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="format_size" size={22} className="text-primary" />
                            <h3 className="text-lg font-extrabold text-[#111812] dark:text-white">
                                Hiển thị
                            </h3>
                            <button
                                onClick={onReset}
                                className="ml-auto text-xs font-bold text-[#556958] dark:text-[#a5b5a8] hover:text-primary-dark dark:hover:text-primary"
                            >
                                Mặc định
                            </button>
                        </div>

                        {/* Cỡ chữ */}
                        <p className="text-sm font-extrabold text-[#111812] dark:text-white mb-2">
                            Cỡ chữ
                        </p>
                        <div className="flex gap-1.5 mb-2">
                            {FONT_SCALES.map((s) => (
                                <button
                                    key={s.value}
                                    onClick={() => onFontScale(s.value)}
                                    title={s.label}
                                    className={`flex-1 py-2.5 rounded-2xl font-extrabold transition-all active:scale-95 ${
                                        prefs.fontScale === s.value
                                            ? 'bg-primary/20 border-2 border-primary text-[#111812] dark:text-white'
                                            : 'bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8] hover:bg-primary/10'
                                    }`}
                                    style={{ fontSize: `${0.75 * s.value + 0.35}rem` }}
                                >
                                    {s.short}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-[#556958] dark:text-[#a5b5a8] mb-4">
                            Đang dùng:{' '}
                            <b>{FONT_SCALES.find((s) => s.value === prefs.fontScale)?.label || 'Tuỳ chỉnh'}</b>
                        </p>

                        {/* Cỡ ảnh */}
                        <p className="text-sm font-extrabold text-[#111812] dark:text-white mb-2">
                            Cỡ ảnh đề
                            {!hasImage && (
                                <span className="ml-1.5 text-xs font-medium text-[#556958] dark:text-[#a5b5a8]">
                                    (câu này không có ảnh)
                                </span>
                            )}
                        </p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {IMAGE_SCALES.map((s) => (
                                <button
                                    key={s.value}
                                    onClick={() => onImageMaxHeight(s.value)}
                                    className={`py-2 rounded-2xl text-[11px] font-bold leading-tight transition-all active:scale-95 ${
                                        prefs.imageMaxHeight === s.value
                                            ? 'bg-primary/20 border-2 border-primary text-[#111812] dark:text-white'
                                            : 'bg-[#f0f5f1] dark:bg-white/5 text-[#556958] dark:text-[#a5b5a8] hover:bg-primary/10'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <p className="mt-4 text-xs text-[#556958] dark:text-[#a5b5a8] text-center">
                            Chỉ đổi cách hiển thị trên máy này, không ảnh hưởng bài làm.
                        </p>

                        <button
                            onClick={() => setOpen(false)}
                            className="w-full mt-3 py-2.5 rounded-2xl font-extrabold bg-primary/15 text-primary-dark dark:text-primary hover:bg-primary/25 transition-colors"
                        >
                            Xong
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
