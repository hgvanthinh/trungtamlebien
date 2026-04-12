// src/pages/admin/Teaching/useTeachingHandlers.js
// ─── Data handlers & business logic for Teaching page ──────────

import { useState, useRef, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { saveSession, resetClassPointsAndCoins, resetStudyPoints, updateStudentLabelColor } from '../../../services/classService';

/**
 * Hook chứa toàn bộ state xử lý điểm và business logic cho Teaching.
 * Tách khỏi component chính để giảm độ dài file.
 */
export function useTeachingHandlers({ students, selectedClassId, classes, fetchStudents, setToast }) {
    // Inline input states
    const [pointsInputs, setPointsInputs] = useState({});
    const [coinsInputs, setCoinsInputs] = useState({});
    const [studyPointsInputs, setStudyPointsInputs] = useState({});

    // Reset state
    const [saving, setSaving] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetValues, setResetValues] = useState({ points: 0, coins: 0 });
    const [resetting, setResetting] = useState(false);
    const [resettingStudy, setResettingStudy] = useState(false);
    const [resetBackup, setResetBackup] = useState(null);
    const [undoing, setUndoing] = useState(false);

    // Sort state
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [sortBy, setSortBy] = useState('name');

    // Color state
    const [studentColors, setStudentColors] = useState({});

    // Ripple state
    const [ripples, setRipples] = useState([]);

    // Zoom avatar state
    const [zoomedAvatarId, setZoomedAvatarId] = useState(null);
    const [zoomOrigin, setZoomOrigin] = useState({ x: '50%', y: '50%' });

    // Overview mode
    const [overviewMode, setOverviewMode] = useState(false);

    // Input refs
    const pointsInputRefs = useRef({});
    const coinsInputRefs = useRef({});
    const studyPointsInputRefs = useRef({});

    // ── Sort ──
    const getLastName = (fullName) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    };

    const getSortedStudents = useMemo(() => {
        const studentsCopy = [...students];
        switch (sortBy) {
            case 'name':
                return studentsCopy.sort((a, b) => getLastName(a.fullName).localeCompare(getLastName(b.fullName), 'vi'));
            case 'points':
                return studentsCopy.sort((a, b) => (b.totalBehaviorPoints || 0) - (a.totalBehaviorPoints || 0));
            case 'coins':
                return studentsCopy.sort((a, b) => (b.coins || 0) - (a.coins || 0));
            default:
                return studentsCopy;
        }
    }, [students, sortBy]);

    const handleSortChange = (newSortBy) => {
        setSortBy(newSortBy);
        setShowSortMenu(false);
    };

    // ── Input changes ──
    const handlePointsChange = (studentUid, value) => {
        setPointsInputs(prev => ({ ...prev, [studentUid]: value }));
        const pointsValue = parseInt(value) || 0;
        const autoCoins = Math.floor(pointsValue * 0.5);
        setCoinsInputs(prev => ({ ...prev, [studentUid]: autoCoins > 0 ? String(autoCoins) : '' }));
    };

    const handleCoinsChange = (studentUid, value) => {
        setCoinsInputs(prev => ({ ...prev, [studentUid]: value }));
    };

    const handleStudyPointsChange = (studentUid, value) => {
        const normalizedValue = value.trim().toLowerCase();
        if (normalizedValue === 'vắng' || normalizedValue === 'v') {
            setStudyPointsInputs(prev => ({ ...prev, [studentUid]: 'Vắng' }));
        } else {
            setStudyPointsInputs(prev => ({ ...prev, [studentUid]: value }));
        }
    };

    // ── Keyboard navigation for inputs ──
    const handlePointsKeyDown = (e, studentUid) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const next = sorted[idx + 1];
            if (next && pointsInputRefs.current[next.uid]) pointsInputRefs.current[next.uid].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const prev = sorted[idx - 1];
            if (prev && pointsInputRefs.current[prev.uid]) pointsInputRefs.current[prev.uid].focus();
        }
    };

    const handleCoinsKeyDown = (e, studentUid) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const next = sorted[idx + 1];
            if (next && coinsInputRefs.current[next.uid]) coinsInputRefs.current[next.uid].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const prev = sorted[idx - 1];
            if (prev && coinsInputRefs.current[prev.uid]) coinsInputRefs.current[prev.uid].focus();
        }
    };

    const handleStudyPointsKeyDown = (e, studentUid) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const next = sorted[idx + 1];
            if (next && studyPointsInputRefs.current[next.uid]) studyPointsInputRefs.current[next.uid].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const sorted = getSortedStudents;
            const idx = sorted.findIndex(s => s.uid === studentUid);
            const prev = sorted[idx - 1];
            if (prev && studyPointsInputRefs.current[prev.uid]) studyPointsInputRefs.current[prev.uid].focus();
        }
    };

    // ── Color ──
    const handleColorChange = async (studentUid, color) => {
        const newColor = studentColors[studentUid] === color ? null : color;
        setStudentColors(prev => ({ ...prev, [studentUid]: newColor }));

        const result = await updateStudentLabelColor(studentUid, newColor);
        if (!result.success) {
            setStudentColors(prev => ({ ...prev, [studentUid]: studentColors[studentUid] }));
            setToast({ message: 'Lỗi khi lưu màu', type: 'error' });
        }
    };

    const getNameColorClass = (studentUid) => {
        const color = studentColors[studentUid];
        switch (color) {
            case 'black': return 'text-gray-900 dark:text-gray-100';
            case 'blue': return 'text-blue-600 dark:text-blue-400';
            case 'green': return 'text-green-600 dark:text-green-400';
            case 'red': return 'text-red-600 dark:text-red-400';
            default: return 'text-[#111812] dark:text-white';
        }
    };

    // ── Save session ──
    const handleSaveSession = async () => {
        if (!selectedClassId) {
            setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
            return;
        }
        setSaving(true);
        try {
            const behaviorPoints = {};
            const coins = {};
            const studyPoints = {};

            Object.keys(pointsInputs).forEach(uid => {
                const value = parseInt(pointsInputs[uid]);
                if (!isNaN(value) && value !== 0) behaviorPoints[uid] = { points: value, reason: '' };
            });
            Object.keys(coinsInputs).forEach(uid => {
                const value = parseInt(coinsInputs[uid]);
                if (!isNaN(value) && value !== 0) coins[uid] = { coins: value, reason: '' };
            });
            Object.keys(studyPointsInputs).forEach(uid => {
                const inputValue = studyPointsInputs[uid];
                if (inputValue === 'Vắng') {
                    studyPoints[uid] = { points: 'Vắng' };
                } else {
                    const value = parseFloat(inputValue);
                    if (!isNaN(value)) studyPoints[uid] = { points: Math.round(value * 100) / 100 };
                }
            });

            const today = new Date().toISOString().split('T')[0];
            const result = await saveSession(selectedClassId, today, null, null, behaviorPoints, coins, null, studyPoints);

            if (result.success) {
                setToast({ message: 'Đã cập nhật điểm tích lũy, xu và điểm học tập thành công!', type: 'success' });
                setPointsInputs({});
                setCoinsInputs({});
                setStudyPointsInputs({});
                fetchStudents();
            } else {
                setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
            }
        } catch (error) {
            console.error('Error saving session:', error);
            setToast({ message: 'Lỗi khi lưu điểm', type: 'error' });
        }
        setSaving(false);
    };

    // ── Undo reset points ──
    const handleUndoResetPoints = async () => {
        if (undoing) return;
        if (!resetBackup || resetBackup.type !== 'points') {
            setToast({ message: 'Không có dữ liệu để hoàn tác', type: 'error' });
            return;
        }
        const backupData = resetBackup.data;
        setUndoing(true);
        setToast({ message: 'Đang hoàn tác...', type: 'info' });
        try {
            await Promise.all(backupData.map(student => {
                const userRef = doc(db, 'users', student.uid);
                return updateDoc(userRef, {
                    totalBehaviorPoints: student.totalBehaviorPoints,
                    coins: student.coins
                });
            }));
            await fetchStudents();
            setResetBackup(null);
            setToast({ message: 'Đã hoàn tác reset điểm/xu thành công!', type: 'success' });
        } catch (error) {
            console.error('Error undoing reset:', error);
            setToast({ message: 'Lỗi khi hoàn tác: ' + error.message, type: 'error' });
        } finally {
            setUndoing(false);
        }
    };

    // ── Undo reset study points ──
    const handleUndoResetStudy = async () => {
        if (undoing) return;
        if (!resetBackup || resetBackup.type !== 'study') {
            setToast({ message: 'Không có dữ liệu để hoàn tác', type: 'error' });
            return;
        }
        const backupData = resetBackup.data;
        setUndoing(true);
        setToast({ message: 'Đang hoàn tác...', type: 'info' });
        try {
            await Promise.all(backupData.map(student => {
                const userRef = doc(db, 'users', student.uid);
                return updateDoc(userRef, { studyPoints: student.studyPoints });
            }));
            await fetchStudents();
            setResetBackup(null);
            setToast({ message: 'Đã hoàn tác reset điểm học tập thành công!', type: 'success' });
        } catch (error) {
            console.error('Error undoing reset:', error);
            setToast({ message: 'Lỗi khi hoàn tác: ' + error.message, type: 'error' });
        } finally {
            setUndoing(false);
        }
    };

    // ── Reset study points ──
    const handleResetStudyPoints = async () => {
        if (!selectedClassId) {
            setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
            return;
        }
        const selectedClass = classes.find(c => c.id === selectedClassId);
        if (!confirm(`Reset điểm học tập cho tất cả học sinh lớp ${selectedClass?.name}? `)) return;

        setResettingStudy(true);
        try {
            const backup = students.map(s => ({ uid: s.uid, studyPoints: s.studyPoints }));
            const studentUids = students.map(s => s.uid);
            const result = await resetStudyPoints(studentUids);

            if (result.success) {
                setResetBackup({ type: 'study', data: backup });
                setToast({ message: result.message, type: 'success', showUndo: true, onUndo: handleUndoResetStudy });
                setStudyPointsInputs({});
                fetchStudents();
            } else {
                setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
            }
        } catch (error) {
            console.error('Error resetting study points:', error);
            setToast({ message: 'Lỗi khi reset điểm học tập', type: 'error' });
        }
        setResettingStudy(false);
    };

    // ── Reset points/coins ──
    const handleReset = async () => {
        if (!selectedClassId) {
            setToast({ message: 'Vui lòng chọn lớp học', type: 'warning' });
            return;
        }
        const selectedClass = classes.find(c => c.id === selectedClassId);
        if (!confirm(`Reset điểm / xu cho tất cả học sinh lớp ${selectedClass?.name}?\n\nĐiểm tích lũy: ${resetValues.points} \nXu: ${resetValues.coins} `)) return;

        setResetting(true);
        const backup = students.map(s => ({
            uid: s.uid,
            totalBehaviorPoints: s.totalBehaviorPoints,
            coins: s.coins
        }));

        const result = await resetClassPointsAndCoins(
            selectedClassId,
            parseInt(resetValues.points) || 0,
            parseInt(resetValues.coins) || 0
        );
        setResetting(false);

        if (result.success) {
            setResetBackup({ type: 'points', data: backup });
            setToast({ message: result.message, type: 'success', showUndo: true, onUndo: handleUndoResetPoints });
            setShowResetModal(false);
            setResetValues({ points: 0, coins: 0 });
            fetchStudents();
        } else {
            setToast({ message: 'Lỗi: ' + result.error, type: 'error' });
        }
    };

    // ── Ripple ──
    const createRipple = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const newRipple = { x, y, id: Date.now() };
        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 1000);
    };

    return {
        // State
        pointsInputs, coinsInputs, studyPointsInputs,
        saving, showResetModal, setShowResetModal,
        resetValues, setResetValues,
        resetting, resettingStudy,
        showSortMenu, setShowSortMenu,
        sortBy,
        studentColors, setStudentColors,
        ripples,
        zoomedAvatarId, setZoomedAvatarId,
        zoomOrigin, setZoomOrigin,
        overviewMode, setOverviewMode,
        // Refs
        pointsInputRefs, coinsInputRefs, studyPointsInputRefs,
        // Functions
        getSortedStudents,
        handleSortChange,
        handlePointsChange, handleCoinsChange, handleStudyPointsChange,
        handlePointsKeyDown, handleCoinsKeyDown, handleStudyPointsKeyDown,
        handleColorChange, getNameColorClass,
        handleSaveSession,
        handleReset, handleResetStudyPoints,
        createRipple,
    };
}
