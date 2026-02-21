import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getExamById } from '../../services/examBankService';
import Icon from '../../components/common/Icon';
import Toast from '../../components/common/Toast';
import PDFAnnotator from '../../components/exam/PDFAnnotator';

const GradeSubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // For multi-image navigation

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const loadSubmission = async () => {
    try {
      setLoading(true);

      // Load submission
      const submissionRef = doc(db, 'examSubmissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);

      if (!submissionSnap.exists()) {
        setToast({ type: 'error', message: 'Không tìm thấy bài nộp' });
        setLoading(false);
        return;
      }

      const submissionData = { id: submissionSnap.id, ...submissionSnap.data() };
      setSubmission(submissionData);

      // Load exam details
      const examResult = await getExamById(submissionData.examId);
      if (examResult.success) {
        setExam(examResult.exam);
      }

      // Set existing score and feedback
      if (submissionData.totalScore !== undefined) {
        setScore(submissionData.totalScore.toString());
      }
      if (submissionData.feedback) {
        setFeedback(submissionData.feedback);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading submission:', error);
      setToast({ type: 'error', message: 'Lỗi khi tải bài nộp' });
      setLoading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!score || isNaN(parseFloat(score))) {
      setToast({ type: 'error', message: 'Vui lòng nhập điểm hợp lệ' });
      return;
    }

    try {
      setSaving(true);

      const submissionRef = doc(db, 'examSubmissions', submissionId);
      await updateDoc(submissionRef, {
        totalScore: parseFloat(score),
        feedback: feedback,
        status: 'graded',
        gradedAt: serverTimestamp(),
      });

      setToast({ type: 'success', message: 'Đã lưu điểm thành công!' });
      setTimeout(() => {
        navigate('/admin/grade-submissions');
      }, 1500);
    } catch (error) {
      console.error('Error saving grade:', error);
      setToast({ type: 'error', message: 'Lỗi khi lưu điểm' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnnotation = async (annotationData) => {
    try {
      const submissionRef = doc(db, 'examSubmissions', submissionId);
      const hasMultipleFiles = submission.files && submission.files.length > 0;

      if (hasMultipleFiles) {
        // Bài nhiều ảnh: lưu vào annotations[] dựa theo page
        const imageUrl = typeof annotationData === 'string' ? annotationData : annotationData.imageUrl;
        const page = (typeof annotationData === 'object' && annotationData.page) || 1;

        // Merge với annotations cũ (thay thế trang nếu đã có)
        const existingAnnotations = submission.annotations || [];
        const filtered = existingAnnotations.filter(a => a.page !== page);
        const newAnnotations = [...filtered, { page, imageUrl }]
          .sort((a, b) => a.page - b.page);

        await updateDoc(submissionRef, {
          annotations: newAnnotations,
          updatedAt: serverTimestamp(),
        });

        setSubmission(prev => ({
          ...prev,
          annotations: newAnnotations,
        }));
      } else {
        // Bài 1 file: lưu vào annotatedFileUrl
        const imageUrl = typeof annotationData === 'string' ? annotationData : annotationData.imageUrl;

        await updateDoc(submissionRef, {
          annotatedFileUrl: imageUrl,
          updatedAt: serverTimestamp(),
        });

        setSubmission(prev => ({
          ...prev,
          annotatedFileUrl: imageUrl,
        }));
      }

      setShowAnnotator(false);
      setToast({ type: 'success', message: 'Đã lưu ghi chú!' });
    } catch (error) {
      console.error('Error saving annotation:', error);
      setToast({ type: 'error', message: 'Lỗi khi lưu ghi chú' });
    }
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

  if (!submission) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="clay-card p-12 text-center">
          <Icon name="error" className="text-6xl text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#111812] dark:text-white mb-2">
            Không tìm thấy bài nộp
          </h3>
          <button
            onClick={() => navigate('/admin/grade-submissions')}
            className="mt-4 px-6 py-2 bg-primary text-[#052e16] rounded-xl font-bold"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Show PDFAnnotator
  if (showAnnotator) {
    // Nếu nhiều file, pass array of URLs; nếu 1 file thì dùng single URL
    const fileUrls = submission.files && submission.files.length > 0
      ? submission.files.map(f => f.fileUrl)
      : [submission.fileUrl];

    // existingAnnotations: mảng { page, imageUrl } để PDFAnnotator load ghi chú cũ
    const existingAnnotations = submission.annotations || [];

    return (
      <PDFAnnotator
        pdfUrl={fileUrls[0]}
        fileUrls={fileUrls}
        fileType={submission.fileType || 'pdf'}
        onSaveAnnotation={handleSaveAnnotation}
        onClose={() => setShowAnnotator(false)}
        existingAnnotations={existingAnnotations}
      />
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
          <h1 className="text-2xl font-bold text-[#111812] dark:text-white">
            Chấm bài: {exam?.title}
          </h1>
          <p className="text-[#608a67] dark:text-[#8ba890]">
            Học sinh: {submission.studentName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - File preview */}
        <div className="lg:col-span-2">
          <div className="clay-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#111812] dark:text-white">Bài làm của học sinh</h3>
              <button
                onClick={() => setShowAnnotator(true)}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center gap-2"
              >
                <Icon name="edit" />
                Ghi chú trên bài
              </button>
            </div>

            {/* File preview */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 min-h-[400px]">
              {submission.files && Array.isArray(submission.files) && submission.files.length > 0 ? (
                // Multiple images - Show one at a time with navigation
                <div className="space-y-4">
                  {/* Header with navigation + badge gửi chú */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#111812] dark:text-white">
                        Ảnh {currentImageIndex + 1} / {submission.files.length}
                      </p>
                      {/* Hiển thị badge nếu ảnh này đã có ghi chú */}
                      {submission.annotations?.some(a => a.page === currentImageIndex + 1) && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center gap-1">
                          <Icon name="draw" className="text-xs" />
                          Có ghi chú
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentImageIndex === 0}
                        className="p-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Ảnh trước"
                      >
                        <Icon name="chevron_left" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(prev => Math.min(submission.files.length - 1, prev + 1))}
                        disabled={currentImageIndex === submission.files.length - 1}
                        className="p-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Ảnh sau"
                      >
                        <Icon name="chevron_right" />
                      </button>
                    </div>
                  </div>

                  {/* Current image - ưu tiên dùng ảnh đã ghi chú nếu có */}
                  {(() => {
                    const pageNum = currentImageIndex + 1;
                    const annotation = submission.annotations?.find(a => a.page === pageNum);
                    const displayUrl = annotation ? annotation.imageUrl : submission.files[currentImageIndex].fileUrl;
                    const isAnnotated = !!annotation;
                    return (
                      <div className={`bg-white dark:bg-gray-900 rounded-lg p-3 border-2 ${isAnnotated ? 'border-blue-400 dark:border-blue-500' : 'border-gray-200 dark:border-gray-700'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name={isAnnotated ? 'draw' : 'image'} className={`text-sm ${isAnnotated ? 'text-blue-500' : 'text-primary'}`} />
                          <p className="text-xs font-medium text-[#608a67] dark:text-[#8ba890]">
                            {isAnnotated ? 'Bài đã ghi chú (trang ' + pageNum + ')' : submission.files[currentImageIndex].fileName}
                          </p>
                        </div>
                        <img
                          src={displayUrl}
                          alt={`Bài làm ${currentImageIndex + 1}`}
                          className="w-full rounded-lg"
                        />
                      </div>
                    );
                  })()}

                  {/* Thumbnail navigation */}
                  {submission.files.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {submission.files.map((file, index) => {
                        const pageNum = index + 1;
                        const annotation = submission.annotations?.find(a => a.page === pageNum);
                        const thumbUrl = annotation ? annotation.imageUrl : file.fileUrl;
                        return (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex
                                ? 'border-primary shadow-lg'
                                : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                              }`}
                          >
                            <img
                              src={thumbUrl}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {annotation && (
                              <div className="w-full bg-blue-500 text-white text-[9px] text-center py-0.5">
                                Đã GC
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : submission.fileUrl ? (
                // Single file (legacy support)
                <div className="flex items-center justify-center">
                  {submission.fileType === 'image' ? (
                    <img
                      src={submission.annotatedFileUrl || submission.fileUrl}
                      alt="Bài làm"
                      className="max-w-full max-h-[600px] object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <Icon name="picture_as_pdf" className="text-6xl text-red-500 mb-4" />
                      <p className="text-[#608a67] dark:text-[#8ba890] mb-4">File PDF</p>
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-primary text-[#052e16] rounded-lg font-medium inline-flex items-center gap-2"
                      >
                        <Icon name="open_in_new" />
                        Mở file PDF
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <p className="text-[#608a67] dark:text-[#8ba890]">Không có file</p>
                </div>
              )}
            </div>

            {/* Show annotated version if exists (for single file legacy) */}
            {!submission.files && submission.annotatedFileUrl && submission.annotatedFileUrl !== submission.fileUrl && (
              <div className="mt-4">
                <h4 className="font-medium text-[#111812] dark:text-white mb-2">Bài đã ghi chú:</h4>
                <img
                  src={submission.annotatedFileUrl}
                  alt="Bài đã ghi chú"
                  className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right - Grading form */}
        <div className="space-y-4">
          {/* Submission info */}
          <div className="clay-card p-4">
            <h3 className="font-bold text-[#111812] dark:text-white mb-3">Thông tin bài nộp</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#608a67] dark:text-[#8ba890]">Ngày nộp:</span>
                <span className="font-medium text-[#111812] dark:text-white">
                  {submission.submittedAt
                    ? new Date(submission.submittedAt.seconds * 1000).toLocaleString('vi-VN')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#608a67] dark:text-[#8ba890]">Trạng thái:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${submission.status === 'graded'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                    }`}
                >
                  {submission.status === 'graded' ? 'Đã chấm' : 'Chờ chấm'}
                </span>
              </div>
            </div>
          </div>

          {/* Grading form */}
          <div className="clay-card p-4">
            <h3 className="font-bold text-[#111812] dark:text-white mb-3">Chấm điểm</h3>

            <div className="space-y-4">
              {/* Score input */}
              <div>
                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-1">
                  Điểm số
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="0"
                    min="0"
                    max={submission.maxScore || 10}
                    step="0.5"
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[#608a67] dark:text-[#8ba890]">
                    / {submission.maxScore || 10}
                  </span>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium text-[#111812] dark:text-white mb-1">
                  Nhận xét
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Nhập nhận xét cho học sinh..."
                  rows={4}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111812] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Submit button */}
              <button
                onClick={handleSaveGrade}
                disabled={saving}
                className="w-full px-6 py-3 bg-primary text-[#052e16] rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#052e16] border-t-transparent"></div>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" />
                    Lưu điểm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default GradeSubmissionDetail;
