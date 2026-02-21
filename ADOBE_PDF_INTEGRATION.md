# Adobe PDF Embed API Integration

## Tổng quan

Tích hợp Adobe PDF Embed API vào hệ thống chấm bài, cho phép giáo viên:
- Xem PDF của học sinh trực tiếp trên trình duyệt
- Ghi chú (annotation) trực tiếp lên PDF
- Lưu annotations và hiển thị lại khi xem lại bài

## Adobe Client ID

**Client ID đã cấu hình**: `6d00cf316c434514abf9651aa34239c4`

Client ID này được sử dụng trong component `AdobePDFViewer.jsx`.

## Cấu trúc Components

### 1. AdobePDFViewer.jsx
**Đường dẫn**: `src/components/exam/AdobePDFViewer.jsx`

**Props**:
- `pdfUrl` (string, required): URL của file PDF
- `fileName` (string, optional): Tên file PDF (default: 'document.pdf')
- `enableAnnotations` (boolean, optional): Bật/tắt công cụ annotation (default: true)
- `onAnnotationChange` (function, optional): Callback khi annotations thay đổi
- `savedAnnotations` (object, optional): Annotations đã lưu trước đó

**Features**:
- Auto-load Adobe DC View SDK
- Embed mode: SIZED_CONTAINER (tự động điều chỉnh kích thước)
- Annotation tools: highlight, comment, draw, stamp, etc.
- Real-time annotation tracking
- Save/load annotations

**Example**:
```jsx
<AdobePDFViewer
  pdfUrl="https://example.com/submission.pdf"
  fileName="submission.pdf"
  enableAnnotations={true}
  onAnnotationChange={(annotations) => {
    console.log('Annotations changed:', annotations);
  }}
  savedAnnotations={previousAnnotations}
/>
```

### 2. GradeSubmissionModal.jsx
**Đường dẫn**: `src/components/exam/GradeSubmissionModal.jsx`

Modal chấm điểm với PDF viewer tích hợp.

**Props**:
- `submission` (object, required): Dữ liệu bài nộp của học sinh
- `exam` (object, required): Dữ liệu đề thi
- `onClose` (function, required): Callback khi đóng modal
- `onGradeComplete` (function, required): Callback khi lưu điểm

**Layout**:
- Left panel (2/3): PDF viewer với annotation tools
- Right panel (1/3): Grading panel
  - Auto-graded score (if exists)
  - Manual score input
  - Total score calculation
  - Feedback textarea
  - Save button

**Features**:
- Display PDF with annotations
- Save annotations to Firestore
- Calculate total score (auto + manual)
- Add teacher feedback
- Show submission metadata (time, duration, file info)

### 3. GradeSubmissions.jsx
**Đường dẫn**: `src/pages/admin/GradeSubmissions.jsx`

Trang quản lý danh sách bài nộp cho admin.

**Features**:
- List all submissions grouped by exam
- Filter by status: All / Chờ chấm / Đã chấm
- Filter by type: All / Upload / Trắc nghiệm
- Show submission details (student name, time, score, status)
- Open GradeSubmissionModal for grading

## Database Schema

### examSubmissions Collection

Các field mới được thêm:

```javascript
{
  // ... existing fields
  pdfAnnotations: {
    // Adobe PDF Embed API annotations format
    // Saved when teacher adds annotations
  },
  manualGradedScore: 0,     // Score from teacher manual grading
  autoGradedScore: 0,       // Score from auto-grading (multiple choice)
  totalScore: 0,            // Sum of manual + auto
  maxScore: 100,            // Maximum possible score
  feedback: "",             // Teacher's feedback
  status: "submitted",      // "submitted" | "graded"
  gradedAt: Timestamp,      // When grading completed
}
```

## Services

### examBankService.js

**New functions**:

1. `getAllSubmissions()`
   - Lấy tất cả submissions (cho admin)
   - Sắp xếp theo submittedAt (newest first)
   - Returns: `{ success: boolean, submissions: array }`

2. `updateSubmissionGrade(submissionId, gradeData)`
   - Cập nhật điểm và feedback cho submission
   - gradeData includes: manualGradedScore, totalScore, maxScore, feedback, status, pdfAnnotations, gradedAt
   - Returns: `{ success: boolean }`

## Routes

### Admin Routes (added to App.jsx)

```jsx
<Route path="/admin/grade-submissions" element={<GradeSubmissions />} />
```

### Sidebar Menu

Menu item mới cho admin:
```javascript
{ path: '/admin/grade-submissions', icon: 'grading', label: 'Chấm bài' }
```

## Usage Flow

### 1. Student submits PDF
Student uploads PDF via StudentSubmissionUpload component:
- File gets compressed
- Upload to Firebase Storage
- Create submission document in Firestore

### 2. Teacher opens grading page
Admin navigates to `/admin/grade-submissions`:
- See all submissions grouped by exam
- Filter by status/type
- Click "Chấm điểm" button

### 3. Teacher grades submission
GradeSubmissionModal opens:
- PDF loads with Adobe PDF Embed API
- Teacher uses annotation tools to mark PDF
- Enter manual score
- Add feedback
- Click "Lưu điểm"

### 4. Save grading
Data saved to Firestore:
- pdfAnnotations: Annotation data from Adobe API
- manualGradedScore: Score from teacher
- totalScore: Calculated total
- feedback: Teacher's comments
- status: Changed to "graded"

### 5. Student views result
Student sees graded submission:
- View total score
- View teacher feedback
- View annotated PDF (if viewing feature added)

## Adobe PDF Embed API Documentation

### Key Configuration Options

```javascript
{
  embedMode: 'SIZED_CONTAINER',      // Auto-resize to container
  showDownloadPDF: false,            // Hide download button
  showPrintPDF: true,                // Show print button
  showLeftHandPanel: true,           // Show thumbnails/bookmarks
  showAnnotationTools: true,         // Show annotation toolbar
  enableAnnotationAPIs: true,        // Enable annotation APIs
  includePDFAnnotations: true,       // Include existing annotations
}
```

### Annotation Events

```javascript
// Listen for annotation changes
annotationManager.registerEventListener(
  (event) => {
    // Handle event
  },
  {
    listenOn: [
      'ANNOTATION_ADDED',
      'ANNOTATION_UPDATED',
      'ANNOTATION_DELETED',
    ],
  }
);
```

### Get All Annotations

```javascript
annotationManager.getAnnotations().then((annotations) => {
  console.log('Current annotations:', annotations);
});
```

### Add Saved Annotations

```javascript
annotationManager.addAnnotations(savedAnnotations).then(() => {
  console.log('Loaded saved annotations');
});
```

## Important Notes

### Client ID
- Current Client ID: `6d00cf316c434514abf9651aa34239c4`
- This is a production credential
- Do NOT expose in public repositories
- Consider moving to environment variable

### PDF CORS
- PDF files must be hosted on CORS-enabled server
- Firebase Storage automatically handles CORS
- If using external PDFs, ensure CORS headers are set

### Browser Compatibility
- Adobe PDF Embed works on modern browsers
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers supported (iOS Safari, Chrome Android)

### Performance
- Adobe SDK is loaded dynamically (~500KB)
- First load may take 2-3 seconds
- Subsequent loads are faster (browser cache)

### Limitations
- Max PDF file size: No explicit limit from Adobe
- Recommended: Keep PDFs under 50MB for best performance
- Annotation data size: Depends on complexity

## Troubleshooting

### PDF not loading
1. Check PDF URL is accessible
2. Check CORS headers
3. Check Adobe Client ID is valid
4. Check browser console for errors

### Annotations not saving
1. Check `onAnnotationChange` callback is defined
2. Check Firestore write permissions
3. Check annotation data structure
4. Check network tab for failed requests

### Script loading error
1. Check internet connection
2. Check Adobe servers are accessible
3. Check script URL: `https://acrobatservices.adobe.com/view-sdk/viewer.js`
4. Try clearing browser cache

## Future Enhancements

1. **Student view annotations**: Allow students to see teacher's annotations
2. **Annotation templates**: Pre-defined comments/stamps for common feedback
3. **Batch grading**: Grade multiple submissions at once
4. **Export annotated PDF**: Download PDF with annotations embedded
5. **Mobile optimization**: Better mobile grading experience
6. **Rubric integration**: Structured grading rubrics
7. **Peer review**: Allow students to review each other's work

## References

- [Adobe PDF Embed API Documentation](https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/)
- [Adobe PDF Embed API Playground](https://documentservices.adobe.com/view-sdk-demo/index.html)
- [Firebase Storage CORS](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)
