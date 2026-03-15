import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllAssignments } from '../../services/assignmentService';
import { getAllClasses } from '../../services/classService';
import { getExamById } from '../../services/examBankService';
import Icon from '../../components/common/Icon';

const GradeStats = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loadingClass, setLoadingClass] = useState(false);
    const [showOverview, setShowOverview] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [classes, setClasses] = useState({});
    const [exams, setExams] = useState({});
    const [allSubmissions, setAllSubmissions] = useState([]);
    // Cache: classId -> submissions[], tránh fetch lại
    const submissionsCache = useState({})[0];

    // Filters
    const [filterClass, setFilterClass] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('all');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadSubmissionsForClass = async (classId, assignmentsList, classMap, examMap) => {
        // Return cache nếu đã có
        if (submissionsCache[classId]) return submissionsCache[classId];

        const assignmentsForClass = assignmentsList.filter(
            a => a.classId === classId
        );

        const results = [];
        await Promise.all(
            assignmentsForClass.map(async assignment => {
                const q = query(
                    collection(db, 'examSubmissions'),
                    where('assignmentId', '==', assignment.id)
                );
                const snapshot = await getDocs(q);
                const latestByStudent = {};
                snapshot.docs.forEach(docSnap => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (data.status === 'in_progress') return;
                    const uid = data.studentUid;
                    const time = data.submittedAt?.seconds || 0;
                    if (!latestByStudent[uid] || time > (latestByStudent[uid].submittedAt?.seconds || 0)) {
                        latestByStudent[uid] = data;
                    }
                });
                Object.values(latestByStudent).forEach(sub => {
                    results.push({
                        ...sub,
                        assignmentId: assignment.id,
                        classId: assignment.classId,
                        className: classMap[assignment.classId]?.name || 'N/A',
                        examId: assignment.examId,
                        deadline: assignment.deadline,
                    });
                });
            })
        );

        submissionsCache[classId] = results;
        return results;
    };

    const loadInitialData = async () => {
        setLoading(true);

        // Load classes + assignments song song
        const [classesResult, assignmentsResult] = await Promise.all([
            getAllClasses(),
            getAllAssignments(),
        ]);

        const classMap = {};
        if (classesResult.success) {
            classesResult.classes.forEach(cls => { classMap[cls.id] = cls; });
            setClasses(classMap);
        }

        let allAssignmentsList = [];
        if (assignmentsResult.success) {
            allAssignmentsList = assignmentsResult.assignments;

            // Load tất cả exam details song song (dedupe)
            const uniqueExamIds = [...new Set(allAssignmentsList.map(a => a.examId))];
            const examResults = await Promise.all(uniqueExamIds.map(id => getExamById(id)));
            const examMap = {};
            uniqueExamIds.forEach((examId, i) => {
                const res = examResults[i];
                if (res.success) {
                    examMap[examId] = res.exam;
                } else {
                    const fallback = allAssignmentsList.find(a => a.examId === examId);
                    examMap[examId] = {
                        title: fallback?.examTitle || 'Đề thi đã xóa',
                        type: fallback?.examType || 'upload',
                        deleted: true,
                    };
                }
            });
            setExams(examMap);
            setAssignments(allAssignmentsList);

            // Lấy lớp đầu tiên có bài làm default filter
            const validAssignments = allAssignmentsList.filter(a => !examMap[a.examId]?.deleted);
            const firstClassId = validAssignments.length > 0 ? validAssignments[0].classId : '';

            if (firstClassId) {
                setFilterClass(firstClassId);
                // Load submissions của lớp đầu tiên
                const subs = await loadSubmissionsForClass(firstClassId, allAssignmentsList, classMap, examMap);
                setAllSubmissions(subs);
            }
        }

        setLoading(false);
    };

    // Khi đổi filter lớp → load on-demand
    const handleFilterClassChange = async (newClassId) => {
        setFilterClass(newClassId);
        setFilterAssignment('all');

        if (!newClassId) return;

        // Kiểm tra cache
        if (submissionsCache[newClassId]) {
            setAllSubmissions(submissionsCache[newClassId]);
            return;
        }

        setLoadingClass(true);
        const subs = await loadSubmissionsForClass(newClassId, assignments, classes, exams);
        setAllSubmissions(subs);
        setLoadingClass(false);
    };

    // --- Derived filtered data ---
    const allValidAssignments = assignments.filter(a => {
        const exam = exams[a.examId];
        return !exam?.deleted;
    });

    // allSubmissions chỉ chứa data của lớp đang chọn → lọc thêm theo bài giao nếu cần
    const filteredSubmissions = allSubmissions.filter(sub => {
        return filterAssignment === 'all' || sub.assignmentId === filterAssignment;
    });

    // Assignments visible in filter — chỉ show bài của lớp đang chọn
    const visibleAssignments = filterClass
        ? allValidAssignments.filter(a => a.classId === filterClass)
        : allValidAssignments;

    // Stats calculation
    const gradedSubs = filteredSubmissions.filter(s => s.status === 'graded');
    const scores = gradedSubs.map(s => {
        const exam = exams[s.examId];
        if (exam?.type !== 'upload') {
            return ((s.totalScore || 0) / (s.maxScore || 1)) * 10;
        }
        return s.totalScore || 0;
    });

    const formatScore = (val) => {
        const num = parseFloat(val);
        return Number.isInteger(num) ? num : num.toFixed(2);
    };

    const avg = scores.length > 0 ? formatScore(scores.reduce((a, b) => a + b, 0) / scores.length) : '-';
    const maxScore = scores.length > 0 ? formatScore(Math.max(...scores)) : '-';
    const minScore = scores.length > 0 ? formatScore(Math.min(...scores)) : '-';

    // --- Overview chart data ---
    // 1. Score distribution: buckets 0-2, 2-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10
    const scoreBuckets = [
        { label: '0–2', min: 0, max: 2, color: '#ef4444' },
        { label: '2–4', min: 2, max: 4, color: '#f97316' },
        { label: '4–5', min: 4, max: 5, color: '#eab308' },
        { label: '5–6', min: 5, max: 6, color: '#84cc16' },
        { label: '6–7', min: 6, max: 7, color: '#22c55e' },
        { label: '7–8', min: 7, max: 8, color: '#10b981' },
        { label: '8–9', min: 8, max: 9, color: '#06b6d4' },
        { label: '9–10', min: 9, max: 10.01, color: '#6366f1' },
    ];
    const bucketCounts = scoreBuckets.map(b =>
        scores.filter(s => s >= b.min && s < b.max).length
    );
    const bucketMax = Math.max(...bucketCounts, 1);

    // 2. Graded vs pending donut
    const pendingSubs = filteredSubmissions.filter(s => s.status !== 'graded');
    const total = filteredSubmissions.length;
    const gradedPct = total > 0 ? (gradedSubs.length / total) * 100 : 0;
    // SVG donut: r=40, circumference~251
    const CIRC = 2 * Math.PI * 40;
    const gradedDash = (gradedPct / 100) * CIRC;

    // 3. Avg score per assignment (top 8)
    const assignmentAvgs = visibleAssignments.map(a => {
        const subs = gradedSubs.filter(s => s.assignmentId === a.id);
        const exam = exams[a.examId];
        const aScores = subs.map(s =>
            exam?.type !== 'upload' ? ((s.totalScore || 0) / (s.maxScore || 1)) * 10 : (s.totalScore || 0)
        );
        return {
            label: exam?.title || 'Bài thi',
            avg: aScores.length > 0 ? aScores.reduce((x, y) => x + y, 0) / aScores.length : null,
            count: subs.length,
        };
    }).filter(x => x.avg !== null).slice(0, 8);
    const assignmentAvgMax = Math.max(...assignmentAvgs.map(x => x.avg), 10);

    // Group by student for table
    // Each row = 1 submission, showing student + class + assignment + score + status
    const getDisplayScore = (sub) => {
        if (sub.status !== 'graded') return -1;
        const exam = exams[sub.examId];
        if (exam?.type !== 'upload') {
            return ((sub.totalScore || 0) / (sub.maxScore || 1)) * 10;
        }
        return sub.totalScore || 0;
    };

    const tableRows = [...filteredSubmissions].sort((a, b) => {
        const scoreDiff = getDisplayScore(b) - getDisplayScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        // Ngang điểm: nộp sớm hơn xếp trước
        return (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0);
    });

    if (loading) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                    <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/grade-submissions')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <Icon name="arrow_back" />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
                        Thống kê điểm bài tập
                    </h1>
                    <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
                        Xem lại điểm bài tập theo lớp và theo bài giao
                    </p>
                </div>
            </div>



            {/* Filters */}
            <div className="clay-card p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-1">
                            <Icon name="groups" className="inline mr-1 text-sm" />
                            Lọc theo lớp
                        </label>
                        <select
                            value={filterClass}
                            onChange={e => handleFilterClassChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {Object.values(classes).map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                        {loadingClass && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-500 dark:text-blue-400">
                                <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                Đang tải dữ liệu lớp...
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-1">
                            <Icon name="assignment" className="inline mr-1 text-sm" />
                            Lọc theo bài giao
                        </label>
                        <select
                            value={filterAssignment}
                            onChange={e => setFilterAssignment(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="all">Tất cả bài giao</option>
                            {visibleAssignments.map(a => {
                                const exam = exams[a.examId];
                                const cls = classes[a.classId];
                                return (
                                    <option key={a.id} value={a.id}>
                                        {exam?.title || 'Đề thi'} – Lớp {cls?.name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <button
                        onClick={() => { setFilterClass('all'); setFilterAssignment('all'); }}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-[#608a67] dark:text-[#8ba890] rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium flex items-center gap-1"
                    >
                        <Icon name="clear" className="text-sm" />
                        Xóa bộ lọc
                    </button>
                </div>
            </div>

            {/* Overview toggle */}
            <div className="clay-card overflow-hidden">
                <button
                    onClick={() => setShowOverview(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                    <span className="flex items-center gap-2 font-semibold text-[#111812] dark:text-white">
                        <Icon name="insights" className="text-primary" />
                        Tổng quan phân tích
                    </span>
                    <Icon
                        name={showOverview ? 'expand_less' : 'expand_more'}
                        className="text-[#608a67] dark:text-[#8ba890]"
                    />
                </button>

                {showOverview && (
                    <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
                        {scores.length === 0 ? (
                            <div className="py-8 text-center text-[#608a67] dark:text-[#8ba890] text-sm">
                                Chưa có bài đã chấm để hiển thị biểu đồ
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-5">

                                {/* Chart 1: Score distribution histogram */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#608a67] dark:text-[#8ba890] mb-3 flex items-center gap-1">
                                        <Icon name="bar_chart" className="text-sm" />
                                        Phân bố điểm
                                    </p>
                                    <div className="flex items-end gap-1.5 h-32">
                                        {scoreBuckets.map((b, i) => {
                                            const h = bucketCounts[i] > 0 ? Math.max((bucketCounts[i] / bucketMax) * 100, 6) : 0;
                                            return (
                                                <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                    {bucketCounts[i] > 0 && (
                                                        <span className="text-[10px] font-bold text-[#111812] dark:text-white">
                                                            {bucketCounts[i]}
                                                        </span>
                                                    )}
                                                    <div className="w-full relative" style={{ height: '96px' }}>
                                                        <div
                                                            className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                                                            style={{ height: `${h}%`, backgroundColor: b.color, opacity: bucketCounts[i] === 0 ? 0.15 : 1 }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-[#608a67] dark:text-[#8ba890] text-center leading-tight">{b.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {[
                                            { label: 'Yếu (<5)', color: '#ef4444', pct: scores.filter(s => s < 5).length },
                                            { label: 'TB (5–6.9)', color: '#eab308', pct: scores.filter(s => s >= 5 && s < 7).length },
                                            { label: 'Khá (7–8.4)', color: '#10b981', pct: scores.filter(s => s >= 7 && s < 8.5).length },
                                            { label: 'Giỏi (≥8.5)', color: '#6366f1', pct: scores.filter(s => s >= 8.5).length },
                                        ].map(l => (
                                            <span key={l.label} className="flex items-center gap-1 text-[10px] text-[#608a67] dark:text-[#8ba890]">
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                                                {l.label}: <b className="text-[#111812] dark:text-white">{l.pct}</b>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Chart 2: Graded vs pending donut */}
                                <div className="flex flex-col items-center">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#608a67] dark:text-[#8ba890] mb-3 flex items-center gap-1 self-start">
                                        <Icon name="donut_large" className="text-sm" />
                                        Tỉ lệ chấm bài
                                    </p>
                                    <div className="relative w-32 h-32">
                                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="14" className="dark:stroke-gray-700" />
                                            <circle
                                                cx="50" cy="50" r="40" fill="none"
                                                stroke="#22c55e" strokeWidth="14"
                                                strokeDasharray={`${gradedDash} ${CIRC}`}
                                                strokeLinecap="round"
                                                style={{ transition: 'stroke-dasharray 0.6s ease' }}
                                            />
                                            {pendingSubs.length > 0 && (
                                                <circle
                                                    cx="50" cy="50" r="40" fill="none"
                                                    stroke="#eab308" strokeWidth="14"
                                                    strokeDasharray={`${CIRC - gradedDash} ${CIRC}`}
                                                    strokeDashoffset={-gradedDash}
                                                    strokeLinecap="round"
                                                />
                                            )}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-xl font-bold text-[#111812] dark:text-white">
                                                {Math.round(gradedPct)}%
                                            </span>
                                            <span className="text-[10px] text-[#608a67] dark:text-[#8ba890]">đã chấm</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-4 text-xs text-[#608a67] dark:text-[#8ba890]">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                                            Đã chấm: <b className="text-[#111812] dark:text-white ml-0.5">{gradedSubs.length}</b>
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
                                            Chờ: <b className="text-[#111812] dark:text-white ml-0.5">{pendingSubs.length}</b>
                                        </span>
                                    </div>
                                </div>

                                {/* Chart 3: Avg score per assignment */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#608a67] dark:text-[#8ba890] mb-3 flex items-center gap-1">
                                        <Icon name="assignment_turned_in" className="text-sm" />
                                        Điểm TB theo bài giao
                                    </p>
                                    {assignmentAvgs.length === 0 ? (
                                        <p className="text-xs text-[#608a67] dark:text-[#8ba890] italic">Không có dữ liệu</p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {assignmentAvgs.map((a, i) => {
                                                const pct = (a.avg / assignmentAvgMax) * 100;
                                                const barColor = a.avg >= 8 ? '#6366f1' : a.avg >= 6.5 ? '#10b981' : a.avg >= 5 ? '#eab308' : '#ef4444';
                                                return (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-[11px] text-[#608a67] dark:text-[#8ba890] w-24 truncate shrink-0" title={a.label}>
                                                            {a.label}
                                                        </span>
                                                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1.5"
                                                                style={{ width: `${pct}%`, backgroundColor: barColor, minWidth: '28px' }}
                                                            >
                                                                <span className="text-[9px] font-bold text-white">{formatScore(a.avg)}</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] text-[#608a67] dark:text-[#8ba890] w-8 text-right shrink-0">
                                                            ({a.count})
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="clay-card p-4 text-center">
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Tổng bài nộp</p>
                    <p className="text-2xl font-bold text-[#111812] dark:text-white">{filteredSubmissions.length}</p>
                </div>
                <div className="clay-card p-4 text-center">
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Đã chấm</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{gradedSubs.length}</p>
                </div>
                <div className="clay-card p-4 text-center">
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Điểm TB</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{avg}</p>
                </div>
                <div className="clay-card p-4 text-center">
                    <p className="text-sm text-[#608a67] dark:text-[#8ba890] mb-1">Cao / Thấp nhất</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {maxScore} / {minScore}
                    </p>
                </div>
            </div>

            {/* Table */}
            {tableRows.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="bar_chart" className="text-6xl text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                        Không có dữ liệu
                    </h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        Chưa có bài nào được chấm với bộ lọc hiện tại
                    </p>
                </div>
            ) : (
                <div className="clay-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">STT</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Học sinh</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Lớp</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Bài tập</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Ngày nộp</th>
                                    <th className="text-center px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Trạng thái</th>
                                    <th className="text-center px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Điểm</th>
                                    <th className="text-center px-4 py-3 text-sm font-bold text-[#608a67] dark:text-[#8ba890]">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((sub, index) => {
                                    const exam = exams[sub.examId];
                                    return (
                                        <tr
                                            key={sub.id}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm text-[#608a67] dark:text-[#8ba890]">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-[#111812] dark:text-white">{sub.studentName}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                                                    {sub.className}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[#111812] dark:text-white max-w-[200px] truncate">
                                                {exam?.title || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[#608a67] dark:text-[#8ba890]">
                                                {sub.submittedAt
                                                    ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString('vi-VN')
                                                    : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${sub.status === 'graded'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                                        }`}
                                                >
                                                    {sub.status === 'graded' ? 'Đã chấm' : 'Chờ chấm'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className={`text-lg font-bold ${sub.status === 'graded'
                                                        ? 'text-primary'
                                                        : 'text-gray-400 dark:text-gray-600'
                                                        }`}
                                                >
                                                    {sub.status === 'graded'
                                                        ? (exam?.type !== 'upload' ? `${sub.totalScore || 0}/${sub.maxScore || 0}` : (sub.totalScore ?? '-'))
                                                        : '–'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {exam?.type === 'upload' ? (
                                                    <button
                                                        onClick={() => navigate(`/admin/grade-submissions/${sub.id}`)}
                                                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                                                    >
                                                        <Icon name="grading" className="inline mr-1 text-sm" />
                                                        {sub.status === 'graded' ? 'Xem lại' : 'Chấm'}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 text-[#608a67] dark:text-[#8ba890] rounded-lg">Tự động chấm</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GradeStats;
