import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import {
  FileUp, Loader2, AlertCircle,
  FileText, Sparkles, X, Shield, Upload as UploadIcon, Layers
} from 'lucide-react'
import Papa from 'papaparse'
import Sidebar from './components/Sidebar'
import ProcessingView from './components/ProcessingView'
import ResultsPanel from './components/ResultsPanel'
import HowItWorksPanel from './components/HowItWorksPanel'
import ApiModelsPage from './components/ApiModelsPage'
import TemplatesPage from './components/TemplatesPage'
import SchemasPage from './components/SchemasPage'
import SettingsPage from './components/SettingsPage'
import HelpPage from './components/HelpPage'
import BatchProcessingView from './components/BatchProcessingView'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DOC_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: '📄' },
  { value: 'receipt', label: 'Receipt', icon: '🧾' },
  { value: 'resume', label: 'Resume / CV', icon: '👤' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'purchase_order', label: 'Purchase Order', icon: '📦' },
  { value: 'bank_statement', label: 'Bank Statement', icon: '🏦' },
  { value: 'medical_bill', label: 'Medical Bill', icon: '🏥' },
  { value: 'custom', label: '✦ Custom Schema', icon: '✦' },
]

const INITIAL_MODELS = [
  { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', badge: 'Recommended', desc: 'Powerful · High accuracy', badgeColor: 'blue' },
  { value: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', badge: 'Fast', desc: 'Fast inference · Efficient', badgeColor: 'emerald' },
  { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', badge: 'Math', desc: 'Numbers · Tables · Finance', badgeColor: 'purple' },
]

const BADGE_CLS = {
  blue: 'bg-blue-500/20    text-blue-400',
  purple: 'bg-purple-500/20  text-purple-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  orange: 'bg-orange-500/20  text-orange-400',
}

// ─── Main App ────────────────────────────────────────────────────────────────────────────
const DEFAULT_DEMO_KEY = import.meta.env.VITE_DOCUMIND_API_KEY || 'documind_demo_access'

export default function App() {
  // Persist API key across sessions (fallback to pre-configured demo key if provided via build)
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('documind_api_key')
    if (saved && saved.trim()) return saved.trim()
    return import.meta.env.VITE_DOCUMIND_API_KEY || DEFAULT_DEMO_KEY
  })
  const [docType, setDocType] = useState('invoice')
  
  const [models, setModels] = useState(() => {
    const saved = localStorage.getItem('documind_models')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const filtered = parsed.filter(m => m.value !== 'llama-3.3-70b-versatile' && m.value !== 'mixtral-8x7b-32768')
        return filtered.length > 0 ? filtered : INITIAL_MODELS
      } catch (e) {
        return INITIAL_MODELS
      }
    }
    return INITIAL_MODELS
  })
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('documind_default_model')
    if (saved === 'llama-3.3-70b-versatile' || saved === 'mixtral-8x7b-32768') {
      return 'openai/gpt-oss-120b'
    }
    return saved || 'openai/gpt-oss-120b'
  })

  // Save models and default model
  useEffect(() => { localStorage.setItem('documind_models', JSON.stringify(models)) }, [models])
  useEffect(() => { localStorage.setItem('documind_default_model', model) }, [model])
  const [jobs, setJobs] = useState([])
  const [activeJob, setActiveJob] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)   // Single File object
  const [uploadedFiles, setUploadedFiles] = useState([])   // Multiple files for Batch mode
  const [activeBatchId, setActiveBatchId] = useState(null) // Currently active batch ID
  const [filePreviewUrl, setFilePreviewUrl] = useState(null) // object URL

  const [activePage, setActivePage] = useState('extractions')
  const [selectedJobs, setSelectedJobs] = useState([])
  const [folders, setFolders] = useState([])
  const [customSchemas, setCustomSchemas] = useState([])
  const [selectedSchemaId, setSelectedSchemaId] = useState('')
  const [centerWidth, setCenterWidth] = useState(420)
  const fileCache = useRef({})

  const pollingRef = useRef(null)
  const apiKeyRef = useRef(apiKey || DEFAULT_DEMO_KEY)

  // Keep ref in sync for polling closures
  useEffect(() => { apiKeyRef.current = apiKey || DEFAULT_DEMO_KEY }, [apiKey])

  // Persist API key
  useEffect(() => {
    if (apiKey) localStorage.setItem('documind_api_key', apiKey)
  }, [apiKey])

  // Derive app state from activeJob
  const appState =
    activeJob?.status === 'done' ? 'done' :
      activeJob?.status === 'failed' ? 'failed' :
        (isUploading || activeJob?.status === 'processing') ? 'processing' :
          'new'

  // ── Initialize App State ──
  const fetchJobsAndFolders = useCallback(async () => {
    const key = apiKeyRef.current
    if (key) {
      try {
        const [jobsRes, foldersRes, schemasRes] = await Promise.all([
          axios.get(`${API_URL}/async/jobs`, { headers: { Authorization: `Bearer ${key}` } }),
          axios.get(`${API_URL}/async/folders`, { headers: { Authorization: `Bearer ${key}` } }),
          axios.get(`${API_URL}/async/schemas`, { headers: { Authorization: `Bearer ${key}` } })
        ])
        setJobs(jobsRes.data)
        setFolders(foldersRes.data)
        setCustomSchemas(schemasRes.data)
      } catch (e) {
        console.error("Failed to fetch jobs or folders:", e)
      }
    }
  }, [])

  useEffect(() => {
    fetchJobsAndFolders()
  }, [apiKey, fetchJobsAndFolders])

  // ── Polling: watch for any "processing" jobs ──
  useEffect(() => {
    const processingJobs = jobs.filter(j => j.status === 'processing')
    const hasProcessing = processingJobs.length > 0

    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const key = apiKeyRef.current
        if (!key) return

        let updatedAny = false
        const nextJobs = [...jobs]

        for (const pJob of processingJobs) {
          try {
            const { data } = await axios.get(`${API_URL}/async/jobs/${pJob.job_id}`, {
              headers: { Authorization: `Bearer ${key}` }
            })
            if (data.status !== 'processing') {
              const idx = nextJobs.findIndex(j => j.job_id === pJob.job_id)
              if (idx !== -1) {
                nextJobs[idx] = data
                updatedAny = true
              }
            }
          } catch (e) {
            // silent
          }
        }

        if (updatedAny) {
          setJobs(nextJobs)
        }
      }, 2000)
    }

    return () => {
      if (!hasProcessing && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [jobs])

  // ── Keep activeJob in sync with latest poll data ──
  useEffect(() => {
    if (!activeJob) return
    const fresh = jobs.find(j => j.job_id === activeJob.job_id)
    if (fresh && (
      fresh.status !== activeJob.status ||
      // Also sync when result arrives (status stays 'done' but result goes from null to data)
      (fresh.status === 'done' && fresh.result !== activeJob.result)
    )) {
      setActiveJob(fresh)
    }
  }, [jobs]) // eslint-disable-line

  // ── File preview URL: local uploadedFile first, then fetch from server ──
  useEffect(() => {
    let objectUrl = null
    let cancelled = false

    const loadPreview = async () => {
      if (!activeJob) {
        setFilePreviewUrl(null)
        return
      }

      if (uploadedFile) {
        // Fresh upload — use local object URL
        objectUrl = URL.createObjectURL(uploadedFile)
        setFilePreviewUrl(objectUrl)
        fileCache.current[activeJob.job_id] = objectUrl
        return
      }

      // No local file — check cache first
      if (fileCache.current[activeJob.job_id]) {
        setFilePreviewUrl(fileCache.current[activeJob.job_id])
        return
      }

      // Try fetching from server (past extractions)
      try {
        const response = await fetch(
          `${API_URL}/async/files/${activeJob.job_id}`,
          { headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` } }
        )
        if (!cancelled && response.ok) {
          const blob = await response.blob()
          objectUrl = URL.createObjectURL(blob)
          fileCache.current[activeJob.job_id] = objectUrl
          setFilePreviewUrl(objectUrl)
        } else if (!cancelled) {
          setFilePreviewUrl(null)
        }
      } catch {
        if (!cancelled) setFilePreviewUrl(null)
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      // Don't revoke — keep in cache for re-use when switching jobs
    }
  }, [uploadedFile, activeJob?.job_id, apiKey])

  const handleLoadSample = async (url, filename, type) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const file = new File([blob], filename, { type: 'application/pdf' })
      setUploadedFile(file)
      setUploadedFiles([])
      setActiveBatchId(null)
      setDocType(type)
      setUploadError(null)
    } catch (err) {
      console.error('Failed to load sample document:', err)
    }
  }

  const handleLoadSampleBatch = async () => {
    try {
      const res = await fetch('/samples/sample_invoice.pdf')
      const blob = await res.blob()
      const files = [
        new File([blob], 'Acme_Invoice_01.pdf', { type: 'application/pdf' }),
        new File([blob], 'Acme_Invoice_02.pdf', { type: 'application/pdf' }),
        new File([blob], 'Acme_Invoice_03.pdf', { type: 'application/pdf' }),
      ]
      setUploadedFiles(files)
      setUploadedFile(null)
      setActiveBatchId(null)
      setDocType('invoice')
      setUploadError(null)
    } catch (err) {
      console.error('Failed to load sample batch:', err)
    }
  }

  // ── Drop handler: stores single file or array of files for batch mode ──
  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return
    setActiveBatchId(null)
    setUploadError(null)

    if (acceptedFiles.length === 1) {
      setUploadedFile(acceptedFiles[0])
      setUploadedFiles([])
    } else {
      setUploadedFiles(acceptedFiles.slice(0, 50))
      setUploadedFile(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    maxFiles: 50,
    multiple: true,
    accept: { 
      'application/pdf': ['.pdf'], 
      'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'],
      'message/rfc822': ['.eml'],
      'application/vnd.ms-outlook': ['.msg'],
      'text/plain': ['.txt', '.md'],
      'application/json': ['.json']
    },
  })

  // ── Batch Extract: called when user submits multiple files ──
  const handleBatchExtract = async () => {
    if (!uploadedFiles || uploadedFiles.length === 0) return
    const activeKey = (apiKey && apiKey.trim()) || DEFAULT_DEMO_KEY
    setUploadError(null)
    setIsUploading(true)

    const formData = new FormData()
    uploadedFiles.forEach(f => {
      formData.append('files', f)
    })
    formData.append('doc_type', docType)
    if (model) formData.append('model', model)

    const targetFolderId = document.getElementById('upload-folder-select')?.value
    if (targetFolderId) formData.append('folder_id', targetFolderId)

    if (docType === 'custom') {
      if (!selectedSchemaId) {
        setUploadError('Please select a custom schema before extracting.')
        setIsUploading(false)
        return
      }
      formData.append('schema_id', selectedSchemaId)
    }

    try {
      const { data } = await axios.post(`${API_URL}/async/batch-extract`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${activeKey || DEFAULT_DEMO_KEY}`
        }
      })
      setActiveBatchId(data.batch_id)
      setUploadedFiles([])
      setUploadedFile(null)
      setActiveJob(null)
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message || 'Batch upload failed. Check your API key.')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Extract: routes between single-file and batch extraction ──
  const handleExtract = async () => {
    if (uploadedFiles && uploadedFiles.length > 1) {
      return handleBatchExtract()
    }
    if (!uploadedFile) return
    const activeKey = (apiKey && apiKey.trim()) || DEFAULT_DEMO_KEY
    setUploadError(null)

    setIsUploading(true)
    // Prepare form data
    const formData = new FormData()
    formData.append('file', uploadedFile)
    formData.append('doc_type', docType)
    if (model) formData.append('model', model)
    
    // Add target folder if selected
    const targetFolderId = document.getElementById('upload-folder-select')?.value
    if (targetFolderId) formData.append('folder_id', targetFolderId)

    // Add schema_id if custom doc_type
    if (docType === 'custom') {
      if (!selectedSchemaId) {
        setUploadError('Please select a custom schema before extracting.')
        setIsUploading(false)
        return
      }
      formData.append('schema_id', selectedSchemaId)
    }

    try {
      const { data } = await axios.post(`${API_URL}/async/extract`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${activeKey || DEFAULT_DEMO_KEY}`
        }
      })

      // Optimistic stub so UI switches to processing view immediately
      const stub = {
        job_id: data.job_id,
        status: 'processing',
        filename: uploadedFile.name,
        doc_type: docType,
        result: null,
        error: null,
        created_at: new Date().toISOString(),
      }
      setActiveJob(stub)
      setJobs(prev => [stub, ...prev])
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message || 'Upload failed. Check your API key.')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Delete job ──
  const handleDelete = async (jobId) => {
    try {
      await axios.delete(`${API_URL}/async/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` },
      })
      if (activeJob?.job_id === jobId) { setActiveJob(null); setUploadedFile(null) }
      if (fileCache.current[jobId]) {
        URL.revokeObjectURL(fileCache.current[jobId])
        delete fileCache.current[jobId]
      }
      setJobs(prev => prev.filter(j => j.job_id !== jobId))
    } catch { /* silent */ }
  }

  const handleNewUpload = () => {
    setActiveJob(null)
    setUploadedFile(null)
    setUploadedFiles([])
    setActiveBatchId(null)
    setUploadError(null)
  }

  // ── Folders ──
  const handleCreateFolder = async (name) => {
    try {
      const { data } = await axios.post(`${API_URL}/async/folders`, { name }, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setFolders(prev => [...prev, data])
    } catch (e) {
      alert("Failed to create folder: " + (e.response?.data?.detail || e.message))
    }
  }

  const handleRenameFolder = async (folderId, newName) => {
    try {
      const { data } = await axios.patch(`${API_URL}/async/folders/${folderId}`, { name: newName }, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setFolders(prev => prev.map(f => f.id === folderId ? data : f))
    } catch (e) {
      alert("Failed to rename folder: " + (e.response?.data?.detail || e.message))
    }
  }

  const handleDeleteFolder = async (folderId) => {
    try {
      await axios.delete(`${API_URL}/async/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setFolders(prev => prev.filter(f => f.id !== folderId))
      setJobs(prev => prev.map(j => j.folder_id === folderId ? { ...j, folder_id: null } : j))
    } catch (e) {
      alert("Failed to delete folder: " + (e.response?.data?.detail || e.message))
    }
  }

  // ── Custom Schemas ──
  const handleCreateSchema = async (schemaData) => {
    try {
      const { data } = await axios.post(`${API_URL}/async/schemas`, schemaData, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setCustomSchemas(prev => [data, ...prev])
    } catch (e) {
      alert('Failed to create schema: ' + (e.response?.data?.detail || e.message))
      throw e
    }
  }

  const handleDeleteSchema = async (schemaId) => {
    try {
      await axios.delete(`${API_URL}/async/schemas/${schemaId}`, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setCustomSchemas(prev => prev.filter(s => s.id !== schemaId))
      if (selectedSchemaId === schemaId) setSelectedSchemaId('')
    } catch (e) {
      alert('Failed to delete schema: ' + (e.response?.data?.detail || e.message))
    }
  }

  const handleMoveJobToFolder = async (jobId, folderId) => {
    try {
      await axios.patch(`${API_URL}/async/jobs/${jobId}/folder`, { folder_id: folderId }, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      // Update local state
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, folder_id: folderId } : j))
    } catch (e) {
      alert("Failed to move job: " + (e.response?.data?.detail || e.message))
    }
  }

  // ── Bulk Actions ──
  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedJobs.length} extractions?`)) return;
    try {
      await axios.post(`${API_URL}/async/jobs/bulk-delete`, { job_ids: selectedJobs }, {
        headers: { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_KEY}` }
      })
      setJobs(prev => prev.filter(j => !selectedJobs.includes(j.job_id)))
      if (selectedJobs.includes(activeJob?.job_id)) setActiveJob(null)
      setSelectedJobs([])
    } catch (e) {
      alert("Failed to bulk delete: " + (e.response?.data?.detail || e.message))
    }
  }

  const handleBulkExportCSV = () => {
    const selectedData = jobs.filter(j => selectedJobs.includes(j.job_id) && j.result);
    if (selectedData.length === 0) {
      alert("No completed extractions selected.");
      return;
    }

    let allRows = [];
    const allKeys = new Set(['_filename', '_doc_type']);

    selectedData.forEach(job => {
      // Find the main table data array (e.g., line_items)
      let tableData = null;
      for (const [k, v] of Object.entries(job.result)) {
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
          tableData = v;
          break;
        }
      }

      // Extract top-level scalar fields
      const topLevelFields = { _filename: job.filename, _doc_type: job.doc_type };
      for (const [k, v] of Object.entries(job.result)) {
        if (k === 'raw_text_preview') continue; // Omit preview text from CSV as it ruins formatting
        
        if (typeof v !== 'object' || v === null) {
          topLevelFields[k] = v;
          allKeys.add(k);
        } else if (v !== tableData) {
          // If it's a nested object/array that is NOT the main table data, stringify it
          topLevelFields[k] = JSON.stringify(v);
          allKeys.add(k);
        }
      }

      // Flatten: Create a row for each item in the tableData
      if (tableData) {
        tableData.forEach(row => {
          const rowData = { ...topLevelFields };
          for (const [rk, rv] of Object.entries(row)) {
            rowData[rk] = typeof rv === 'object' && rv !== null ? JSON.stringify(rv) : rv;
            allKeys.add(rk); // Ensure the line-item columns are added to the headers
          }
          allRows.push(rowData);
        });
      } else {
        // No table data, just add the top-level object
        allRows.push(topLevelFields);
      }
    });

    if (allRows.length === 0) return;

    // By passing fields explicitly, PapaParse will guarantee no columns are dropped
    const csv = Papa.unparse({
      fields: Array.from(allKeys),
      data: allRows
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DocuMind_Bulk_Export_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSelectedJobs([]);
  }

  const handleBulkWebhook = async () => {
    const webhookUrl = localStorage.getItem('documind_webhook_url');
    if (!webhookUrl) {
      alert("Please configure a Webhook URL in the Settings page first.");
      setActivePage('settings');
      return;
    }
    
    const selectedData = jobs.filter(j => selectedJobs.includes(j.job_id) && j.result);
    if (selectedData.length === 0) {
      alert("No completed extractions selected.");
      return;
    }

    try {
      // POST the aggregated results to the webhook
      const payload = selectedData.map(j => ({
        job_id: j.job_id,
        filename: j.filename,
        doc_type: j.doc_type,
        data: j.result
      }));
      
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      alert(`Successfully sent ${selectedData.length} records to Webhook!`);
      setSelectedJobs([]);
    } catch (err) {
      alert("Webhook failed: " + (err.message || 'Unknown error'));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', backgroundColor: '#0f172a', color: '#f8fafc' }}>

      <Sidebar
        jobs={jobs}
        folders={folders}
        activeJobId={activeJob?.job_id}
        onSelectJob={job => { setActiveJob(job); setUploadedFile(null); setActiveBatchId(null) }}
        onNewUpload={handleNewUpload}
        onDeleteJob={handleDelete}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveJobToFolder={handleMoveJobToFolder}
        activePage={activePage}
        setActivePage={setActivePage}
        selectedJobs={selectedJobs}
        setSelectedJobs={setSelectedJobs}
        onBulkExportCSV={handleBulkExportCSV}
        onBulkWebhook={handleBulkWebhook}
        onBulkDelete={handleBulkDelete}
      />

      {/* ── Main panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top header bar */}
        <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm flex items-center justify-between px-6 gap-4 z-10 relative">
          <div className="flex items-center gap-2.5 min-w-0">
            {activePage === 'extractions' ? (
              activeJob ? (
                <>
                  <FileText size={15} className="text-slate-500 shrink-0" />
                  <span className="text-sm font-semibold text-slate-200 truncate max-w-xs">{activeJob.filename}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 uppercase tracking-wider shrink-0">
                    {activeJob.doc_type?.replace(/_/g, ' ')}
                  </span>
                  {activeJob.status === 'done' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full shrink-0">✓ Extracted</span>
                  )}
                  {activeJob.status === 'processing' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full shrink-0 animate-pulse">● Processing</span>
                  )}
                  {activeJob.status === 'failed' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full shrink-0">✗ Failed</span>
                  )}
                  {(activeBatchId || activeJob.batch_id) && (
                    <button
                      onClick={() => {
                        setActiveBatchId(activeBatchId || activeJob.batch_id)
                        setActiveJob(null)
                      }}
                      className="ml-2 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                      title="Return to batch queue and download combined CSV"
                    >
                      <Layers size={13} className="text-indigo-400" />
                      ← Back to Batch Progress
                    </button>
                  )}
                </>
              ) : activeBatchId ? (
                <>
                  <Layers size={15} className="text-indigo-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-200">Batch Processing</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-indigo-500/15 text-indigo-300 rounded-full shrink-0 border border-indigo-500/30">
                    {activeBatchId.slice(0, 16)}...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                    <span className="text-white text-[12px] font-bold">D</span>
                  </div>
                  <span className="text-sm font-bold text-white tracking-tight">DocuMind <span className="text-slate-400 font-normal">AI</span></span>
                </>
              )
            ) : (
               <span className="text-sm font-semibold text-slate-200 capitalize">{activePage.replace('_', ' ')}</span>
            )}
          </div>

          {/* Header right actions */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Demo Ready
            </span>
            {activePage === 'extractions' && (appState === 'done' || appState === 'failed') && (
              <button
                onClick={handleNewUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700"
              >
                <UploadIcon size={13} /> New
              </button>
            )}
            
            <button onClick={() => setActivePage('help')} className="text-[13px] font-medium text-slate-400 hover:text-slate-200 transition-colors">
              Help
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[12px] font-bold text-indigo-300 cursor-pointer hover:bg-indigo-500/30 transition-all">
              MK
            </div>
          </div>
        </header>

        {/* ── Content area ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Center Column: Process a Document ── */}
          {activePage === 'extractions' && (
            <>
              <div className="flex flex-col bg-[#0B0F19] overflow-y-auto" style={{ width: centerWidth, flexShrink: 0 }}>
                <div className="p-6">
              
                  <div className="mb-6">
                    <h1 className="text-[22px] font-bold text-white tracking-tight mb-1.5">Process a Document</h1>
                    <p className="text-[13px] text-slate-400">Extract structured data from invoices, receipts, contracts and more.</p>
                  </div>

                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`
                      relative flex flex-col items-center justify-center gap-3
                      border-[1.5px] border-dashed rounded-2xl px-6 py-10 text-center
                      cursor-pointer select-none transition-all duration-200 mb-6
                      ${isDragActive
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                        : uploadedFile
                          ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400/60'
                          : 'border-slate-700/80 bg-slate-800/20 hover:border-slate-600 hover:bg-slate-800/40'}
                    `}
                  >
                    <input {...getInputProps()} />

                    {uploadedFiles.length > 1 ? (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-1">
                          <Layers size={22} className="text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-indigo-300">
                            {uploadedFiles.length} Documents Selected
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Batch Mode · {(uploadedFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB total
                          </p>
                          <div className="flex flex-wrap gap-1 justify-center mt-2 max-w-[280px]">
                            {uploadedFiles.slice(0, 3).map((f, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 truncate max-w-[120px]">
                                {f.name}
                              </span>
                            ))}
                            {uploadedFiles.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-400 font-bold">
                                +{uploadedFiles.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setUploadedFiles([]); setUploadError(null) }}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Clear batch"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : uploadedFile ? (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-1">
                          <FileText size={22} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-emerald-300 truncate max-w-[280px] px-4">{uploadedFile.name}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setUploadedFile(null); setUploadError(null) }}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-1"
                          style={{ boxShadow: '0 0 30px rgba(59,130,246,0.15)' }}
                        >
                          <UploadIcon size={22} className="text-blue-400" />
                        </div>
                        <div>
                          <p className="text-slate-200 font-semibold text-[14px] mb-1">Drop your documents here</p>
                          <p className="text-slate-400 text-[13px]">
                            or <span className="text-blue-400 font-medium">browse files</span>
                          </p>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
                          Upload 1 file or a batch of up to 50 files
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Quick-try sample buttons for frictionless demos */}
                  {(!uploadedFile && uploadedFiles.length === 0) && (
                    <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-medium">Quick Demo:</span>
                      <button
                        type="button"
                        onClick={() => handleLoadSample('/samples/sample_invoice.pdf', 'sample_invoice.pdf', 'invoice')}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-blue-500/40"
                      >
                        📄 Sample Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadSample('/samples/sample_receipt.pdf', 'sample_receipt.pdf', 'receipt')}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-blue-500/40"
                      >
                        🧾 Sample Receipt
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadSampleBatch}
                        className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 rounded-lg text-[11px] font-medium text-indigo-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-indigo-400/50"
                      >
                        ⚡ Batch Demo (3 Invoices)
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {uploadError && (
                    <div className="flex items-start gap-2.5 p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px]">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Extraction Settings Card */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-slate-300">Extraction Settings</span>
                    </div>
                    
                    <div className="p-4 flex flex-col gap-4">
                      {/* Row 1: Type and Model */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Document Type</label>
                          <div className="relative">
                            <select
                              value={docType}
                              onChange={e => setDocType(e.target.value)}
                              className="w-full appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-[13px] rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-500 transition-colors"
                            >
                              {DOC_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1.5">Best for {docType.replace('_', ' ')}s</p>
                        </div>

                        {/* Custom Schema Selector — shown only when doc_type is custom */}
                        {docType === 'custom' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Schema</label>
                            <div className="relative">
                              <select
                                value={selectedSchemaId}
                                onChange={e => setSelectedSchemaId(e.target.value)}
                                className="w-full appearance-none bg-slate-800/80 border border-blue-500/50 text-slate-200 text-[13px] rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-500 transition-colors"
                              >
                                <option value="">— Pick a schema —</option>
                                {customSchemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                            </div>
                            {customSchemas.length === 0 && (
                              <p className="text-[10px] text-amber-400 mt-1.5">No custom schemas yet — create one in the Schemas page.</p>
                            )}
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Target Folder</label>
                          <div className="relative">
                            <select
                              id="upload-folder-select"
                              className="w-full appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-[13px] rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-500 transition-colors"
                            >
                              <option value="">Unorganized</option>
                              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1.5">Save to specific folder</p>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">AI Model</label>
                          <div className="relative">
                            <select
                              value={model}
                              onChange={e => setModel(e.target.value)}
                              className="w-full appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-[13px] rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-500 transition-colors"
                            >
                              {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-slate-500">{models.find(m => m.value === model)?.desc?.split('·')[0].trim() || 'Custom'}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${BADGE_CLS[models.find(m => m.value === model)?.badgeColor || 'emerald']}`}>
                              {models.find(m => m.value === model)?.badge || 'Custom'}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Extract Button Action Area */}
                  {uploadedFiles.length > 1 ? (
                    <button
                      onClick={handleExtract}
                      disabled={isUploading}
                      className={`
                        w-full flex items-center justify-center gap-2 py-3.5 px-6
                        rounded-xl text-[14px] font-bold transition-all duration-200
                        ${isUploading
                          ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 cursor-wait'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] cursor-pointer'}
                      `}
                    >
                      {isUploading ? (
                        <><Loader2 size={16} className="animate-spin-slow" /> Queuing Batch ({uploadedFiles.length} files)...</>
                      ) : (
                        <><Layers size={16} className="text-indigo-200" /> Start Batch Extraction ({uploadedFiles.length} files) <span className="text-indigo-200 ml-1">→</span></>
                      )}
                    </button>
                  ) : uploadedFile ? (
                    <button
                      onClick={handleExtract}
                      disabled={isUploading}
                      className={`
                        w-full flex items-center justify-center gap-2 py-3.5 px-6
                        rounded-xl text-[14px] font-bold transition-all duration-200
                        ${isUploading
                          ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50 cursor-wait'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] cursor-pointer'}
                      `}
                    >
                      {isUploading ? (
                        <><Loader2 size={16} className="animate-spin-slow" /> Extracting Document...</>
                      ) : (
                        <><Sparkles size={16} className="text-blue-200" /> Extract Data <span className="text-blue-200 ml-1">→</span></>
                      )}
                    </button>
                  ) : activeJob ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => openFileDialog()}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-[14px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        <UploadIcon size={16} className="text-blue-400" />
                        Process Another Document
                      </button>
                      {(activeBatchId || activeJob?.batch_id) && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBatchId(activeBatchId || activeJob.batch_id)
                            setActiveJob(null)
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[12px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          <Layers size={14} className="text-indigo-400" />
                          ← Return to Batch Dashboard
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openFileDialog()}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-[14px] font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 transition-all duration-200 cursor-pointer"
                    >
                      <UploadIcon size={16} className="text-slate-500" />
                      Select Document to Extract <span className="text-slate-500 ml-1">→</span>
                    </button>
                  )}
                  
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                    <Shield size={12} /> Your data is secure and never stored.
                  </div>

                </div>
              </div>
              
              {/* Drag Resizer */}
              <div 
                className="w-1.5 bg-slate-800/50 hover:bg-blue-500/50 active:bg-blue-500 cursor-col-resize z-20 shrink-0 transition-colors"
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startWidth = centerWidth;
                  
                  const onMouseMove = (moveEvent) => {
                    const newWidth = Math.max(300, Math.min(startWidth + (moveEvent.clientX - startX), 800));
                    setCenterWidth(newWidth);
                  };
                  
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = 'default';
                  };
                  
                  document.body.style.cursor = 'col-resize';
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
              />
            </>
          )}

          {/* ── Right Column: Dynamic View ── */}
          <div className="flex-1 bg-[#0a0f1c] flex flex-col overflow-hidden relative">
            {activePage === 'templates' ? <TemplatesPage /> :
             activePage === 'schemas' ? <SchemasPage schemas={customSchemas} onCreateSchema={handleCreateSchema} onDeleteSchema={handleDeleteSchema} /> :
             activePage === 'settings' ? <SettingsPage /> :
             activePage === 'help' ? <HelpPage /> :
             activePage === 'api' ? <ApiModelsPage models={models} setModels={setModels} defaultModel={model} setDefaultModel={setModel} /> :
             activePage === 'extractions' ? (
              activeJob ? (
                appState === 'processing' && (!activeJob.result) ? (
                  <div className="flex-1 p-6 relative z-10">
                    <ProcessingView filename={activeJob?.filename || uploadedFile?.name} />
                  </div>
                ) : (
                  <ResultsPanel
                    job={activeJob}
                    filePreviewUrl={filePreviewUrl}
                    uploadedFile={uploadedFile}
                    batchId={activeBatchId || activeJob?.batch_id}
                    onBackToBatch={(activeBatchId || activeJob?.batch_id) ? () => {
                      setActiveBatchId(activeBatchId || activeJob.batch_id)
                      setActiveJob(null)
                    } : null}
                    onNewExtraction={handleNewUpload}
                    onUpdateJob={(jobId, newResult) => {
                      setActiveJob(prev => prev && prev.job_id === jobId ? { ...prev, result: newResult } : prev)
                      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, result: newResult } : j))
                    }}
                    apiKey={apiKey || DEFAULT_DEMO_KEY}
                  />
                )
              ) : activeBatchId ? (
                <BatchProcessingView
                  batchId={activeBatchId}
                  apiUrl={API_URL}
                  apiKey={apiKey || DEFAULT_DEMO_KEY}
                  onClose={() => setActiveBatchId(null)}
                  onInspectJob={(j) => {
                    setActiveJob(j)
                    // activeBatchId is intentionally preserved so the user can easily return!
                  }}
                  onRefreshJobs={fetchJobsAndFolders}
                />
              ) : (
                <HowItWorksPanel />
              )
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}
