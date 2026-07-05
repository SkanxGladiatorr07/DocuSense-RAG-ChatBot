import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Dashboard = () => {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // State Management
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [deletingDocId, setDeletingDocId] = useState(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [uploadState, setUploadState] = useState({ loading: false, progress: '' })
  const [viewMode, setViewMode] = useState('chat') // 'chat' | 'analytics' | 'help' | 'support'

  // Notifications
  const [notifications] = useState([
    // Empty array = no notifications. Populate to show them.
    // Example: { id: 1, type: 'info', message: 'Your document was indexed.', time: '2m ago' }
  ])
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  // Sync viewMode with query params (?view=help / ?view=support)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const view = params.get('view')
    if (view && ['chat', 'analytics', 'help', 'support'].includes(view)) {
      setViewMode(view)
    }
  }, [location.search])

  // Loading & Error States
  
  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false)

  // Toast Notification System
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Textarea state
  const [inputText, setInputText] = useState('')

  // Refs
  const textareaRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  // Initial Fetches
  useEffect(() => {
    if (token) {
      fetchConversations()
      fetchDocuments()
      fetchAnalytics()
    }
  }, [token])

  // Handle Textarea Auto-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [inputText])

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loadingChat])

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000)
  }

  // ── API Fetchers ────────────────────────────────────────────────────────────

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations')
      setConversations(res.data.data.conversations || [])
    } catch (err) {
      showToast(err.message || 'Failed to fetch conversations', 'error')
    }
  }

  const fetchDocuments = async () => {
    setLoadingDocs(true)
    try {
      const res = await api.get('/documents')
      setDocuments(res.data.data.documents || [])
    } catch (err) {
      showToast(err.message || 'Failed to fetch documents', 'error')
    } finally {
      setLoadingDocs(false)
    }
  }

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const res = await api.get('/documents/analytics')
      setAnalytics(res.data.data || null)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const selectConversation = async (id) => {
    if (loadingHistory || loadingChat || uploadState.loading) return
    setActiveConversationId(id)
    setViewMode('chat')
    setLoadingHistory(true)
    try {
      const res = await api.get(`/conversations/${id}`)
      // Historical messages from the API have question/answer but no sources/isLoading.
      // Normalise them so the renderer always sees the same shape.
      const rawMessages = res.data.data.messages || []
      const normalisedMessages = rawMessages.map(msg => ({
        ...msg,
        sources: msg.sources || [],
        isLoading: false,
        isError: msg.isError || false,
      }))
      setMessages(normalisedMessages)
    } catch (err) {
      showToast(err.message || 'Failed to load chat history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleNewConversation = async () => {
    if (loadingHistory || loadingChat || uploadState.loading) return
    try {
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const title = `Chat — ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} (${timeStr})`
      const res = await api.post('/conversations', { title })
      const newConv = res.data.data.conversation
      setConversations(prev => [newConv, ...prev])
      setActiveConversationId(newConv._id)
      setMessages([])
      setViewMode('chat')
      showToast('New chat session created successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to create new chat', 'error')
    }
  }

  const handleClearChat = async () => {
    if (!activeConversationId || loadingHistory || loadingChat || uploadState.loading) return
    setConfirmArchive(true)
  }

  const handleConfirmArchive = async () => {
    setConfirmArchive(false)
    try {
      await api.delete(`/conversations/${activeConversationId}`)
      setConversations(prev => prev.filter(c => c._id !== activeConversationId))
      setActiveConversationId(null)
      setMessages([])
      showToast('Conversation archived successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to archive conversation', 'error')
    }
  }

  const handleDeleteConversation = async (convId) => {
    try {
      await api.delete(`/conversations/${convId}`)
      setConversations(prev => prev.filter(c => c._id !== convId))
      if (activeConversationId === convId) {
        setActiveConversationId(null)
        setMessages([])
      }
      showToast('Conversation archived successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to delete conversation', 'error')
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (uploadState.loading) return
    try {
      await api.delete(`/documents/${docId}`)
      setDocuments(prev => prev.filter(d => d._id !== docId))
      showToast('Document deleted successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to delete document', 'error')
    } finally {
      setDeletingDocId(null)
    }
  }

  // ── Ingestion Pipeline ──────────────────────────────────────────────────────

  const triggerIngestionPipeline = async (file) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!validTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.txt')) {
      showToast('Invalid file format. Please upload PDF, DOCX, or TXT documents.', 'error')
      return
    }

    setUploadState({ loading: true, progress: 'Uploading...' })

    const formData = new FormData()
    formData.append('document', file)

    try {
      // Step 1: Upload
      const uploadRes = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const doc = uploadRes.data.data.document
      const docId = doc._id

      // Refresh documents list to show "Uploaded"
      fetchDocuments()

      // Step 2: Extract Text (Process)
      setUploadState({ loading: true, progress: 'Extracting text...' })
      await api.post(`/documents/${docId}/process`)
      fetchDocuments()

      // Step 3: Segment Text (Chunk)
      setUploadState({ loading: true, progress: 'Segmenting document...' })
      await api.post(`/documents/${docId}/chunk`)

      // Step 4: Generate Vectors (Embed)
      setUploadState({ loading: true, progress: 'Generating vectors...' })
      await api.post(`/documents/${docId}/embed`)

      setUploadState({ loading: false, progress: '' })
      fetchDocuments()
      fetchAnalytics()
      showToast(`${file.name} fully processed and indexed successfully!`)
    } catch (err) {
      showToast(err.message || 'Ingestion pipeline failed.', 'error')
      setUploadState({ loading: false, progress: '' })
      fetchDocuments()
    }
  }

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await triggerIngestionPipeline(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (uploadState.loading) return
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (uploadState.loading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await triggerIngestionPipeline(files[0])
    }
  }

  // ── Chat sending ────────────────────────────────────────────────────────────

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || loadingChat || loadingHistory || uploadState.loading) return

    const questionText = inputText.trim()
    setInputText('')

    let currentConversationId = activeConversationId

    // 1. Create a conversation if none is active
    if (!currentConversationId) {
      try {
        const title = `Chat — ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
        const res = await api.post('/conversations', { title })
        const newConv = res.data.data.conversation
        setConversations(prev => [newConv, ...prev])
        currentConversationId = newConv._id
        setActiveConversationId(newConv._id)
      } catch (err) {
        showToast('Failed to auto-create conversation.', 'error')
        return
      }
    }

    // 2. Add local optimistic message block
    const tempMessage = {
      _id: Date.now().toString(),
      question: questionText,
      answer: '',
      isLoading: true
    }
    setMessages(prev => [...prev, tempMessage])
    setLoadingChat(true)

    try {
      const res = await api.post('/chat/ask', {
        question: questionText,
        conversationId: currentConversationId
      })

      const ragResult = res.data.data

      // Update state message with actual RAG result
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessage._id 
            ? {
                ...msg,
                answer: ragResult.answer,
                sources: ragResult.sources || [],
                citations: ragResult.citations || [],
                isLoading: false
              }
            : msg
        )
      )

      // Refresh conversations list to update messageCount/lastMessageAt
      fetchConversations()
    } catch (err) {
      showToast(err.message || 'Chat generation failed.', 'error')
      // Mark local message as error
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessage._id 
            ? { ...msg, answer: 'Sorry, I failed to generate an answer due to an error.', isError: true, isLoading: false }
            : msg
        )
      )
    } finally {
      setLoadingChat(false)
    }
  }

  // Render initials helper
  const getUserInitials = () => {
    if (!user?.name) return 'JD'
    const parts = user.name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return user.name.slice(0, 2).toUpperCase()
  }

  // Prevent interactions blocker
  const isActionPending = loadingChat || loadingHistory || uploadState.loading

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg transition-all animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="font-body-md text-body-md font-medium">{toast.message}</span>
        </div>
      )}

      {/* Hidden File Input for Document Ingestion */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".pdf,.docx,.txt"
        disabled={isActionPending}
      />

      {/* Sidebar Wrapper */}
      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-[280px] bg-surface dark:bg-on-background border-r border-outline-variant dark:border-outline hidden lg:flex flex-col p-4 space-y-6 z-40 ${
        isActionPending ? 'opacity-80' : ''
      }`}>
        {/* Organization Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>business_center</span>
          </div>
          <div>
            <h2 className="text-label-md font-bold text-on-surface">Enterprise RAG</h2>
            <p className="text-[10px] text-outline font-medium tracking-wider">V2.4.0</p>
          </div>
        </div>
        
        {/* Document Management Section */}
        <div className="flex flex-col space-y-4">
          <button 
            onClick={handleUploadClick}
            disabled={isActionPending}
            className="w-full py-3 px-4 bg-primary text-white rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {uploadState.loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="truncate">{uploadState.progress}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                Upload Document
              </>
            )}
          </button>
          
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[11px] font-bold text-outline uppercase tracking-widest">Recent Documents</p>
            <div className="flex flex-col space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar">
              {loadingDocs ? (
                // Document List Loading Skeleton
                <div className="space-y-2.5 px-2 py-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-outline-variant/40 rounded"></div>
                      <div className="flex-grow h-3 bg-outline-variant/40 rounded"></div>
                      <div className="w-8 h-3.5 bg-outline-variant/40 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <p className="text-[12px] text-outline italic px-2">No documents indexed yet.</p>
              ) : (
                documents.map(doc => (
                  <div key={doc._id} className="group flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 overflow-hidden w-2/3">
                      <span className={`material-symbols-outlined text-[20px] ${
                        doc.status === 'failed' ? 'text-red-400' : 'text-outline'
                      }`}>description</span>
                      <span className="text-body-md text-on-surface-variant truncate" title={doc.originalName}>
                        {doc.originalName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {doc.status}
                      </span>
                      {deletingDocId === doc._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc._id) }}
                              className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors flex flex-row items-center justify-center"
                              title="Confirm delete"
                            >
                              <span className="material-symbols-outlined text-[15px]">check</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingDocId(null) }}
                              className="p-0.5 text-red-600 hover:bg-red-50 rounded-md transition-colors flex flex-row items-center justify-center"
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined text-[15px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingDocId(doc._id) }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex flex-row items-center justify-center"
                            title="Delete document"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Conversations Management */}
        <div className="space-y-1">
          <div className="flex justify-between items-center px-2 pb-2">
            <p className="text-[11px] font-bold text-outline uppercase tracking-widest">Recent Chats</p>
            <button 
              onClick={handleNewConversation}
              disabled={isActionPending}
              className="hover:text-primary transition-colors flex items-center disabled:opacity-50"
              title="New Chat"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
            </button>
          </div>
          <div className="flex flex-col space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
            {conversations.map(conv => (
              <div key={conv._id} className="group relative flex items-center w-full">
                <button 
                  onClick={() => selectConversation(conv._id)}
                  disabled={isActionPending}
                  className={`flex-grow flex items-center justify-between p-2 rounded-xl transition-all text-left disabled:opacity-80 disabled:cursor-not-allowed pr-8 ${
                    activeConversationId === conv._id 
                      ? 'bg-primary-fixed text-on-primary-fixed border border-primary/10 font-medium' 
                      : 'hover:bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-[18px] text-outline">chat_bubble</span>
                    <span className="text-body-md truncate">{conv.title}</span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv._id);
                  }}
                  disabled={isActionPending}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-outline hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center disabled:opacity-0"
                  title="Archive Chat"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-[12px] text-outline italic px-2">No recent chats.</p>
            )}
          </div>
        </div>
        
        {/* Nav Navigation */}
        <div className="flex-grow flex flex-col space-y-1">
          <p className="px-2 pb-2 text-[11px] font-bold text-outline uppercase tracking-widest">Workspace</p>
          <button 
            disabled={isActionPending}
            onClick={() => setViewMode('analytics')}
            className={`flex w-full items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors text-left disabled:opacity-80 ${
              viewMode === 'analytics' 
                ? 'bg-secondary-container text-on-secondary-container' 
                : 'text-secondary hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-label-md text-label-md">Analytics</span>
          </button>
          <button 
            disabled={isActionPending}
            onClick={() => setViewMode('chat')}
            className={`flex w-full items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors text-left disabled:opacity-80 ${
              viewMode === 'chat' 
                ? 'bg-secondary-container text-on-secondary-container' 
                : 'text-secondary hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">chat</span>
            <span className="font-label-md text-label-md">Active Workspace</span>
          </button>
        </div>
        
        {/* Footer Links */}
        <div className="border-t border-outline-variant pt-4 flex flex-col space-y-1">
          {/* Help Button — Coming Soon tooltip */}
          <div className="relative group/help">
            <button
              onClick={() => setViewMode('help')}
              className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors font-label-md text-label-md ${
                viewMode === 'help'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-secondary hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">help</span>
              Help
            </button>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/help:opacity-100 transition-opacity duration-200">
              <div className="bg-zinc-900 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg border border-zinc-700">
                🚧 Coming Soon
              </div>
            </div>
          </div>
          {/* Support Button — Coming Soon tooltip */}
          <div className="relative group/support">
            <button
              onClick={() => setViewMode('support')}
              className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors font-label-md text-label-md ${
                viewMode === 'support'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-secondary hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">contact_support</span>
              Support
            </button>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/support:opacity-100 transition-opacity duration-200">
              <div className="bg-zinc-900 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg border border-zinc-700">
                🚧 Coming Soon
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      {viewMode === 'chat' ? (
        <main 
          onDragEnter={handleDragEnter}
          className="lg:ml-[280px] pt-16 h-screen flex flex-col relative animate-fade-in-up"
        >
          {/* Full Screen Drag & Drop Overlay */}
          {isDragging && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="absolute inset-0 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary z-50 flex flex-col items-center justify-center gap-4 transition-all duration-300 pointer-events-auto"
            >
              <span className="material-symbols-outlined text-[64px] text-primary animate-bounce">upload_file</span>
              <h3 className="font-headline-md text-headline-md text-primary font-bold">Drop document to upload</h3>
              <p className="font-body-md text-body-md text-outline">Supports PDF, DOCX, and TXT files</p>
            </div>
          )}

          {/* Chat Header */}
          <div className="h-14 border-b border-outline-variant bg-white flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="h-6 w-6 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                </div>
                <div className="h-6 w-6 rounded-full border-2 border-white bg-amber-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">folder</span>
                </div>
              </div>
              <h1 className="text-body-lg font-bold text-on-surface">
                {activeConversationId 
                  ? conversations.find(c => c._id === activeConversationId)?.title || 'Chat Workspace'
                  : 'Start a new conversation to ask questions'
                }
              </h1>
            </div>
            
            {activeConversationId && (
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1.5 text-secondary text-label-md font-medium hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  Export
                </button>
                <div className="h-4 w-[1px] bg-outline-variant"></div>
                <button 
                  onClick={handleClearChat}
                  disabled={isActionPending}
                  className="flex items-center gap-1.5 text-secondary text-label-md font-medium hover:text-error transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">archive</span>
                  Archive Chat
                </button>
              </div>
            )}
          </div>

          {/* Archive Confirmation Banner */}
          {confirmArchive && (
            <div className="flex items-center justify-between px-8 py-3 bg-amber-50 border-b border-amber-200">
              <span className="text-body-md text-amber-800 font-medium">Archive this conversation? Its history will be preserved but removed from your active chats.</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleConfirmArchive}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-label-md font-medium hover:bg-amber-700 transition-colors"
                >
                  Yes, Archive
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="px-4 py-1.5 bg-white border border-outline-variant text-secondary rounded-lg text-label-md font-medium hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {/* Chat Area */}
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto bg-surface-container-lowest p-8 custom-scrollbar"
          >
            <div className="max-w-4xl mx-auto space-y-10 pb-20">

              {/* Active Chat Session Separator */}
              <div className="flex items-center gap-4">
                <div className="h-[1px] flex-grow bg-outline-variant"></div>
                <span className="text-[11px] font-bold text-outline uppercase tracking-widest">Active Chat Session</span>
                <div className="h-[1px] flex-grow bg-outline-variant"></div>
              </div>

              {loadingHistory ? (
                // Chat Loading Skeleton
                <div className="space-y-8 animate-pulse">
                  {[1, 2].map(i => (
                    <div key={i} className="space-y-4">
                      <div className="flex justify-end items-start gap-4">
                        <div className="w-[50%] h-12 bg-outline-variant/30 rounded-2xl rounded-tr-none"></div>
                        <div className="w-8 h-8 bg-outline-variant/30 rounded-full"></div>
                      </div>
                      <div className="flex justify-start items-start gap-4">
                        <div className="w-8 h-8 bg-outline-variant/30 rounded-full"></div>
                        <div className="w-[70%] h-20 bg-outline-variant/30 rounded-2xl rounded-tl-none"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                // Empty state
                <div className="text-center py-20 space-y-4">
                  <span className="material-symbols-outlined text-outline text-[48px]">chat_bubble_outline</span>
                  <h3 className="font-headline-md text-headline-md text-on-surface">No messages here yet</h3>
                  <p className="font-body-md text-body-md text-secondary max-w-sm mx-auto">
                    Type a question below to start chatting with your enterprise document corpus. Or drag and drop documents directly here to upload them.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg._id} className="space-y-6">
                    {/* User Message */}
                    <div className="flex justify-end items-start gap-4">
                      <div className="max-w-[80%] bg-zinc-100 p-4 rounded-2xl rounded-tr-none border border-outline-variant/30">
                        <p className="text-body-md text-on-surface whitespace-pre-wrap">{msg.question}</p>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-bold text-on-secondary-fixed">{getUserInitials()}</span>
                      </div>
                    </div>
                    
                    {/* AI Message */}
                    <div className="flex justify-start items-start gap-4">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      </div>
                      <div className="max-w-[85%] space-y-4">
                        <div className={`bg-white p-6 rounded-2xl rounded-tl-none border shadow-sm prose prose-zinc max-w-none ${
                          msg.isError ? 'border-error/20 bg-error-container/10' : 'border-outline-variant'
                        }`}>
                          {msg.isLoading ? (
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </div>
                              <span className="text-outline text-body-md">Thinking...</span>
                            </div>
                          ) : (
                            <p className="text-body-lg text-on-surface leading-relaxed whitespace-pre-wrap">{msg.answer}</p>
                          )}
                        </div>
                        
                        {/* Citations Footer */}
                        {!msg.isLoading && msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-label-md text-outline font-bold uppercase tracking-tighter mr-2">Sources:</span>
                            {msg.sources.map((src, index) => (
                              <div key={index} className="flex items-center gap-1.5 px-3 py-1 bg-surface-container border border-outline-variant rounded-full cursor-pointer hover:bg-primary-fixed transition-colors">
                                <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                                <span className="font-code text-code text-primary truncate max-w-[150px]">
                                  {src.originalName || 'Document'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Action Bar */}
                        {!msg.isLoading && (
                          <div className="flex items-center gap-4 px-2">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(msg.answer)
                                showToast('Answer copied to clipboard!')
                              }}
                              className="p-1.5 text-outline hover:text-primary hover:bg-surface-container rounded-md transition-all"
                              title="Copy Answer"
                            >
                              <span className="material-symbols-outlined text-[20px]">content_copy</span>
                            </button>
                            <button className="p-1.5 text-outline hover:text-emerald-600 hover:bg-surface-container rounded-md transition-all">
                              <span className="material-symbols-outlined text-[20px]">thumb_up</span>
                            </button>
                            <button className="p-1.5 text-outline hover:text-error hover:bg-surface-container rounded-md transition-all">
                              <span className="material-symbols-outlined text-[20px]">thumb_down</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {/* Reference point for smooth scrolling */}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Panel */}
          <div className="border-t border-outline-variant bg-white p-6 shrink-0 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.1)]">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSendMessage} className="relative group">
                <div className="absolute inset-0 bg-primary/5 rounded-2xl -m-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <div className="relative bg-white border border-outline-variant rounded-2xl p-3 focus-within:border-primary transition-all ring-primary/20 focus-within:ring-4">
                  <textarea 
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
                    disabled={isActionPending}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage(e)
                      }
                    }}
                    className="w-full resize-none border-none focus:ring-0 text-body-lg text-on-surface placeholder:text-outline/60 outline-none disabled:opacity-50" 
                    placeholder={isActionPending ? 'Please wait...' : 'Ask a question about your documents...'} 
                    rows="2"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={handleUploadClick} 
                        disabled={isActionPending}
                        className="p-2 text-outline hover:bg-surface-container rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined">attach_file</span>
                        <span className="text-label-md">Attach</span>
                      </button>
                      <button 
                        type="button" 
                        disabled={isActionPending}
                        className="p-2 text-outline hover:bg-surface-container rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined">language</span>
                        <span className="text-label-md">Web Search</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[11px] font-medium ${ inputText.length >= 1900 ? 'text-red-500' : 'text-outline' }`}>{inputText.length} / 2000</span>
                      <button 
                        type="submit"
                        disabled={isActionPending || !inputText.trim()}
                        className="bg-primary text-white p-2.5 rounded-xl flex items-center justify-center hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined">send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
              <p className="mt-3 text-center text-label-md text-outline">
                AI can make mistakes. Verify citations. Powered by <span className="font-bold text-primary">DocuSense Enterprise AI</span>.
              </p>
            </div>
          </div>
        </main>

      ) : viewMode === 'help' ? (
        /* ── Help Page ── */
        <main className="lg:ml-[280px] pt-16 h-screen flex flex-col overflow-y-auto bg-surface-container-lowest p-8 animate-fade-in-up">
          <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
            <div className="flex justify-between items-center border-b border-outline-variant pb-4">
              <div>
                <h1 className="text-headline-md font-bold text-on-surface">Help Center</h1>
                <p className="text-body-md text-secondary">Guides and documentation for using DocuSense</p>
              </div>
              <button onClick={() => setViewMode('chat')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
            </div>

            {/* Coming Soon Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 p-10 flex flex-col items-center text-center gap-6">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-white border border-outline-variant shadow-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[12px] font-bold mb-3">
                  <span className="material-symbols-outlined text-[14px]">construction</span>
                  Coming Soon
                </div>
                <h2 className="text-headline-md font-bold text-on-surface">Full Help Documentation</h2>
                <p className="text-body-md text-secondary mt-2 max-w-lg">Our complete help center is under construction. In the meantime, here are quick guides to get you started.</p>
              </div>
            </div>

            {/* Quick Start Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: 'upload_file', title: 'Uploading Documents', desc: 'Click "Upload Document" in the sidebar or drag-and-drop a PDF, DOCX, or TXT file directly onto the chat area. Files up to 50 MB are supported.', color: 'text-blue-600', bg: 'bg-blue-50' },
                { icon: 'auto_awesome', title: 'Asking Questions', desc: 'Once a document is indexed (green status), type any question in the chat box. DocuSense will retrieve the most relevant passages and generate a grounded answer.', color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: 'analytics', title: 'Understanding Analytics', desc: 'The Analytics view shows your total document count, average chunks per document, and processing status breakdown so you can monitor your corpus health.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { icon: 'history', title: 'Managing Chat History', desc: 'All Q&A sessions are auto-saved to conversations. Switch between them in the sidebar. Archive a session using the "Archive Chat" button in the chat header.', color: 'text-amber-600', bg: 'bg-amber-50' },
                { icon: 'delete', title: 'Deleting Documents', desc: 'Hover over a document in the sidebar to reveal the delete icon. Click it and confirm with the green checkmark. This removes the file and all its indexed chunks.', color: 'text-red-600', bg: 'bg-red-50' },
                { icon: 'security', title: 'Privacy & Security', desc: 'All documents are stored locally in your deployment. Embeddings use Google Gemini API. Text generation uses Groq (LLaMA 3.3 70B). No data is shared externally.', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              ].map((item) => (
                <div key={item.title} className="p-5 bg-white border border-outline-variant rounded-2xl shadow-sm flex gap-4 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[22px] ${item.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface text-body-lg">{item.title}</h3>
                    <p className="text-body-md text-secondary mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

      ) : viewMode === 'support' ? (
        /* ── Support Page ── */
        <main className="lg:ml-[280px] pt-16 h-screen flex flex-col overflow-y-auto bg-surface-container-lowest p-8 animate-fade-in-up">
          <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
            <div className="flex justify-between items-center border-b border-outline-variant pb-4">
              <div>
                <h1 className="text-headline-md font-bold text-on-surface">Support</h1>
                <p className="text-body-md text-secondary">Get help from the DocuSense team</p>
              </div>
              <button onClick={() => setViewMode('chat')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
            </div>

            {/* Coming Soon Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 border border-teal-100 p-10 flex flex-col items-center text-center gap-6">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-white border border-outline-variant shadow-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-teal-600 text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>support_agent</span>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[12px] font-bold mb-3">
                  <span className="material-symbols-outlined text-[14px]">construction</span>
                  Coming Soon
                </div>
                <h2 className="text-headline-md font-bold text-on-surface">Live Support Portal</h2>
                <p className="text-body-md text-secondary mt-2 max-w-lg">Our ticketing and live-chat support system is being built. Until then, use the channels below to reach us.</p>
              </div>
            </div>

            {/* Contact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: 'code', title: 'GitHub Issues', desc: 'Report bugs, request features, or browse existing issues on our repository.', action: 'Open GitHub', href: 'https://github.com/SkanxGladiatorr07/DocuSense-RAG-ChatBot/issues', color: 'text-[#2da44e]', bg: 'bg-zinc-900', border: 'border-zinc-700' },
                { icon: 'mail', title: 'Email Support', desc: 'Send a detailed description of your issue and we will get back within 48 hours.', action: 'Send Email', href: 'mailto:support@docusense.ai', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { icon: 'forum', title: 'Community Forum', desc: 'Ask questions, share tips, and learn from other DocuSense users in our community.', action: 'Join Forum', href: '#', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
              ].map((item) => (
                <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
                  className={`p-6 ${item.bg} border ${item.border} rounded-2xl shadow-sm flex flex-col gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 group`}>
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <span className={`material-symbols-outlined text-[24px] ${item.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <div>
                    <h3 className={`font-bold text-[15px] ${item.bg === 'bg-zinc-900' ? 'text-white' : 'text-on-surface'}`}>{item.title}</h3>
                    <p className={`text-[13px] mt-1 leading-relaxed ${item.bg === 'bg-zinc-900' ? 'text-zinc-400' : 'text-secondary'}`}>{item.desc}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[13px] font-bold mt-auto ${item.color} group-hover:underline`}>
                    {item.action}
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </div>
                </a>
              ))}
            </div>

            {/* FAQ */}
            <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-title-md text-on-surface">Frequently Asked Questions</h3>
              {[
                { q: 'Is it free?', a: 'Yes! Currently, DocuSense is completely free to use during our public preview.' },
                { q: 'Why does my document show "failed" status?', a: 'This usually means the embedding step hit API rate limits. Delete the document, wait 60 seconds, and re-upload. With batch embedding (100 chunks per request), most documents index in under 5 seconds.' },
                { q: 'Which file formats are supported?', a: 'DocuSense supports PDF, DOCX, and TXT files up to 50 MB each. Scanned PDFs without an OCR text layer may not extract text correctly.' },
                { q: 'Can I search across multiple documents?', a: 'Yes. Leave the document filter empty in the chat to search your entire indexed corpus. You can also restrict search to a specific document.' },
                { q: 'How accurate are the AI answers?', a: 'Answers are grounded strictly in your uploaded documents. The LLM is instructed not to hallucinate. Low confidence scores (< 0.5) indicate weak semantic matches.' },
              ].map((faq, i) => (
                <details key={i} className="group border border-outline-variant rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-surface-container-low transition-colors">
                    <span className="font-medium text-on-surface text-body-md">{faq.q}</span>
                    <span className="material-symbols-outlined text-outline text-[20px] group-open:rotate-180 transition-transform duration-200">expand_more</span>
                  </summary>
                  <div className="px-4 pb-4 text-body-md text-secondary leading-relaxed">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </main>

      ) : (
        /* ── Analytics View ── */
        <main className="lg:ml-[280px] pt-16 h-screen flex flex-col overflow-y-auto bg-surface-container-lowest p-8 animate-fade-in-up">
          <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
            <div className="flex justify-between items-center border-b border-outline-variant pb-4">
              <div>
                <h1 className="text-headline-md font-bold text-on-surface">Document Analytics</h1>
                <p className="text-body-md text-secondary">Overview of user-specific document storage and parsing performance</p>
              </div>
              <button 
                onClick={() => setViewMode('chat')}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Back to Workspace
              </button>
            </div>

            {loadingAnalytics ? (
              // Analytics Loading Skeleton
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-6 bg-white border border-outline-variant rounded-2xl h-40 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-24 h-4 bg-outline-variant/40 rounded"></div>
                      <div className="w-6 h-6 bg-outline-variant/40 rounded-full"></div>
                    </div>
                    <div className="w-16 h-10 bg-outline-variant/40 rounded mt-4"></div>
                    <div className="w-32 h-3.5 bg-outline-variant/40 rounded mt-2"></div>
                  </div>
                ))}
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Cards */}
                <div className="p-6 bg-white border border-outline-variant rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-outline font-label-md uppercase tracking-wider">Total Documents</span>
                    <span className="material-symbols-outlined text-primary text-[24px]">folder</span>
                  </div>
                  <h2 className="text-display font-display text-on-surface mt-4">{analytics.totalDocuments}</h2>
                  <p className="text-body-md text-secondary mt-2">Active documents in your catalog</p>
                </div>

                <div className="p-6 bg-white border border-outline-variant rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-outline font-label-md uppercase tracking-wider">Avg Chunks / Doc</span>
                    <span className="material-symbols-outlined text-primary text-[24px]">segment</span>
                  </div>
                  <h2 className="text-display font-display text-on-surface mt-4">{analytics.averageChunksPerDocument}</h2>
                  <p className="text-body-md text-secondary mt-2">Granularity density for vector searches</p>
                </div>

                <div className="p-6 bg-white border border-outline-variant rounded-2xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-outline font-label-md uppercase tracking-wider">Status Breakdown</span>
                    <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-1 text-body-md font-medium text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Indexed</span>
                      <span className="text-emerald-600 font-bold">{analytics.documentsByStatus.indexed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing</span>
                      <span className="text-amber-600 font-bold">{analytics.documentsByStatus.processing}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploaded</span>
                      <span className="text-blue-600 font-bold">{analytics.documentsByStatus.uploaded}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed</span>
                      <span className="text-red-600 font-bold">{analytics.documentsByStatus.failed}</span>
                    </div>
                  </div>
                </div>

                {/* Largest Document Detail */}
                {analytics.largestDocument ? (
                  <div className="col-span-1 md:col-span-3 p-6 bg-white border border-outline-variant rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-title-md text-title-md text-on-surface">Largest Document Overview</h3>
                    <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <span className="material-symbols-outlined text-primary text-[32px]">description</span>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-on-surface truncate max-w-lg">{analytics.largestDocument.originalName}</h4>
                          <p className="text-outline text-body-md font-code">
                           {((analytics.largestDocument.fileSize || 0) / 1024).toFixed(1)} KB | {analytics.largestDocument.fileType}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full font-label-md font-bold uppercase shrink-0 ${
                          analytics.largestDocument.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' :
                          analytics.largestDocument.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                        {analytics.largestDocument.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-1 md:col-span-3 p-10 bg-white border border-dashed border-outline-variant rounded-2xl text-center text-outline">
                    No documents uploaded yet to compute size metrics.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-outline">No analytics data available.</div>
            )}
          </div>
        </main>
      )}
    </>
  )
}

export default Dashboard
