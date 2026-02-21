import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';

/**
 * AnnotatedPDFViewer - Display annotated PDF pages for students
 * Shows the merged PDF+annotations images created by teachers
 */
const AnnotatedPDFViewer = ({ annotations, originalFileUrl, annotatedFileUrl, fileType }) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Priority 1: Show annotatedFileUrl if available (single merged image with all annotations)
  if (annotatedFileUrl) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Bài làm của bạn</h3>
        <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
          <img
            src={annotatedFileUrl}
            alt="Bài làm đã được chấm"
            className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
          />
          <div className="absolute top-6 right-6 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-full shadow-md border border-green-500">
            <span className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
              <Icon name="check_circle" className="text-sm" />
              Đã chấm
            </span>
          </div>
        </div>
        <div className="flex justify-center">
          <a
            href={originalFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Icon name="open_in_new" className="text-sm" />
            Xem bài gốc (không có ghi chú)
          </a>
        </div>
      </div>
    );
  }

  // Priority 2: Show annotations array if available (multiple pages)
  if (annotations && annotations.length > 0) {
    // Sort annotations by page number
    const sortedAnnotations = [...annotations].sort((a, b) => a.page - b.page);
    const totalPages = sortedAnnotations.length;
    const currentAnnotation = sortedAnnotations[currentPage - 1];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bài làm đã được chấm</h3>
          <div className="flex items-center gap-2">
            <Icon name="edit" className="text-primary" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {totalPages} trang có ghi chú
            </span>
          </div>
        </div>

        {/* Annotated Image Display */}
        <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
          <img
            src={currentAnnotation.imageUrl}
            alt={`Trang ${currentPage} với ghi chú của giáo viên`}
            className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
          />

          {/* Page indicator overlay */}
          <div className="absolute top-6 right-6 bg-white dark:bg-gray-900 px-3 py-1 rounded-full shadow-md">
            <span className="text-sm font-medium">
              Trang {currentPage} / {totalPages}
            </span>
          </div>
        </div>

        {/* Navigation Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <Icon name="arrow_back" className="mr-1" />
              Trang trước
            </Button>

            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Trang {currentPage} / {totalPages}
            </span>

            <Button
              variant="secondary"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Trang sau
              <Icon name="arrow_forward" className="ml-1" />
            </Button>
          </div>
        )}

        {/* View original file link */}
        <div className="flex justify-center">
          <a
            href={originalFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Icon name="open_in_new" className="text-sm" />
            Xem bài gốc (không có ghi chú)
          </a>
        </div>
      </div>
    );
  }

  // Priority 3: Show original file if no annotations
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Bài làm của bạn</h3>
      {fileType === 'pdf' ? (
        <iframe
          src={originalFileUrl}
          className="w-full h-[600px] rounded-xl border border-gray-200 dark:border-gray-700"
          title="Student Submission"
        />
      ) : (
        <img
          src={originalFileUrl}
          alt="Student Submission"
          className="max-w-full h-auto rounded-xl border border-gray-200 dark:border-gray-700"
        />
      )}
    </div>
  );
};

export default AnnotatedPDFViewer;

