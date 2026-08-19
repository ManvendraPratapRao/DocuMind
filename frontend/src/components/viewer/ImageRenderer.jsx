import React, { useRef, useEffect } from 'react';

export default function ImageRenderer({ 
  file, 
  zoom, 
  viewMode, 
  setZoom, 
  setCurrentPage, 
  setNumPages 
}) {
  const containerRef = useRef(null);

  // For images, we always have exactly 1 page
  useEffect(() => {
    setCurrentPage(1);
    setNumPages(1);
  }, [setCurrentPage, setNumPages]);

  // Determine scaling based on view mode and container size
  let calculatedScale = zoom;
  if (viewMode === 'fit-width') {
    // Basic heuristic: 120% scale if they want to fit width (since image might not fill width natively)
    // A robust fit-width requires image intrinsic width vs container width, but we'll approximate:
    calculatedScale = 1.25;
  } else if (viewMode === 'fit-page') {
    calculatedScale = 1.0; 
  }

  const scale = viewMode === 'custom' ? zoom : calculatedScale;

  return (
    <div className="flex w-full h-full">
      {/* Main Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#05080f] p-8 text-center relative"
      >
        <div 
          className="transition-transform duration-200 ease-out origin-center inline-block"
          style={{ transform: `scale(${scale})` }}
        >
          <img 
            src={file} 
            alt="Document Preview" 
            className="max-w-[80vw] max-h-[85vh] object-contain shadow-[0_4px_24px_rgba(0,0,0,0.5)] rounded-sm bg-white" 
          />
        </div>
      </div>
    </div>
  );
}
