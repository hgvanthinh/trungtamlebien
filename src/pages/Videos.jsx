import { useState, useEffect } from 'react';
import { getAllVideos } from '../services/videoService';
import { getStudentClasses } from '../services/classService';
import { useAuth } from '../contexts/AuthContext';
import VideoCard from '../components/video/VideoCard';
import Icon from '../components/common/Icon';

const Videos = () => {
    const { userProfile } = useAuth();
    const [videos, setVideos] = useState([]);
    const [filteredVideos, setFilteredVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterGrade, setFilterGrade] = useState('');
    const [studentGrades, setStudentGrades] = useState([]);
    const [gradesLoaded, setGradesLoaded] = useState(false);

    useEffect(() => {
        loadData();
    }, [userProfile]);

    useEffect(() => {
        applyFilters();
    }, [filterGrade, videos, studentGrades, gradesLoaded]);

    const loadData = async () => {
        setLoading(true);
        setGradesLoaded(false);

        // Load videos
        const videoResult = await getAllVideos();
        if (videoResult.success) {
            setVideos(videoResult.videos);
            console.log('📹 Loaded videos:', videoResult.videos.length);
            console.log('📹 Video grades:', videoResult.videos.map(v => ({ title: v.title, grade: v.grade, type: typeof v.grade })));
        }

        // Load student's grades from their classes
        if (userProfile?.classes && userProfile.classes.length > 0) {
            console.log('👤 Student classes:', userProfile.classes);
            const classesResult = await getStudentClasses(userProfile.classes);
            if (classesResult.success) {
                // Convert grades to numbers to match video grades
                const grades = [...new Set(classesResult.classes.map(c => parseInt(c.grade)))];
                setStudentGrades(grades);
                console.log('📚 Student grades:', grades);
            } else {
                console.error('❌ Error loading classes:', classesResult.error);
                setStudentGrades([]);
            }
        } else {
            console.log('⚠️ No classes assigned to student');
            setStudentGrades([]);
        }

        setGradesLoaded(true);
        setLoading(false);
    };

    const applyFilters = () => {
        // Don't filter until grades are loaded
        if (!gradesLoaded) {
            return;
        }

        let filtered = videos;

        // Filter by student's grades (only show videos for their grade levels)
        if (studentGrades.length > 0) {
            // Show videos that match student's grade OR have grade=null (all grades)
            filtered = filtered.filter(v => v.grade === null || studentGrades.includes(v.grade));
            console.log(`🔍 Filtered by grades [${studentGrades}] + all grades:`, filtered.length, 'videos');
        } else {
            // Student has no classes assigned, only show videos with grade=null
            filtered = filtered.filter(v => v.grade === null);
            console.log('⚠️ No student grades, showing only "all grades" videos:', filtered.length, 'videos');
        }

        // Apply manual grade filter if selected
        if (filterGrade !== '') {
            filtered = filtered.filter(v => v.grade === parseInt(filterGrade));
            console.log(`🔍 Filtered by selected grade ${filterGrade}:`, filtered.length, 'videos');
        }

        setFilteredVideos(filtered);
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                    <p className="mt-4 text-[#608a67] dark:text-[#8ba890]">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[#111812] dark:text-white">
                    Kho video
                </h1>
                <p className="text-[#608a67] dark:text-[#8ba890] mt-1">
                    Video học tập từ thầy cô
                </p>
            </div>

            {/* Filter */}
            <div className="flex gap-3 items-center">
                {studentGrades.length > 1 && (
                    <select
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-[#d0e5d4] dark:border-white/20 rounded-xl text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Tất cả khối</option>
                        {studentGrades.sort().map(grade => (
                            <option key={grade} value={grade}>Khối {grade}</option>
                        ))}
                    </select>
                )}

                <div className="ml-auto text-sm text-[#608a67] dark:text-[#8ba890]">
                    {filteredVideos.length} video
                </div>
            </div>

            {/* Videos Grid */}
            {filteredVideos.length === 0 ? (
                <div className="clay-card p-12 text-center">
                    <Icon name="video_library" className="text-6xl text-[#608a67] dark:text-[#8ba890] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
                        {filterGrade ? 'Không có video cho khối này' : 'Chưa có video'}
                    </h3>
                    <p className="text-[#608a67] dark:text-[#8ba890]">
                        {filterGrade ? 'Thử chọn khối khác' : 'Thầy cô chưa thêm video nào'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredVideos.map((video) => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            isAdmin={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Videos;
