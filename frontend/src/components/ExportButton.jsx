import Papa from 'papaparse';
import { Download } from 'lucide-react';

export default function ExportButton({ data, filename = "export.csv", job }) {
  const handleExport = () => {
    if (!data) return;
    
    // Dynamically find any array-of-objects (line items, etc)
    let arrayKey = null;
    let arrayData = null;
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        arrayKey = k;
        arrayData = v;
        break;
      }
    }

    let csvData = [];
    if (arrayData) {
      // Flatten: top-level scalar fields prepended to every line item row
      const topLevel = {};
      for (const [k, v] of Object.entries(data)) {
        if (k !== arrayKey && (typeof v !== 'object' || v === null)) {
          topLevel[k] = v;
        }
      }
      csvData = arrayData.map(row => ({ ...topLevel, ...row }));
    } else {
      // No nested table, just export flat fields
      csvData = [data];
    }

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button 
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
    >
      <Download size={16} />
      Export CSV
    </button>
  );
}
