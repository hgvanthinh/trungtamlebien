import React from 'react';
import Icon from '../../components/common/Icon';

const PdfViewerWrapper = ({ url, title, layout = 'auto' }) => {
  const gviewUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  const showMobile = layout === 'mobile' || layout === 'auto';
  const showDesktop = layout === 'desktop' || layout === 'auto';

  return (
    <div className="relative w-full bg-gray-50 dark:bg-gray-800 flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Mobile Viewer (Google Docs) */}
      {showMobile && (
        <iframe
          src={gviewUrl}
          className={`w-full border-0 ${layout === 'auto' ? 'block lg:hidden h-[60vh] sm:h-[70vh]' : 'h-[60vh] sm:h-[70vh]'}`}
          title={`${title} - Mobile`}
        />
      )}

      {/* Desktop Viewer (Native) */}
      {showDesktop && (
        <iframe
          src={url}
          className={`w-full border-0 ${layout === 'auto' ? 'hidden lg:block h-[80vh]' : 'h-[80vh]'}`}
          title={title}
        />
      )}

      {/* Fallback open button below viewer */}
      <div className="p-3 bg-gray-100 dark:bg-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 font-medium text-center sm:text-left">
          Nếu màn hình trắng hoặc đề thi bị lỗi:
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium text-sm transition-colors hover:bg-blue-600 shadow-sm whitespace-nowrap"
        >
          <Icon name="open_in_new" className="text-sm" />
          Mở Đề Thi Trực Tiếp
        </a>
      </div>
    </div>
  );
};

export default PdfViewerWrapper;
