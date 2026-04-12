// src/pages/admin/Teaching.jsx
// ─── Main Teaching Component ── Refactored ────────────────────

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllClasses as getClasses, getClassStudents as getStudentsByClassIdAndRole } from '../../services/classService';
import { getGradeLeaderboard, getCenterLeaderboard } from '../../services/leaderboardService';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import Avatar from '../../components/common/Avatar';


// Import subcomponents and hooks
import { useTeachingHandlers } from './Teaching/useTeachingHandlers';
import { SortMenu } from './Teaching/TeachingSubComponents';
import { Leaderboard } from './Teaching/Leaderboard';

// Import images
import rippleGif from '../../assets/ranks/ripple.gif';
import rankBgImg from '../../assets/ranks/rank-bg.gif';

const Teaching = () => {
    const { currentUser, userProfile } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState(userProfile?.classes?.[0] || '');
    const [students, setStudents] = useState([]);
    const [gradeLeaderboard, setGradeLeaderboard] = useState([]);
    const [centerLeaderboard, setCenterLeaderboard] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Initial data fetch
    useEffect(() => {
        const loadInitialData = async () => {
            const classesResult = await getClasses();
            if (classesResult.success) {
                // Filter classes that the user is part of, unless they are admin/co_admin
                const availableClasses = (userProfile.role === 'admin' || userProfile.role === 'co_admin')
                    ? classesResult.classes
                    : classesResult.classes.filter(c => userProfile.classes?.includes(c.id));

                // Sort classes
                const sortedClasses = availableClasses.sort((a, b) => {
                    const gradeA = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
                    const gradeB = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
                    if (gradeA !== gradeB) return gradeA - gradeB;
                    return a.name.localeCompare(b.name);
                });

                setClasses(sortedClasses);

                if (sortedClasses.length > 0 && !selectedClassId) {
                    setSelectedClassId(sortedClasses[0].id);
                }
            }
        };
        if (userProfile) loadInitialData();
    }, [userProfile]);

    const fetchStudents = async () => {
        if (!selectedClassId) return;
        setLoading(true);
        const selectedClass = classes.find(c => c.id === selectedClassId);
        const gradeNum = selectedClass
            ? (selectedClass.grade || parseInt(selectedClass.name.match(/\d+/)?.[0] || '0', 10))
            : 0;

        const [result, gradeResult, centerResult] = await Promise.all([
            getStudentsByClassIdAndRole(selectedClassId),
            getGradeLeaderboard(gradeNum),
            getCenterLeaderboard()
        ]);

        if (result.success) {
            setStudents(result.students);
            const initialColors = {};
            result.students.forEach(s => { initialColors[s.uid] = s.activeLabelColor || null; });
            setStudentColors(initialColors);
        }
        if (gradeResult.success) setGradeLeaderboard(gradeResult.leaderboard);
        if (centerResult.success) setCenterLeaderboard(centerResult.leaderboard);
        setLoading(false);
    };

    useEffect(() => { fetchStudents(); }, [selectedClassId]);

    const getStudentRank = (studentUid, leaderboard) => {
        const index = leaderboard.findIndex(s => s.uid === studentUid);
        return index !== -1 ? index + 1 : '-';
    };

    // ─── INIT HOOK ─────────────────────────────────────────────
    const handlers = useTeachingHandlers({
        students, selectedClassId, classes, fetchStudents, setToast
    });
    
    // Destructure everything we need to render from hook
    const {
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
        pointsInputRefs, coinsInputRefs, studyPointsInputRefs,
        getSortedStudents, handleSortChange,
        handlePointsChange, handleCoinsChange, handleStudyPointsChange,
        handlePointsKeyDown, handleCoinsKeyDown, handleStudyPointsKeyDown,
        handleColorChange, getNameColorClass,
        handleSaveSession, handleReset, handleResetStudyPoints,
        createRipple
    } = handlers;


    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Lớp học Label */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Icon name="school" className="text-[#608a67] dark:text-[#8ba890] text-3xl" />
                        <h1 className="text-2xl md:text-3xl font-black text-[#111812] dark:text-white uppercase tracking-wider">
                            LỚP
                        </h1>
                    </div>

                    {/* Class Selector Dropdown */}
                    <div className="relative flex-1 min-w-[200px] max-w-[250px]">
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="appearance-none w-full bg-white dark:bg-gray-800 border-2 border-[#d0e5d4] dark:border-gray-700 text-[#111812] dark:text-white text-lg font-bold rounded-xl py-2 pl-4 pr-10 hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all cursor-pointer shadow-sm"
                        >
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <Icon name="expand_more" className="text-xl" />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* View Toggle */}
                    <button
                        onClick={() => setOverviewMode(!overviewMode)}
                        className={`hidden md:flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${overviewMode
                                ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-800/40' // Đang bật
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' // Đang tắt
                            }`}
                        title={overviewMode ? "Tắt chế độ tổng quan" : "Bật chế độ tổng quan"}
                    >
                        <Icon name={overviewMode ? 'view_list' : 'grid_view'} />
                        {overviewMode ? 'Chi tiết' : 'Tổng quan'}
                    </button>

                    <div className="relative">
                        <Button
                            variant="secondary"
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="w-full md:w-auto"
                        >
                            <Icon name="sort" className="mr-2" />
                            {sortBy === 'points' ? 'Điểm hành vi'
                                : sortBy === 'coins' ? 'Vàng'
                                    : 'Tên'}
                        </Button>
                        <SortMenu showSortMenu={showSortMenu} setShowSortMenu={setShowSortMenu} sortBy={sortBy} handleSortChange={handleSortChange} />
                    </div>

                    <Button variant="danger" onClick={() => setShowResetModal(true)} disabled={loading} className="flex-1 md:flex-none whitespace-nowrap">
                        <Icon name="restart_alt" className="mr-2" /> Reset
                    </Button>

                    <Button variant="warning" onClick={handleResetStudyPoints} disabled={loading || resettingStudy} className="flex-1 md:flex-none whitespace-nowrap">
                        <Icon name="device_reset" className="mr-2" /> {resettingStudy ? 'Đang...' : 'Reset Học tập'}
                    </Button>

                    <Button variant="primary" onClick={handleSaveSession} disabled={saving || loading} className="flex-1 md:flex-none relative overflow-hidden group min-w-[120px]">
                        <span className="relative z-10 flex items-center justify-center">
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div> Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Icon name="save" className="mr-2" /> Lưu
                                </>
                            )}
                        </span>
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="clay-card p-4 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                    <div className="flex-1">
                                        <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
                                        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="lg:col-span-4 hidden lg:block">
                        <div className="clay-card p-6 h-[600px] animate-pulse">
                            <div className="h-8 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-md mx-auto mb-6"></div>
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                        <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
                    {/* Left Panel - Student List */}
                    <div className={overviewMode ? 'lg:col-span-12' : 'lg:col-span-8'}>
                        {/* Student Cards */}
                        {overviewMode ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-max">
                                {getSortedStudents.map((student, index) => (
                                    <div key={student.uid} className="clay-card p-2 flex items-center gap-2 min-w-0">
                                        <span className="text-[#608a67] dark:text-[#8ba890] font-bold text-xs w-5 flex-shrink-0">{index + 1}.</span>
                                        <div
                                            className="w-15 h-15 flex-shrink-0 cursor-pointer"
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setZoomOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                                                setZoomedAvatarId(zoomedAvatarId === student.uid ? null : student.uid);
                                            }}
                                        >
                                            <Avatar src={student.avatar} name={student.fullName} size="sm" borderUrl={student.activeAvatarBorder} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[#111812] dark:text-white text-xs break-words">{student.fullName}</div>
                                            <div className="flex items-center gap-1.5 text-[14px]">
                                                <span className="text-fuchsia-800 dark:text-fuchsia-500 font-bold">
                                                    {student.studyPoints == null || student.studyPoints === 'Vắng' || typeof student.studyPoints !== 'number' ? (student.studyPoints === 'Vắng' ? 'Vắng' : '') : student.studyPoints.toFixed(2) + ' điểm'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {getSortedStudents.map((student, index) => (
                                    <div key={student.uid} className="clay-card p-4 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            {/* Color Radio Buttons */}
                                            <div className="flex-shrink-0 grid grid-cols-2 gap-1.5 mr-2">
                                                <button type="button" onClick={() => handleColorChange(student.uid, 'black')}
                                                    className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'black' ? 'bg-gray-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]' : 'bg-gradient-to-b from-gray-700 to-gray-900 shadow-[0_1.5px_0_#374151,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#374151,0_1px_1px_rgba(0,0,0,0.3)]'}`} title="Đen" />
                                                <button type="button" onClick={() => handleColorChange(student.uid, 'blue')}
                                                    className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'blue' ? 'bg-blue-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]' : 'bg-gradient-to-b from-blue-500 to-blue-700 shadow-[0_1.5px_0_#1d4ed8,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#1d4ed8,0_1px_1px_rgba(0,0,0,0.3)]'}`} title="Xanh lam" />
                                                <button type="button" onClick={() => handleColorChange(student.uid, 'green')}
                                                    className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'green' ? 'bg-green-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]' : 'bg-gradient-to-b from-green-500 to-green-700 shadow-[0_1.5px_0_#15803d,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#15803d,0_1px_1px_rgba(0,0,0,0.3)]'}`} title="Xanh lá" />
                                                <button type="button" onClick={() => handleColorChange(student.uid, 'red')}
                                                    className={`w-3 h-3 rounded-full transition-all duration-150 ${studentColors[student.uid] === 'red' ? 'bg-red-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] translate-y-[1px]' : 'bg-gradient-to-b from-red-500 to-red-700 shadow-[0_1.5px_0_#b91c1c,0_2px_2px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:shadow-[0_0.5px_0_#b91c1c,0_1px_1px_rgba(0,0,0,0.3)]'}`} title="Đỏ" />
                                            </div>

                                            {/* Avatar */}
                                            <div className="flex-shrink-0 cursor-pointer"
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setZoomOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                                                    setZoomedAvatarId(zoomedAvatarId === student.uid ? null : student.uid);
                                                }}
                                            >
                                                <Avatar src={student.avatar} name={student.fullName} size="lg" borderUrl={student.activeAvatarBorder} border={true} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-xl font-black truncate ${getNameColorClass(student.uid)}`}>
                                                    <span className="text-[#608a67] dark:text-[#8ba890] mr-2">{index + 1}.</span>
                                                    {student.fullName}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1 text-base">
                                                    <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(220, 38, 38, 0.5)' }}>
                                                        <Icon name="emoji_events" className="text-sm" /> {getStudentRank(student.uid, gradeLeaderboard)}/{getStudentRank(student.uid, centerLeaderboard)}
                                                    </span>
                                                    <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(202, 138, 4, 0.5)' }}>
                                                        <Icon name="paid" className="text-sm" /> <span>{student.coins || 0}<span className="text-amber-500 dark:text-amber-400">/{student.gold || 0}</span></span>
                                                    </span>
                                                    <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(22, 163, 74, 0.5)' }}>
                                                        <Icon name="star" className="text-sm" /> {student.totalBehaviorPoints || 0}
                                                    </span>
                                                    <span className="text-fuchsia-800 dark:text-fuchsia-500 font-bold flex items-center gap-1" style={{ textShadow: '0 0 8px rgba(37, 99, 235, 0.5)' }}>
                                                        <div className="transform scale-75 origin-center flex items-center"><Icon name="bolt" /></div>
                                                        {student.studyPoints == null || student.studyPoints === 'Vắng' || typeof student.studyPoints !== 'number' ? (student.studyPoints === 'Vắng' ? 'Vắng' : '') : student.studyPoints.toFixed(2) + ' điểm'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Input fields */}
                                            <div className="flex gap-2">
                                                <input ref={(el) => pointsInputRefs.current[student.uid] = el}
                                                    type="number" placeholder="Điểm" value={pointsInputs[student.uid] || ''}
                                                    onChange={(e) => handlePointsChange(student.uid, e.target.value)}
                                                    onKeyDown={(e) => handlePointsKeyDown(e, student.uid)}
                                                    className="w-22 px-3 py-2 rounded-lg border-2 border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500" />
                                                <input ref={(el) => coinsInputRefs.current[student.uid] = el}
                                                    type="number" placeholder="Xu" value={coinsInputs[student.uid] || ''}
                                                    onChange={(e) => handleCoinsChange(student.uid, e.target.value)}
                                                    onKeyDown={(e) => handleCoinsKeyDown(e, student.uid)}
                                                    className="w-18 px-3 py-2 rounded-lg border-2 border-yellow-300 dark:border-yellow-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                                                <input ref={(el) => studyPointsInputRefs.current[student.uid] = el}
                                                    type="text" placeholder="Học tập" value={studyPointsInputs[student.uid] || ''}
                                                    onChange={(e) => handleStudyPointsChange(student.uid, e.target.value)}
                                                    onKeyDown={(e) => handleStudyPointsKeyDown(e, student.uid)}
                                                    className="w-22 px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-700/50 bg-white dark:bg-white/5 text-[#111812] dark:text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Leaderboard */}
                    {!overviewMode && (
                        <div className="lg:col-span-4" onClick={createRipple}>
                            <Leaderboard students={students} ripples={ripples} rippleGif={rippleGif} rankBgImg={rankBgImg} />
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!loading && selectedClassId && students.length === 0 && (
                <div className="clay-card p-12 text-center">
                    <Icon name="person_off" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">Lớp này chưa có học sinh</h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">Vui lòng thêm học sinh vào lớp trước</p>
                </div>
            )}

            {/* Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="clay-card max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[#111812] dark:text-white">Reset điểm/xu cho lớp</h2>
                            <button onClick={() => setShowResetModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors" disabled={resetting}>
                                <Icon name="close" className="text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-[#608a67] dark:text-[#8ba890]">Nhập giá trị mới cho điểm tích lũy và xu. Tất cả học sinh trong lớp sẽ được reset về giá trị này.</p>
                            <div>
                                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">Điểm tích lũy</label>
                                <input type="number" value={resetValues.points} onChange={(e) => setResetValues({ ...resetValues, points: e.target.value })} className="clay-input w-full px-4 py-3 rounded-xl" placeholder="Nhập điểm tích lũy..." disabled={resetting} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">Xu</label>
                                <input type="number" value={resetValues.coins} onChange={(e) => setResetValues({ ...resetValues, coins: e.target.value })} className="clay-input w-full px-4 py-3 rounded-xl" placeholder="Nhập số xu..." disabled={resetting} />
                            </div>
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-xl">
                                <p className="text-orange-600 dark:text-orange-400 text-sm flex items-center gap-2">
                                    <Icon name="warning" className="text-lg" />
                                    <span>Hành động này sẽ reset điểm/xu của TẤT CẢ học sinh trong lớp!</span>
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowResetModal(false)} disabled={resetting} className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-[#111812] dark:text-white rounded-xl font-medium hover:bg-gray-300 transition-all">Hủy</button>
                                <button onClick={handleReset} disabled={resetting} className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                    {resetting ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div><span>Đang reset...</span></> : <><Icon name="restart_alt" /><span>Reset ngay</span></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Avatar Zoom Modal */}
            {zoomedAvatarId && (() => {
                const zoomedStudent = students.find(s => s.uid === zoomedAvatarId);
                if (!zoomedStudent) return null;
                return (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] pointer-events-none" style={{ animation: 'fadeIn 0.25s ease' }}>
                        <style>{`
                            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                            @keyframes zoomFromOrigin {
                                from { transform: translate(var(--ox), var(--oy)) scale(0.1); opacity: 0; }
                                to   { transform: translate(0, 0) scale(1); opacity: 1; }
                            }
                        `}</style>
                        <div className="avatar-zoom-modal flex flex-col items-center gap-6"
                            style={{
                                animation: 'zoomFromOrigin 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                '--ox': `${zoomOrigin.x - window.innerWidth / 2}px`,
                                '--oy': `${zoomOrigin.y - window.innerHeight / 2}px`,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Avatar src={zoomedStudent.avatar} name={zoomedStudent.fullName} size="xl" borderUrl={zoomedStudent.activeAvatarBorder} border={true} className="!size-100" />
                            <span className="text-white text-2xl font-bold drop-shadow-lg text-center">{zoomedStudent.fullName}</span>
                        </div>
                    </div>
                );
            })()}

            {toast && <Toast message={toast.message} type={toast.type} showUndo={toast.showUndo} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Teaching;