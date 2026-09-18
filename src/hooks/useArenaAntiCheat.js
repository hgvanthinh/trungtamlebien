import { useEffect, useRef, useState } from 'react';

/**
 * Chống gian lận khi làm bài Đấu Trường.
 *
 * GIỚI HẠN CẦN BIẾT RÕ: trình duyệt KHÔNG cho phép web chặn chụp màn hình.
 * Phím PrintScreen, công cụ cắt ảnh của Windows, hay chụp bằng điện thoại khác
 * đều nằm ngoài tầm với của mọi trang web — không có API nào làm được việc đó.
 * Vì vậy cách tiếp cận ở đây là PHÁT HIỆN và RĂN ĐE, không phải ngăn chặn:
 *
 * 1. Rời tab / thu nhỏ cửa sổ  → đếm số lần và tổng thời gian rời đi.
 * 2. Nhấn PrintScreen           → đếm, và xoá clipboard (chỉ chặn được đường
 *                                 dán trực tiếp, không chặn được ảnh đã chụp).
 * 3. Chuột phải / Ctrl+C / Ctrl+P / F12 → chặn, cho khó sao chép đề.
 *
 * Số lần vi phạm được báo cho nơi gọi để ghi vào bài làm, nên thầy cô nhìn kết
 * quả là biết em nào rời màn hình bao nhiêu lần — đó mới là thứ có sức răn đe
 * thật, hơn hẳn việc cố chặn một thao tác vốn không chặn được.
 *
 * @param {Object} opts
 * @param {boolean} opts.enabled - bật khi đang làm bài
 * @param {Function} opts.onViolation - gọi mỗi lần phát hiện, nhận { type, count }
 */
export const useArenaAntiCheat = ({ enabled = false, onViolation } = {}) => {
    const [blurCount, setBlurCount] = useState(0);
    const [awayMs, setAwayMs] = useState(0);
    const [screenshotCount, setScreenshotCount] = useState(0);
    const [isAway, setIsAway] = useState(false);

    const awaySinceRef = useRef(0);
    const onViolationRef = useRef(onViolation);

    useEffect(() => {
        onViolationRef.current = onViolation;
    }, [onViolation]);

    useEffect(() => {
        if (!enabled) return undefined;

        // ===== Rời tab / thu nhỏ cửa sổ =====
        const handleVisibility = () => {
            if (document.hidden) {
                awaySinceRef.current = Date.now();
                setIsAway(true);
                setBlurCount((c) => {
                    const next = c + 1;
                    onViolationRef.current?.({ type: 'tab_switch', count: next });
                    return next;
                });
            } else {
                setIsAway(false);
                if (awaySinceRef.current) {
                    const gone = Date.now() - awaySinceRef.current;
                    awaySinceRef.current = 0;
                    setAwayMs((ms) => ms + gone);
                }
            }
        };

        // ===== PrintScreen =====
        // Không chặn được việc ảnh đã vào clipboard, nhưng ghi đè clipboard làm
        // đường "chụp rồi dán vào Google" khó hơn hẳn.
        const handleKeyUp = (e) => {
            if (e.key === 'PrintScreen') {
                navigator.clipboard?.writeText('').catch(() => {});
                setScreenshotCount((c) => {
                    const next = c + 1;
                    onViolationRef.current?.({ type: 'screenshot', count: next });
                    return next;
                });
            }
        };

        // ===== Chặn các lối sao chép đề thông dụng =====
        const handleKeyDown = (e) => {
            const k = e.key?.toLowerCase();
            const blocked =
                (e.ctrlKey || e.metaKey) && (k === 'c' || k === 'p' || k === 's' || k === 'u');
            // F12 và Ctrl+Shift+I/J/C — devtools
            const devtools =
                e.key === 'F12' ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k));

            if (blocked || devtools) {
                e.preventDefault();
                return false;
            }
            return undefined;
        };

        const handleContextMenu = (e) => e.preventDefault();
        const handleCopy = (e) => e.preventDefault();

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('copy', handleCopy);

        // Chặn bôi đen đề bằng CSS, để không sao chép được bằng chuột
        const prevSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('copy', handleCopy);
            document.body.style.userSelect = prevSelect;
        };
    }, [enabled]);

    return {
        blurCount,
        awayMs,
        screenshotCount,
        isAway,
        totalViolations: blurCount + screenshotCount,
    };
};

export default useArenaAntiCheat;
