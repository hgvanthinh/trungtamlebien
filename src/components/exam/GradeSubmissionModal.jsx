import { useState } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import PDFAnnotator from './PDFAnnotator';

const GradeSubmissionModal = ({ submission, exam, onClose, onGradeComplete }) => {
  const [manualScore, setManualScore] = useState(submission.manualGradedScore || 0);
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving, setSaving] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [annotations, setAnnotations] = useState(submission.annotations || []);

  const isUploadType = exam?.type === 'upload';
  const hasFile = submission.fileUrl;

  // Calculate total score
  const autoScore = submission.autoGradedScore || 0;
  const totalScore = autoScore + manualScore;
  const maxScore = submission.maxScore || exam?.totalPoints || 100;

  const handleSaveAnnotation = async (annotationData) => {
    // Add or update annotation for this page
    const existingIndex = annotations.findIndex((a) => a.page === annotationData.page);
    let newAnnotations;

    if (existingIndex >= 0) {
      // Update existing
      newAnnotations = [...annotations];
      newAnnotations[existingIndex] = annotationData;
    } else {
      // Add new
      newAnnotations = [...annotations, annotationData];
    }

    setAnnotations(newAnnotations);
  };

  const handleSave = async () => {
    setSaving(true);

    const gradeData = {
      manualGradedScore: parseFloat(manualScore) || 0,
      totalScore: parseFloat(totalScore) || 0,
      maxScore: parseFloat(maxScore) || 0,
      feedback: feedback.trim(),
      status: 'graded',
      gradedAt: new Date(),
      annotations: annotations, // Save all annotations
    };

    await onGradeComplete(submission.id, gradeData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Icon name="grading" className="text-primary text-2xl" />
            <div>
              <h2 className="text-xl font-bold">{exam?.title}</h2>
              <p className="text-sm text-gray-500">
                Học sinh: <span className="font-medium text-gray-700 dark:text-gray-300">{submission.studentName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
          >
            <Icon name="close" className="text-2xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: PDF Viewer or Answers (2/3) */}
          <div className="flex-1 p-6 overflow-auto">
            {isUploadType && hasFile ? (
              <div className="h-full flex flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Bài làm của học sinh</h3>
                  <div className="flex gap-2">
                    {/* Show annotation button for all upload types (PDF and images) */}
                    <Button
                      variant="primary"
                      onClick={() => setShowAnnotator(true)}
                      className="text-sm"
                    >
                      <Icon name="edit" className="mr-1" />
                      Ghi chú lên bài ({annotations.length})
                    </Button>
                    <a
                      href={submission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Icon name="open_in_new" className="text-sm" />
                      Mở trong tab mới
                    </a>
                  </div>
                </div>
                {submission.fileType === 'pdf' ? (
                  <iframe
                    src={submission.fileUrl}
                    className="flex-1 w-full rounded-xl border border-gray-200 dark:border-gray-700"
                    title="Student Submission"
                  />
                ) : (
                  <img
                    src={submission.fileUrl}
                    alt="Student Submission"
                    className="max-w-full h-auto rounded-xl border border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Câu trả lời của học sinh</h3>
                {submission.answers && Object.keys(submission.answers).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(submission.answers).map(([questionId, answer], index) => (
                      <div key={questionId} className="clay-input p-4 rounded-xl">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">Câu {index + 1}</h4>
                          {answer.isCorrect !== undefined && (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                answer.isCorrect
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                              }`}
                            >
                              {answer.isCorrect ? '✓ Đúng' : '✗ Sai'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm">
                          {answer.selected !== undefined && (
                            <p>
                              <span className="text-gray-500">Đáp án:</span>{' '}
                              <span className="font-medium">{answer.selected}</span>
                            </p>
                          )}
                          {answer.text && (
                            <p>
                              <span className="text-gray-500">Trả lời:</span>{' '}
                              <span className="font-medium">{answer.text}</span>
                            </p>
                          )}
                          {answer.latex && (
                            <p>
                              <span className="text-gray-500">Công thức:</span>{' '}
                              <span className="font-mono text-sm">{answer.latex}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Icon name="pending" className="text-4xl mb-2" />
                    <p>Học sinh chưa trả lời câu hỏi nào</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Grading Panel (1/3) */}
          <div className="w-[400px] border-l border-gray-200 dark:border-gray-800 p-6 overflow-auto flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Chấm điểm</h3>

            {/* Score Summary */}
            <div className="mb-6 space-y-3">
              {/* Auto Score (if exists) */}
              {autoScore > 0 && (
                <div className="flex justify-between items-center clay-input p-3 rounded-xl">
                  <span className="text-sm font-medium">Điểm tự động:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {autoScore}
                  </span>
                </div>
              )}

              {/* Manual Score Input */}
              <div className="clay-input p-4 rounded-xl">
                <label className="block text-sm font-medium mb-2">
                  Điểm chấm tay {isUploadType && '(cho bài upload)'}:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={manualScore}
                    onChange={(e) => setManualScore(parseFloat(e.target.value) || 0)}
                    min="0"
                    max={maxScore - autoScore}
                    step="0.5"
                    className="flex-1 clay-input px-4 py-2 rounded-xl text-center font-bold text-lg"
                  />
                  <span className="text-gray-500">/ {maxScore - autoScore}</span>
                </div>
              </div>

              {/* Total Score */}
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tổng điểm:</span>
                  <span className="text-2xl font-bold text-primary">
                    {totalScore}/{maxScore}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(totalScore / maxScore) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Nhận xét của giáo viên:
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Viết nhận xét cho học sinh..."
                rows={6}
                className="w-full clay-input px-4 py-3 rounded-xl resize-none"
              />
            </div>

            {/* Submission Info */}
            <div className="mb-6 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                <Icon name="schedule" className="inline mr-1" />
                Nộp lúc:{' '}
                {submission.submittedAt
                  ? new Date(submission.submittedAt.seconds * 1000).toLocaleString('vi-VN')
                  : 'N/A'}
              </p>
              {submission.duration && (
                <p>
                  <Icon name="timer" className="inline mr-1" />
                  Thời gian làm bài: {Math.floor(submission.duration / 60)} phút
                </p>
              )}
              {submission.fileType && (
                <p>
                  <Icon name="picture_as_pdf" className="inline mr-1" />
                  Loại file: {submission.fileType.toUpperCase()}
                </p>
              )}
              {submission.compressionRatio && (
                <p>
                  <Icon name="compress" className="inline mr-1" />
                  Đã nén: {submission.compressionRatio}%
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-auto space-y-3">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Icon name="sync" className="mr-2 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Icon name="save" className="mr-2" />
                    Lưu điểm
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={onClose} className="w-full">
                <Icon name="close" className="mr-2" />
                Đóng
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Annotator Modal */}
      {showAnnotator && (
        <PDFAnnotator
          pdfUrl={submission.fileUrl}
          fileType={submission.fileType}
          onSaveAnnotation={handleSaveAnnotation}
          onClose={() => setShowAnnotator(false)}
          existingAnnotations={annotations}
        />
      )}
    </div>
  );
};

export default GradeSubmissionModal;
