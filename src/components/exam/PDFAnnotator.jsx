import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Button from '../common/Button';
import Icon from '../common/Icon';
import { uploadFile } from '../../services/storageService';

// Set worker path - use local worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PDFAnnotator = ({ pdfUrl, fileUrls, fileType, onSaveAnnotation, onClose, existingAnnotations = [] }) => {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('pen'); // pen, text, highlight, eraser
  const [color, setColor] = useState('#ff0000');
  const [penSize, setPenSize] = useState(2); // Pen size: 1=thin, 2=medium, 3=thick
  const [textSize, setTextSize] = useState(2); // Text size: 1=small, 2=medium, 3=large
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isImage, setIsImage] = useState(false); // Track if file is image
  const [zoom, setZoom] = useState(1); // Zoom level (1 = 100%)
  const [showTextModal, setShowTextModal] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [textInput, setTextInput] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState(''); // Current image URL for multi-image support

  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pdfPageRef = useRef(null);
  const imageRef = useRef(null);
  const baseScaleRef = useRef(1); // Store base scale before zoom
  const baseScaleSetRef = useRef(false); // Track if base scale has been set
  const lastPointRef = useRef({ x: 0, y: 0 }); // For smooth curve drawing
  const activePointerRef = useRef(null); // Track active pointer ID to prevent duplicate events

  // Determine if we have multiple images
  const hasMultipleImages = fileUrls && fileUrls.length > 1;
  const effectiveTotalPages = hasMultipleImages ? fileUrls.length : totalPages;

  // Load PDF or Image
  useEffect(() => {
    loadFile();
  }, [pdfUrl, currentPage]);

  // Render page when currentPage or zoom changes
  useEffect(() => {
    if (pdf && !isImage) {
      renderPage(currentPage);
    } else if (isImage) {
      renderImagePage();
    }
  }, [pdf, currentPage, isImage, zoom, currentImageUrl]);

  const loadFile = async () => {
    try {
      setLoading(true);
      // Reset base scale when loading new page
      baseScaleSetRef.current = false;

      // If we have multiple images, use fileUrls array
      if (hasMultipleImages) {
        setIsImage(true);
        setTotalPages(fileUrls.length);
        setCurrentImageUrl(fileUrls[currentPage - 1]); // Set current image URL based on page
        setLoading(false);
        return;
      }

      // Check if file is image
      if (fileType === 'image' || pdfUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        setIsImage(true);
        setTotalPages(1); // Images are single page
        setCurrentImageUrl(pdfUrl);
        setLoading(false);
        return;
      }

      // Fetch PDF as blob to bypass CORS issues
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Load PDF from array buffer
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading file:', error);
      alert('Lỗi tải file: ' + error.message);
      setLoading(false);
    }
  };

  const renderImagePage = () => {
    const canvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const container = canvas.parentElement;

    // Save current drawing state before resizing (use highest quality)
    let savedDrawing = null;
    let savedWidth = 0;
    let savedHeight = 0;
    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      // Create a temporary canvas to save with no compression
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = drawingCanvas.width;
      tempCanvas.height = drawingCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(drawingCanvas, 0, 0);
      savedDrawing = tempCanvas;
      savedWidth = drawingCanvas.width;
      savedHeight = drawingCanvas.height;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;

      // Calculate base scale to fit container width ONLY ONCE (first render)
      const containerWidth = container.clientWidth - 20; // 20px padding
      if (!baseScaleSetRef.current) {
        const baseScale = containerWidth / img.width; // Base scale to fit container
        baseScaleRef.current = baseScale;
        baseScaleSetRef.current = true;
      }

      // Apply zoom on top of base scale
      const finalScale = baseScaleRef.current * zoom;

      // Set canvas size to scaled dimensions (height maintains aspect ratio)
      const scaledWidth = img.width * finalScale;
      const scaledHeight = img.height * finalScale;

      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      drawingCanvas.width = scaledWidth;
      drawingCanvas.height = scaledHeight;

      // Draw image on background canvas (scaled) with smooth rendering
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      // Setup drawing canvas with anti-aliasing
      const drawingCtx = drawingCanvas.getContext('2d', { alpha: true });
      drawingCtx.imageSmoothingEnabled = true;
      drawingCtx.imageSmoothingQuality = 'high';
      drawingCtx.lineCap = 'round';
      drawingCtx.lineJoin = 'round';
      ctxRef.current = drawingCtx;

      // Restore saved drawing if exists (when zooming)
      if (savedDrawing) {
        // Draw the saved canvas directly with high quality smoothing
        drawingCtx.imageSmoothingEnabled = true;
        drawingCtx.imageSmoothingQuality = 'high';
        drawingCtx.drawImage(savedDrawing, 0, 0, savedWidth, savedHeight, 0, 0, scaledWidth, scaledHeight);
      } else {
        // Load existing annotation only on first load
        loadExistingAnnotation(currentPage);
      }
    };
    // Use currentImageUrl for multi-image support, fallback to pdfUrl
    img.src = currentImageUrl || pdfUrl;
  };

  const renderPage = async (pageNum) => {
    if (!pdf) return;

    const page = await pdf.getPage(pageNum);
    pdfPageRef.current = page;

    const canvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const container = canvas.parentElement;

    // Save current drawing state before resizing (use highest quality)
    let savedDrawing = null;
    let savedWidth = 0;
    let savedHeight = 0;
    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      // Create a temporary canvas to save with no compression
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = drawingCanvas.width;
      tempCanvas.height = drawingCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(drawingCanvas, 0, 0);
      savedDrawing = tempCanvas;
      savedWidth = drawingCanvas.width;
      savedHeight = drawingCanvas.height;
    }

    // Calculate base scale to fit container width ONLY ONCE (first render)
    const containerWidth = container.clientWidth - 20; // 20px padding
    const baseViewport = page.getViewport({ scale: 1 });
    if (!baseScaleSetRef.current) {
      const baseScale = containerWidth / baseViewport.width; // Base scale to fit container
      baseScaleRef.current = baseScale;
      baseScaleSetRef.current = true;
    }

    // Apply zoom on top of base scale
    const finalScale = baseScaleRef.current * zoom;
    const viewport = page.getViewport({ scale: finalScale });

    // Set canvas size
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    drawingCanvas.width = viewport.width;
    drawingCanvas.height = viewport.height;

    // Render PDF page with smooth rendering
    const pdfCtx = canvas.getContext('2d', { alpha: false });
    pdfCtx.imageSmoothingEnabled = true;
    pdfCtx.imageSmoothingQuality = 'high';
    const renderContext = {
      canvasContext: pdfCtx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Setup drawing canvas with anti-aliasing
    const ctx = drawingCanvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    // Restore saved drawing if exists (when zooming)
    if (savedDrawing) {
      // Draw the saved canvas directly with high quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(savedDrawing, 0, 0, savedWidth, savedHeight, 0, 0, viewport.width, viewport.height);
    } else {
      // Load existing annotation only on first load
      loadExistingAnnotation(pageNum);
    }
  };

  const loadExistingAnnotation = (pageNum) => {
    const annotation = existingAnnotations.find((a) => a.page === pageNum);
    if (annotation && annotation.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = ctxRef.current;
        const canvas = drawingCanvasRef.current;
        // Scale annotation image to match current canvas size
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = annotation.imageUrl;
    }
  };

  // Helper function to get coordinates from pointer events
  const getCoordinates = (e) => {
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Drawing handlers
  const startDrawing = (e) => {
    // Only handle primary pointer (left mouse button or first touch/stylus contact)
    if (!e.isPrimary) return;

    // Track active pointer to ensure we only draw with one pointer at a time
    activePointerRef.current = e.pointerId;

    e.preventDefault(); // Prevent default touch/scroll behavior
    const { x, y } = getCoordinates(e);

    // If text tool is selected, open modal at click position
    if (tool === 'text') {
      setTextPosition({ x, y });
      setShowTextModal(true);
      return;
    }

    setIsDrawing(true);
    const ctx = ctxRef.current;

    // Store starting point for smooth curves
    lastPointRef.current = { x, y };

    // Line width scales with base scale and zoom for consistent visual size
    const totalScale = baseScaleRef.current * zoom;
    // Pen size multiplier: 1=1x, 2=2x, 3=3x
    const penSizeMultiplier = penSize;
    const baseLineWidth = 2 * totalScale * penSizeMultiplier;
    const baseHighlightWidth = 20 * totalScale;

    if (tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = baseLineWidth;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      // Draw a small point at the start for single clicks
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (tool === 'highlight') {
      ctx.strokeStyle = color;
      ctx.lineWidth = baseHighlightWidth;
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = baseHighlightWidth; // Same as highlight width
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    // Only handle the active pointer
    if (e.pointerId !== activePointerRef.current) return;

    e.preventDefault(); // Prevent default touch/scroll behavior

    const { x, y } = getCoordinates(e);

    const ctx = ctxRef.current;
    const lastPoint = lastPointRef.current;

    // Use quadratic curve for smoother lines
    const midX = (lastPoint.x + x) / 2;
    const midY = (lastPoint.y + y) / 2;

    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);

    // Update last point
    lastPointRef.current = { x, y };
  };

  const stopDrawing = (e) => {
    // Only stop if this is the active pointer
    if (e && e.pointerId !== activePointerRef.current) return;

    // Reset pointer tracking
    activePointerRef.current = null;

    if (isDrawing && ctxRef.current) {
      ctxRef.current.closePath();
      ctxRef.current.globalAlpha = 1.0;
    }
    setIsDrawing(false);
  };

  const addText = () => {
    if (!textInput.trim()) {
      setShowTextModal(false);
      setTextInput('');
      return;
    }

    const ctx = ctxRef.current;
    // Font size scales with base scale, zoom, and textSize multiplier
    const totalScale = baseScaleRef.current * zoom;
    const textSizeMultiplier = textSize; // 1=small, 2=medium, 3=large
    const baseFontSize = 16 * totalScale * textSizeMultiplier;
    ctx.font = `${baseFontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.globalCompositeOperation = 'source-over';

    // Add text at clicked position
    ctx.fillText(textInput, textPosition.x, textPosition.y);

    // Reset
    setShowTextModal(false);
    setTextInput('');
  };

  const clearPage = () => {
    if (!confirm('Xóa toàn bộ ghi chú trang này?')) return;
    const ctx = ctxRef.current;
    const canvas = drawingCanvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCurrentPage = async () => {
    setSaving(true);

    try {
      // Merge PDF page and drawings into one canvas
      const mergedCanvas = document.createElement('canvas');
      const pdfCanvas = canvasRef.current;
      const drawingCanvas = drawingCanvasRef.current;

      mergedCanvas.width = pdfCanvas.width;
      mergedCanvas.height = pdfCanvas.height;

      const mergedCtx = mergedCanvas.getContext('2d');
      mergedCtx.drawImage(pdfCanvas, 0, 0);
      mergedCtx.drawImage(drawingCanvas, 0, 0);

      // Convert to blob
      const blob = await new Promise((resolve) => {
        mergedCanvas.toBlob(resolve, 'image/png', 0.95);
      });

      const fileName = `annotation-page-${currentPage}-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Upload to storage
      const uploadResult = await uploadFile('annotations', file);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Save annotation metadata
      await onSaveAnnotation({
        page: currentPage,
        imageUrl: uploadResult.url,
        timestamp: new Date(),
      });

      alert(`Đã lưu ghi chú trang ${currentPage}!`);
    } catch (error) {
      console.error('Error saving annotation:', error);
      alert('Lỗi lưu ghi chú: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold">Ghi chú lên bài</h2>
            <p className="text-sm text-gray-500">
              Trang {currentPage}/{effectiveTotalPages}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={clearPage} className="text-sm">
              <Icon name="delete_sweep" className="mr-1" />
              Xóa toàn bộ ghi chú
            </Button>
            <Button variant="primary" onClick={saveCurrentPage} disabled={saving} className="text-sm">
              {saving ? 'Đang lưu...' : 'Lưu trang này'}
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl ml-2"
            >
              <Icon name="close" className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Content: Sidebar + Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Vertical Toolbar */}
          <div className="w-40 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2 overflow-y-auto">
            {/* Drawing Tools */}
            <button
              onClick={() => setTool('pen')}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center gap-2 ${
                tool === 'pen' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Icon name="edit" />
              <span className="text-sm font-medium">Bút</span>
            </button>
            <button
              onClick={() => setTool('highlight')}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center gap-2 ${
                tool === 'highlight' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Icon name="highlight" />
              <span className="text-sm font-medium">Highlight</span>
            </button>
            <button
              onClick={() => setTool('text')}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center gap-2 ${
                tool === 'text' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Icon name="text_fields" />
              <span className="text-sm font-medium">Text</span>
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center gap-2 ${
                tool === 'eraser' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Icon name="delete" />
              <span className="text-sm font-medium">Xóa</span>
            </button>

            {/* Conditional Divider and Size Sections */}
            {(tool === 'pen' || tool === 'text') && (
              <>
                {/* Divider */}
                <div className="w-full h-px bg-gray-300 dark:bg-gray-600 my-1"></div>

                {/* Pen Size Section - Only show when pen is selected */}
                {tool === 'pen' && (
                  <>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1 mb-1">Cỡ bút</div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPenSize(1)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          penSize === 1 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Nhỏ"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${penSize === 1 ? 'bg-white' : 'bg-gray-600 dark:bg-gray-300'}`}></div>
                      </button>
                      <button
                        onClick={() => setPenSize(2)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          penSize === 2 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Trung bình"
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${penSize === 2 ? 'bg-white' : 'bg-gray-600 dark:bg-gray-300'}`}></div>
                      </button>
                      <button
                        onClick={() => setPenSize(3)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          penSize === 3 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Lớn"
                      >
                        <div className={`w-4 h-4 rounded-full ${penSize === 3 ? 'bg-white' : 'bg-gray-600 dark:bg-gray-300'}`}></div>
                      </button>
                    </div>
                  </>
                )}

                {/* Text Size Section - Only show when text is selected */}
                {tool === 'text' && (
                  <>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1 mb-1">Cỡ chữ</div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setTextSize(1)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          textSize === 1 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Nhỏ"
                      >
                        <span className={`text-xs font-bold ${textSize === 1 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>A</span>
                      </button>
                      <button
                        onClick={() => setTextSize(2)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          textSize === 2 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Trung bình"
                      >
                        <span className={`text-sm font-bold ${textSize === 2 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>A</span>
                      </button>
                      <button
                        onClick={() => setTextSize(3)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          textSize === 3 ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title="Lớn"
                      >
                        <span className={`text-lg font-bold ${textSize === 3 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>A</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Divider */}
                <div className="w-full h-px bg-gray-300 dark:bg-gray-600 my-1"></div>
              </>
            )}

            {/* Colors Section */}
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1 mb-1">Màu sắc</div>
            <div className="flex justify-center gap-1.5">
              {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#000000'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${
                    color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={`Màu ${c}`}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gray-300 dark:bg-gray-600 my-1"></div>

            {/* Zoom Section */}
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1 mb-1">Zoom</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="w-9 h-9 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center"
                title="Thu nhỏ"
              >
                <Icon name="zoom_out" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-xs font-bold text-primary">{Math.round(zoom * 100)}%</span>
              </div>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="w-9 h-9 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center"
                title="Phóng to"
              >
                <Icon name="zoom_in" />
              </button>
            </div>
            <button
              onClick={() => setZoom(1)}
              className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-xs font-medium"
            >
              Reset 100%
            </button>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          {loading ? (
            <div className="flex items-center justify-center">
              <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
            </div>
          ) : (
            <div className="relative" style={{ display: 'inline-block' }}>
              <canvas ref={canvasRef} className="block" />
              <canvas
                ref={drawingCanvasRef}
                className="absolute top-0 left-0 cursor-crosshair"
                style={{ touchAction: 'none' }}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                onPointerCancel={stopDrawing}
              />
            </div>
          )}
          </div>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Icon name="arrow_back" className="mr-1" />
            Trang trước
          </Button>

          <span className="text-sm font-medium">
            Trang {currentPage} / {effectiveTotalPages}
          </span>

          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.min(effectiveTotalPages, p + 1))}
            disabled={currentPage === effectiveTotalPages}
          >
            Trang sau
            <Icon name="arrow_forward" className="ml-1" />
          </Button>
        </div>
      </div>

      {/* Text Input Modal */}
      {showTextModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Nhập text ghi chú</h3>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addText();
                } else if (e.key === 'Escape') {
                  setShowTextModal(false);
                  setTextInput('');
                }
              }}
              placeholder="Nhập nội dung ghi chú..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowTextModal(false);
                  setTextInput('');
                }}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={addText}
                className="flex-1"
              >
                Thêm text
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFAnnotator;
