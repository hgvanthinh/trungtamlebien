import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import PdfViewerWrapper from './PdfViewerWrapper';
import StudentSubmissionUpload from '../../components/exam/StudentSubmissionUpload';

const UploadExamForm = ({
  exam,
  examId,
  currentUser,
  showUploadModal,
  setShowUploadModal,
  handleUploadComplete
}) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{exam.title}</h1>
        <Button
          variant="secondary"
          onClick={() => navigate('/exams')}
          className="sm:w-auto w-full"
        >
          <Icon name="arrow_back" className="mr-2" />
          Quay lại
        </Button>
      </div>

      {/* Description */}
      {exam.description && (
        <div className="mb-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">{exam.description}</p>
        </div>
      )}

      {/* Mobile: PDF View + Floating Button */}
      <div className="lg:hidden pb-20">
        {/* PDF/Image Viewer - Full Width */}
        <div className="clay-input p-3 rounded-2xl mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="description" className="text-primary text-lg" />
            <h2 className="font-semibold text-sm">Đề thi</h2>
          </div>
          {exam.fileType === 'pdf' ? (
            <PdfViewerWrapper url={exam.fileUrl} title={exam.title} layout="mobile" />
          ) : (
            <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
          )}
        </div>

        {/* Floating Upload Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-transform"
        >
          <Icon name="upload" className="text-3xl" />
        </button>

        {/* Upload Modal - Fullscreen on Mobile */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white dark:bg-gray-900 w-full max-h-[90vh] overflow-y-auto rounded-t-3xl shadow-2xl animate-slide-up">
              <div className="p-4">
                <StudentSubmissionUpload
                  examId={examId}
                  studentUid={currentUser?.uid}
                  onUploadComplete={handleUploadComplete}
                  onCancel={() => setShowUploadModal(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Side-by-Side Layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        {/* Left: Exam View (PDF/Image) */}
        <div className="lg:col-span-2">
          <div className="clay-input p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="description" className="text-primary" />
              <h2 className="font-semibold">Đề thi</h2>
            </div>
            {exam.fileType === 'pdf' ? (
              <PdfViewerWrapper url={exam.fileUrl} title={exam.title} layout="desktop" />
            ) : (
              <img src={exam.fileUrl} alt={exam.title} className="w-full rounded-xl" />
            )}
          </div>
        </div>

        {/* Right: Submission Form */}
        <div className="lg:col-span-1">
          <div className="clay-input p-6 rounded-2xl sticky top-4">
            <StudentSubmissionUpload
              examId={examId}
              studentUid={currentUser?.uid}
              onUploadComplete={handleUploadComplete}
              onCancel={() => navigate('/exams')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadExamForm;
