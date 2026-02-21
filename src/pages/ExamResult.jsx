import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getExamById } from '../services/examBankService';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import Card from '../components/common/Card';
import AnnotatedPDFViewer from '../components/exam/AnnotatedPDFViewer';

const ExamResult = () => {
  const { examId, submissionId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [examId, submissionId]);

  const loadData = async () => {
    setLoading(true);

    // Load exam
    const examResult = await getExamById(examId);
    if (examResult.success) {
      setExam(examResult.exam);
    }

    // Load submission
    const submissionRef = doc(db, 'examSubmissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);
    if (submissionDoc.exists()) {
      setSubmission({ id: submissionDoc.id, ...submissionDoc.data() });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Đang tải kết quả...</p>
      </div>
    );
  }

  if (!exam || !submission) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Không tìm thấy kết quả</p>
      </div>
    );
  }

  const isUploadType = exam.type === 'upload';
  const scorePercentage = submission.maxScore > 0
    ? (submission.totalScore / submission.maxScore) * 100
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kết quả bài thi</h1>
        <Button variant="secondary" onClick={() => navigate('/exams')}>
          Quay lại
        </Button>
      </div>

      {/* Score Card */}
      <Card className="mb-6">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">{exam.title}</h2>

          {/* Điểm số + Phần trăm */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Điểm số</p>
              <p className="text-5xl font-bold text-primary">
                {submission.totalScore}/{submission.maxScore}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Phần trăm</p>
              <p
                className="text-5xl font-bold"
                style={{ color: scorePercentage >= 50 ? '#10b981' : '#ef4444' }}
              >
                {scorePercentage.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="h-4 rounded-full transition-all"
              style={{
                width: `${scorePercentage}%`,
                backgroundColor: scorePercentage >= 50 ? '#10b981' : '#ef4444',
              }}
            />
          </div>

          {/* Nhãn kết quả */}
          <p className="text-center mt-3 text-sm font-medium" style={{ color: scorePercentage >= 50 ? '#10b981' : '#ef4444' }}>
            {scorePercentage >= 80
              ? '🎉 Xuất sắc!'
              : scorePercentage >= 65
                ? '👍 Khá tốt!'
                : scorePercentage >= 50
                  ? '✅ Đạt yêu cầu'
                  : '❌ Chưa đạt'}
          </p>
        </div>
      </Card>

      {/* Upload type: trạng thái chấm + nhận xét GV + ảnh ghi chú */}
      {isUploadType && (
        <div className="space-y-4">
          {/* Trạng thái */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Icon
                name={submission.status === 'graded' ? 'check_circle' : 'pending'}
                className={`text-2xl ${submission.status === 'graded' ? 'text-green-500' : 'text-yellow-500'}`}
              />
              <div>
                <p className="font-semibold">
                  {submission.status === 'graded' ? 'Bài đã được chấm' : 'Đang chờ chấm bài'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nộp lúc:{' '}
                  {submission.submittedAt
                    ? new Date(submission.submittedAt.seconds * 1000).toLocaleString('vi-VN')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </Card>

          {/* Nhận xét của giáo viên */}
          {submission.feedback && (
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <Icon name="comment" className="text-primary text-2xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Nhận xét của giáo viên</h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {submission.feedback}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Ảnh bài làm có ghi chú của GV - chỉ hiện khi GV đã ghi chú */}
          {(submission.annotatedFileUrl || (submission.annotations && submission.annotations.length > 0)) && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="draw" className="text-primary" />
                <h3 className="font-semibold">Bài làm có ghi chú của giáo viên</h3>
              </div>
              <AnnotatedPDFViewer
                annotations={submission.annotations}
                originalFileUrl={submission.fileUrl}
                annotatedFileUrl={submission.annotatedFileUrl}
                fileType={submission.fileType}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamResult;
