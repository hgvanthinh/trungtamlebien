/**
 * Barrel export for exam services.
 * Các file khác trong project chỉ cần import từ đây.
 *
 * Ví dụ: import { getExamById, submitExam } from '../../services/exam';
 */

// Exam CRUD - quản lý đề thi và câu hỏi
export * from './examCrudService';

// Exam Submissions - nộp bài, lưu kết quả
export * from './examSubmissionService';

// Mixed Exam - chấm bài hỗn hợp ABCD/Đúng-Sai/Trả lời ngắn
export * from './mixedExamService';
