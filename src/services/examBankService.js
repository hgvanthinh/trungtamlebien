/**
 * examBankService.js — Backward-compatible re-export
 *
 * File này vẫn giữ nguyên đường dẫn để không phá vỡ các import hiện có.
 * Tất cả logic đã được tách thành các module nhỏ trong thư mục ./exam/
 *
 * Nếu thêm mới, hãy viết vào file phù hợp trong src/services/exam/ thay vì file này.
 */
export * from './exam/examCrudService';
export * from './exam/examSubmissionService';
export * from './exam/mixedExamService';
