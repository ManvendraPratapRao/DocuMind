import React, { useState, useEffect, useCallback, useRef } from 'react';
import DocumentToolbar from './DocumentToolbar';
import PdfRenderer from './PdfRenderer';
import ImageRenderer from './ImageRenderer';

export default function DocumentViewer({ filePreviewUrl, isPdf, isImage, fileName }) {
  const [zoom, setZoom] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('fit-page'); // 'fit-page', 'fit-width', 'custom'

  const containerRef = useRef(null);

  // Define zoom levels for standard stepping
  const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

  const handleZoomIn = useCallback(() => {
    setViewMode('custom');
    setZoom(prev => {
      const nextLevel = ZOOM_LEVELS.find(level => level > prev) || Math.min(prev + 0.25, 3);
      return nextLevel;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewMode('custom');
    setZoom(prev => {
      const nextLevel = [...ZOOM_LEVELS].reverse().find(level => level < prev) || Math.max(prev - 0.25, 0.5);
      return nextLevel;
    });
  }, []);

  const handleZoomTo = useCallback((level) => {
    setViewMode('custom');
    setZoom(level);
  }, []);

  const handleFitPage = useCallback(() => {
    setViewMode('fit-page');
    // Actual zoom is calculated in the renderer based on container size
  }, []);

  const handleFitWidth = useCallback(() => {
    setViewMode('fit-width');
    // Actual zoom is calculated in the renderer based on container size
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => (numPages ? Math.min(prev + 1, numPages) : prev));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      switch (e.key) {
        case 'ArrowLeft':
          handlePrevPage();
          break;
        case 'ArrowRight':
          handleNextPage();
          break;
        case '+':
        case '=': // allow equals key without shift
          handleZoomIn();
          break;
        case '-':
        case '_': // allow underscore key without shift
          handleZoomOut();
          break;
        case '0':
          handleFitPage();
          break;
        case '1':
          handleZoomTo(1);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut, handleFitPage, handleZoomTo, toggleFullscreen]);

  // Reset state when file changes
  useEffect(() => {
    setCurrentPage(1);
    setNumPages(null);
    setZoom(1);
    setViewMode('fit-page');
  }, [filePreviewUrl]);

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-[#05080f] text-slate-200 border-slate-800/80 overflow-hidden ${isFullscreen ? 'w-screen h-screen fixed inset-0 z-50' : 'w-full h-full border rounded-xl'}`}
    >
      <DocumentToolbar 
        fileName={fileName}
        isPdf={isPdf}
        currentPage={currentPage}
        numPages={numPages}
        zoom={zoom}
        viewMode={viewMode}
        isFullscreen={isFullscreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomTo={handleZoomTo}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onToggleFullscreen={toggleFullscreen}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {filePreviewUrl ? (
          isPdf ? (
            <PdfRenderer 
              file={filePreviewUrl}
              currentPage={currentPage}
              numPages={numPages}
              zoom={zoom}
              viewMode={viewMode}
              setNumPages={setNumPages}
              setCurrentPage={setCurrentPage}
              setZoom={setZoom}
            />
          ) : isImage ? (
            <ImageRenderer 
              file={filePreviewUrl}
              zoom={zoom}
              viewMode={viewMode}
              setZoom={setZoom}
              setCurrentPage={setCurrentPage}
              setNumPages={setNumPages}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <p>Preview not supported for this file type</p>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
            <p>No document loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}
