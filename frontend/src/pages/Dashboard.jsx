import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Dashboard = () => {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  // State Management
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [viewMode, setViewMode] = useState('chat') // 'chat' or 'analytics'

  // Loading & Error States
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [uploadState, setUploadState] = useState({ loading: false, progress: '' })
  
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
      setConversations(res.data.conversations || [])
    } catch (err) {
      showToast(err.message || 'Failed to fetch conversations', 'error')
    }
  }

  const fetchDocuments = async () => {
    setLoadingDocs(true)
    try {
      const res = await api.get('/documents')
      setDocuments(res.data.documents || [])
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
      setAnalytics(res.data || null)
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
      setMessages(res.data.messages || [])
    } catch (err) {
      showToast(err.message || 'Failed to load chat history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleNewConversation = async () => {
    if (loadingHistory || loadingChat || uploadState.loading) return
    try {
      const title = `Chat — ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
      const res = await api.post('/conversations', { title })
      const newConv = res.data.conversation
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
    if (!window.confirm('Are you sure you want to archive this chat?')) return
    
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
        const newConv = res.data.conversation
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
                      <span className="material-symbols-outlined text-outline">description</span>
                      <span className="text-body-md text-on-surface-variant truncate" title={doc.originalName}>
                        {doc.originalName}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                      doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' :
                      doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {doc.status}
                    </span>
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
              <button 
                key={conv._id} 
                onClick={() => selectConversation(conv._id)}
                disabled={isActionPending}
                className={`group flex w-full items-center justify-between p-2 rounded-xl transition-colors text-left disabled:opacity-80 disabled:cursor-not-allowed ${
                  activeConversationId === conv._id 
                    ? 'bg-primary-fixed text-on-primary-fixed border border-primary/10' 
                    : 'hover:bg-surface-container text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-[18px] text-outline">chat_bubble</span>
                  <span className="text-body-md truncate">{conv.title}</span>
                </div>
              </button>
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
            <span className="font-label-md text-label-md">Analytic</span>
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
          <Link to="#" className="text-secondary text-label-md font-label-md flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg transition-colors">
            <span className="material-symbols-outlined text-[20px]">help</span>
            Help
          </Link>
          <Link to="#" className="text-secondary text-label-md font-label-md flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg transition-colors">
            <span className="material-symbols-outlined text-[20px]">contact_support</span>
            Support
          </Link>
        </div>
      </aside>

      {/* Main Content Canvas */}
      {viewMode === 'chat' ? (
        <main 
          onDragEnter={handleDragEnter}
          className="lg:ml-[280px] pt-16 h-screen flex flex-col relative"
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
                    onChange={(e) => setInputText(e.target.value)}
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
                      <span className="text-[11px] text-outline font-medium">{inputText.length} / 2000</span>
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
      ) : (
        /* Analytics View */
        <main className="lg:ml-[280px] pt-16 h-screen flex flex-col overflow-y-auto bg-surface-container-lowest p-8">
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
                            {(analytics.largestDocument.fileSize / 1024).toFixed(1)} KB | {analytics.largestDocument.fileType}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-label-md font-bold uppercase shrink-0">
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
