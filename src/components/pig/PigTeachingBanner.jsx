import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAssignmentsForStudent } from '../../services/assignmentService';

/**
 * Banner thông báo "Giờ dạy heo học" — hiện khi có đề isPigTeaching đang trong khung giờ mở.
 * Fetch 1 lần khi mount, re-check theo đồng hồ mỗi 30s (không re-query).
 */
export default function PigTeachingBanner() {
    const { userProfile } = useAuth();
    const location = useLocation();
    const [assignments, setAssignments] = useState([]);
    const [now, setNow] = useState(0);
    const [dismissed, setDismissed] = useState({});

    const classesKey = JSON.stringify(userProfile?.classes || []);

    useEffect(() => {
        if (userProfile?.role !== 'student' || !userProfile?.classes?.length) return;
        getAssignmentsForStudent(userProfile.classes)
            .then(result => {
                if (result.success) {
                    setAssignments(result.assignments.filter(a => a.isPigTeaching));
                }
            })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.role, classesKey]);

    useEffect(() => {
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    if (userProfile?.role !== 'student' || now === 0) return null;
    // Không hiện banner khi đang làm bài
    if (location.pathname.startsWith('/exam/')) return null;

    const active = assignments.filter(a => {
        if (dismissed[a.id]) return false;
        const start = a.startTime?.toDate ? a.startTime.toDate().getTime() : 0;
        const end = a.deadline?.toDate ? a.deadline.toDate().getTime() : 0;
        return start <= now && now <= end;
    });

    if (active.length === 0) return null;

    return (
        <div className="space-y-2 mb-4">
            {active.map(a => {
                const end = a.deadline.toDate();
                return (
                    <div
                        key={a.id}
                        className="flex items-center gap-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-2xl px-4 py-3 shadow-lg animate-pulse"
                    >
                        <span className="text-2xl">🐷</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-extrabold">Giờ dạy heo học!</p>
                            <p className="text-sm truncate">
                                Đề «{a.examTitle}» mở đến{' '}
                                {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — làm bài để heo nhận XP!
                            </p>
                        </div>
                        <Link
                            to={`/exam/${a.examId}?assignmentId=${a.id}`}
                            className="bg-white text-orange-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-50 whitespace-nowrap"
                        >
                            Vào làm ngay
                        </Link>
                        <button
                            onClick={() => setDismissed(prev => ({ ...prev, [a.id]: true }))}
                            className="text-white/80 hover:text-white font-bold px-1"
                            title="Ẩn thông báo"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
