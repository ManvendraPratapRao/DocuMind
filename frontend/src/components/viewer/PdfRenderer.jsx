import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ThumbnailRail from './ThumbnailRail';
import { Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfRenderer({ 
  file, 
  currentPage, 
  numPages, 
  zoom, 
  viewMode, 
  setNumPages, 
  setCurrentPage,
  setZoom
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container for fit-page and fit-width logic
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  // Determine scaling based on view mode and container size
  let calculatedScale = zoom;
  
  if (viewMode === 'fit-width' && containerWidth) {
    // Assuming standard A4 roughly 600px wide at 1x scale. 
    // We adjust scale to match container width minus padding
    const padding = 64; // 32px each side
    calculatedScale = (containerWidth - padding) / 600; // 600 is a heuristic for PDF base width
  } else if (viewMode === 'fit-page' && containerRef.current) {
    // Fit page logic depends on container height mostly, but react-pdf scale applies to width too.
    // We will just use a sensible default for fit-page (usually around 1 or slightly less)
    // A robust fit-page requires knowing exact PDF dimensions, but 1.0 is a safe start
    calculatedScale = 1.0; 
  }

  // Allow zoom override if it's custom
  const scale = viewMode === 'custom' ? zoom : calculatedScale;

  return (
    <div className="flex w-full h-full">
      {/* Thumbnails */}
      <ThumbnailRail 
        numPages={numPages} 
        currentPage={currentPage} 
        onPageSelect={setCurrentPage} 
      />

      {/* Main Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#05080f] relative p-4 text-center"
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
              <Loader2 className="animate-spin" size={32} />
            </div>
          }
          className="inline-block"
        >
          {numPages && (
            <div className="relative inline-block shadow-[0_4px_24px_rgba(0,0,0,0.5)] rounded-sm bg-white overflow-hidden transition-transform duration-200 ease-out">
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="pdf-page-container"
              />
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
