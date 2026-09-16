import { useEffect, useRef, useState, useCallback } from 'react';
import { useServerTime } from './useServerTime';
import {
    listenToArenaMeta,
    advanceArenaPhase,
    catchUpArenaPhase,
} from '../services/arenaSessionService';

/**
 * Nhịp trận Đấu Trường: đếm ngược, tự đẩy câu khi hết giờ, tự nộp bài trước khi chuyển.
 *
 * CÁCH ĐỒNG BỘ: deadline là mốc tuyệt đối trên RTDB (`questionEndsAt`), so với
 * thời gian server ước lượng. Không client nào "làm chủ" nhịp trận — ai thấy hết
 * giờ cũng gọi đẩy câu, transaction phía service đảm bảo chỉ lần đầu có tác dụng.
 * Nhờ vậy mọi người rớt mạng trừ một người thì trận vẫn chạy tiếp.
 *
 * @param {string} sessionId
 * @param {Object} settings - cài đặt arena
 * @param {Function} onAutoSubmit - gọi trước khi hết giờ câu hiện tại, để nộp bài dở
 * @returns {Object} - { meta, phase, questionIndex, remainingMs, remainingSec, isRunning, isGrading }
 */
export const useArenaPhase = (sessionId, settings, onAutoSubmit) => {
    const { serverNow, ready } = useServerTime();
    const [meta, setMeta] = useState(null);
    const [remainingMs, setRemainingMs] = useState(0);

    // Dùng ref cho callback/settings để interval không phải tạo lại mỗi lần cha
    // re-render. Gán trong effect (không gán khi render) theo đúng quy tắc React.
    const autoSubmitRef = useRef(onAutoSubmit);
    const settingsRef = useRef(settings);

    useEffect(() => {
        autoSubmitRef.current = onAutoSubmit;
    }, [onAutoSubmit]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Chống gọi đẩy câu nhiều lần cho cùng một mốc: khoá theo "index:phase"
    const advancingRef = useRef(null);
    // Chống nộp tự động hai lần cho cùng một câu
    const autoSubmittedRef = useRef(null);

    // ===== Nghe tiến độ trận =====
    useEffect(() => {
        if (!sessionId) return undefined;
        return listenToArenaMeta(sessionId, setMeta);
    }, [sessionId]);

    // ===== Bắt kịp nhịp khi vào muộn / mở lại tab =====
    useEffect(() => {
        if (!sessionId || !ready || !settings) return;
        catchUpArenaPhase(sessionId, settings).catch((error) => {
            console.error('Error catching up arena phase:', error);
        });
    }, [sessionId, ready, settings]);

    // ===== Đồng hồ đếm ngược + tự đẩy câu =====
    useEffect(() => {
        if (!meta || !sessionId || !ready) return undefined;

        const tick = () => {
            const now = serverNow();
            const isQuestion = meta.phase === 'question';
            const deadline = isQuestion ? meta.questionEndsAt : meta.phaseEndsAt;

            if (!deadline) {
                setRemainingMs(0);
                return;
            }

            const left = deadline - now;
            setRemainingMs(Math.max(0, left));

            if (meta.status !== 'running') return;

            const phaseKey = `${meta.questionIndex}:${meta.phase}`;

            // Sát giờ: nộp bài dở trước khi câu bị khoá lại.
            // Làm sớm 300ms để request kịp bay đi trước khi phase đổi.
            if (isQuestion && left <= 300 && autoSubmittedRef.current !== phaseKey) {
                autoSubmittedRef.current = phaseKey;
                Promise.resolve(autoSubmitRef.current?.(meta.questionIndex)).catch((error) => {
                    console.error('Error auto-submitting arena answer:', error);
                });
            }

            // Hết giờ: đẩy sang phase kế tiếp
            if (left <= 0 && advancingRef.current !== phaseKey) {
                advancingRef.current = phaseKey;
                advanceArenaPhase(sessionId, meta.questionIndex, meta.phase, settingsRef.current)
                    .catch((error) => {
                        console.error('Error advancing arena phase:', error);
                        // Cho phép thử lại ở nhịp sau nếu mạng chập chờn
                        advancingRef.current = null;
                    });
            }
        };

        tick();
        const timer = setInterval(tick, 250);
        return () => clearInterval(timer);
    }, [meta, sessionId, ready, serverNow]);

    const isRunning = meta?.status === 'running';
    const isGrading = meta?.status === 'grading';
    const isFinished = meta?.status === 'finished';

    // Thời điểm câu hiện tại bắt đầu — để đo thời gian suy nghĩ khi nộp bài
    const questionStartedAt = useCallback(() => {
        if (!meta) return 0;
        // Mốc tường minh là nguồn đáng tin: deadline có thể bị rút ngắn khi cả
        // phòng đã trả lời xong, lúc đó phép trừ ngược sẽ ra mốc sai.
        if (meta.questionStartsAt) return meta.questionStartsAt;

        const seconds = Number(meta.questionSeconds) || 0;
        if (meta.phase === 'question' && meta.questionEndsAt && seconds) {
            return meta.questionEndsAt - seconds * 1000;
        }
        return meta.startedAt || 0;
    }, [meta]);

    return {
        meta,
        phase: meta?.phase || null,
        questionIndex: meta?.questionIndex ?? 0,
        totalQuestions: meta?.totalQuestions ?? 0,
        remainingMs,
        remainingSec: Math.ceil(remainingMs / 1000),
        isRunning,
        isGrading,
        isFinished,
        questionStartedAt,
        serverNow,
        serverTimeReady: ready,
    };
};

export default useArenaPhase;
