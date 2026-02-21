import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import * as XLSX from 'xlsx';

const Attendance = () => {
    const [classes, setClasses] = useState([]);
    const [selectedScope, setSelectedScope] = useState('class'); // 'class', 'grade', 'all'
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // {studentId: {date: 'P'|'K'|''}}
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [daysInMonth, setDaysInMonth] = useState([]);

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            calculateDaysInMonth();
        }
    }, [selectedMonth]);

    useEffect(() => {
        if (selectedScope === 'class' && selectedClass) {
            loadStudentsByClass();
        } else if (selectedScope === 'grade' && selectedGrade) {
            loadStudentsByGrade();
        } else if (selectedScope === 'all') {
            loadAllStudents();
        }
    }, [selectedScope, selectedClass, selectedGrade]);

    // Hàm sắp xếp lớp theo ABC (6A, 6B, 7A, 7B,...)
    const sortClassesAlphabetically = (classList) => {
        return [...classList].sort((a, b) => {
            const extractParts = (name) => {
                const match = name.match(/^(\d+)([A-Za-z])/);
                if (match) {
                    return { grade: parseInt(match[1], 10), letter: match[2].toUpperCase() };
                }
                return { grade: 999, letter: name };
            };

            const partA = extractParts(a.name);
            const partB = extractParts(b.name);

            if (partA.grade !== partB.grade) {
                return partA.grade - partB.grade;
            }
            return partA.letter.localeCompare(partB.letter, 'vi');
        });
    };

    const loadClasses = async () => {
        try {
            const classesRef = collection(db, 'classes');
            const snapshot = await getDocs(classesRef);
            const classesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClasses(sortClassesAlphabetically(classesData));
        } catch (error) {
            console.error('Error loading classes:', error);
        }
    };

    const calculateDaysInMonth = () => {
        const [year, month] = selectedMonth.split('-');
        const daysCount = new Date(year, month, 0).getDate();
        const days = Array.from({ length: daysCount }, (_, i) => i + 1);
        setDaysInMonth(days);
    };

    const loadStudentsByClass = async () => {
        setIsLoading(true);
        try {
            const classDoc = await getDoc(doc(db, 'classes', selectedClass));
            if (classDoc.exists()) {
                const classData = classDoc.data();
                const studentIds = classData.students || [];
                await loadStudentsByIds(studentIds);
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
        setIsLoading(false);
    };

    const loadStudentsByGrade = async () => {
        setIsLoading(true);
        try {
            const classesInGrade = classes.filter(c => c.grade === parseInt(selectedGrade));
            const allStudentIds = new Set();

            for (const cls of classesInGrade) {
                const students = cls.students || [];
                students.forEach(id => allStudentIds.add(id));
            }

            await loadStudentsByIds(Array.from(allStudentIds));
        } catch (error) {
            console.error('Error loading students:', error);
        }
        setIsLoading(false);
    };

    const loadAllStudents = async () => {
        setIsLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'student'));
            const snapshot = await getDocs(q);
            const studentsData = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            }));
            setStudents(studentsData);
            await loadAttendanceData(studentsData.map(s => s.uid));
        } catch (error) {
            console.error('Error loading students:', error);
        }
        setIsLoading(false);
    };

    const loadStudentsByIds = async (studentIds) => {
        if (studentIds.length === 0) {
            setStudents([]);
            return;
        }

        const studentsData = [];
        for (const uid of studentIds) {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                studentsData.push({
                    uid: userDoc.id,
                    ...userDoc.data()
                });
            }
        }
        setStudents(studentsData);
        await loadAttendanceData(studentIds);
    };

    const loadAttendanceData = async (studentIds) => {
        try {
            const attendanceData = {};

            for (const studentId of studentIds) {
                const attendanceDoc = await getDoc(
                    doc(db, 'attendance', `${studentId}_${selectedMonth}`)
                );

                if (attendanceDoc.exists()) {
                    attendanceData[studentId] = attendanceDoc.data().days || {};
                } else {
                    attendanceData[studentId] = {};
                }
            }

            setAttendance(attendanceData);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    };

    const handleAttendanceChange = (studentId, day, value) => {
        // Validate input: chỉ cho phép '', 'P', 'p', 'K', 'k'
        const upperValue = value.toUpperCase();
        if (value !== '' && upperValue !== 'P' && upperValue !== 'K') {
            return; // Không cho phép giá trị khác
        }

        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [day]: upperValue
            }
        }));
    };

    const saveAttendance = async () => {
        setIsLoading(true);
        try {
            for (const studentId of Object.keys(attendance)) {
                await setDoc(
                    doc(db, 'attendance', `${studentId}_${selectedMonth}`),
                    {
                        studentId,
                        month: selectedMonth,
                        days: attendance[studentId],
                        updatedAt: new Date().toISOString()
                    }
                );
            }

            setToast({ type: 'success', message: 'Đã lưu điểm danh thành công!' });
        } catch (error) {
            console.error('Error saving attendance:', error);
            setToast({ type: 'error', message: 'Lỗi khi lưu điểm danh!' });
        }
        setIsLoading(false);
    };

    const exportToExcel = () => {
        // Tạo data cho Excel
        const data = students.map(student => {
            const row = {
                'Họ tên': student.fullName,
            };

            daysInMonth.forEach(day => {
                const value = attendance[student.uid]?.[day] || '';
                row[`Ngày ${day}`] = value;
            });

            // Tính tổng
            const studentAttendance = attendance[student.uid] || {};
            const totalP = Object.values(studentAttendance).filter(v => v === 'P').length;
            const totalK = Object.values(studentAttendance).filter(v => v === 'K').length;
            const totalPresent = daysInMonth.length - totalP - totalK;

            row['Có mặt'] = totalPresent;
            row['Nghỉ phép'] = totalP;
            row['Nghỉ không phép'] = totalK;

            return row;
        });

        // Tạo worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Điểm danh');

        // Tạo tên file
        const scopeName = selectedScope === 'class'
            ? classes.find(c => c.id === selectedClass)?.name
            : selectedScope === 'grade'
                ? `Khối ${selectedGrade}`
                : 'Toàn trung tâm';

        const fileName = `Diem_danh_${scopeName}_${selectedMonth}.xlsx`;

        // Download
        XLSX.writeFile(wb, fileName);

        setToast({ type: 'success', message: 'Đã xuất Excel thành công!' });
    };

    const grades = [...new Set(classes.map(c => c.grade))].sort();

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
                    Điểm danh
                </h1>
                <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
                    Quản lý điểm danh học sinh theo tháng
                </p>
            </div>

            {/* Filters */}
            <div className="clay-card p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Phạm vi */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Phạm vi
                        </label>
                        <select
                            value={selectedScope}
                            onChange={(e) => {
                                setSelectedScope(e.target.value);
                                setSelectedClass('');
                                setSelectedGrade('');
                                setStudents([]);
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="class">Theo lớp</option>
                            <option value="grade">Theo khối</option>
                            <option value="all">Toàn trung tâm</option>
                        </select>
                    </div>

                    {/* Lớp (nếu chọn theo lớp) */}
                    {selectedScope === 'class' && (
                        <div>
                            <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                                Lớp học
                            </label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Chọn lớp</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name} (Khối {cls.grade})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Khối (nếu chọn theo khối) */}
                    {selectedScope === 'grade' && (
                        <div>
                            <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                                Khối
                            </label>
                            <select
                                value={selectedGrade}
                                onChange={(e) => setSelectedGrade(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Chọn khối</option>
                                {grades.map(grade => (
                                    <option key={grade} value={grade}>
                                        Khối {grade}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Tháng */}
                    <div>
                        <label className="block text-sm font-medium text-[#111812] dark:text-white mb-2">
                            Tháng
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={saveAttendance}
                            disabled={isLoading || students.length === 0}
                            className="flex-1 px-4 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Icon name="save" />
                            Lưu
                        </button>
                        <button
                            onClick={exportToExcel}
                            disabled={students.length === 0}
                            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Icon name="download" />
                            Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                    <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
                </div>
            ) : students.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="event_busy" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                        Chưa có học sinh
                    </h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        Vui lòng chọn lớp/khối để bắt đầu điểm danh
                    </p>
                </div>
            ) : (
                <div className="clay-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#f0f5f1] dark:bg-white/5 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#111812] dark:text-white sticky left-0 bg-[#f0f5f1] dark:bg-white/5 z-10">
                                        Học sinh
                                    </th>
                                    {daysInMonth.map(day => (
                                        <th key={day} className="px-2 py-3 text-center text-sm font-bold text-[#111812] dark:text-white min-w-[50px]">
                                            {day}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-center text-sm font-bold text-[#111812] dark:text-white">
                                        Tổng
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#d0e5d4] dark:divide-white/10">
                                {students.map(student => {
                                    const studentAttendance = attendance[student.uid] || {};
                                    const totalP = Object.values(studentAttendance).filter(v => v === 'P').length;
                                    const totalK = Object.values(studentAttendance).filter(v => v === 'K').length;
                                    const totalPresent = daysInMonth.length - totalP - totalK;

                                    return (
                                        <tr key={student.uid} className="hover:bg-[#f0f5f1] dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 sticky left-0 bg-white dark:bg-[#111812] z-10">
                                                <div>
                                                    <p className="font-bold text-[#111812] dark:text-white">
                                                        {student.fullName}
                                                    </p>
                                                    <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                                                        @{student.username}
                                                    </p>
                                                </div>
                                            </td>
                                            {daysInMonth.map(day => (
                                                <td key={day} className="px-2 py-3">
                                                    <input
                                                        type="text"
                                                        maxLength={1}
                                                        value={studentAttendance[day] || ''}
                                                        onChange={(e) => handleAttendanceChange(student.uid, day, e.target.value)}
                                                        className="w-full text-center px-2 py-1 rounded border border-[#d0e5d4] dark:border-white/20 bg-white dark:bg-white/5 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            ))}
                                            <td className="px-4 py-3">
                                                <div className="text-center text-sm">
                                                    <div className="text-green-600 dark:text-green-400 font-bold">
                                                        ✓ {totalPresent}
                                                    </div>
                                                    {totalP > 0 && (
                                                        <div className="text-yellow-600 dark:text-yellow-400">
                                                            P {totalP}
                                                        </div>
                                                    )}
                                                    {totalK > 0 && (
                                                        <div className="text-red-600 dark:text-red-400">
                                                            K {totalK}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="p-4 bg-[#f0f5f1] dark:bg-white/5 border-t border-[#d0e5d4] dark:border-white/10">
                        <p className="text-sm text-[#608a67] dark:text-[#8ba890]">
                            <strong>Hướng dẫn:</strong> Để trống = Có mặt | P = Nghỉ có phép | K = Nghỉ không phép
                        </p>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default Attendance;
