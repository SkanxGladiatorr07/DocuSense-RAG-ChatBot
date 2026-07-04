import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const [inputText, setInputText] = useState('')
  const textareaRef = useRef(null)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [inputText])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  return (
    <>
      {/* Sidebar Wrapper */}
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-[280px] bg-surface dark:bg-on-background border-r border-outline-variant dark:border-outline hidden lg:flex flex-col p-4 space-y-6 z-40">
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
          <button className="w-full py-3 px-4 bg-primary text-white rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Upload Document
          </button>
          
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[11px] font-bold text-outline uppercase tracking-widest">Recent Documents</p>
            <div className="flex flex-col space-y-1">
              <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-outline">description</span>
                  <span className="text-body-md text-on-surface-variant truncate">Q4_Financials.pdf</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Indexed</span>
              </div>
              <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-outline">description</span>
                  <span className="text-body-md text-on-surface-variant truncate">HR_Handbook.docx</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Processing</span>
              </div>
              <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-outline">description</span>
                  <span className="text-body-md text-on-surface-variant truncate">Legal_Terms_v2.pdf</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Indexed</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Nav Navigation */}
        <div className="flex-grow flex flex-col space-y-1">
          <p className="px-2 pb-2 text-[11px] font-bold text-outline uppercase tracking-widest">Workspace</p>
          <div className="bg-secondary-container dark:bg-on-secondary-fixed-variant text-on-secondary-container dark:text-on-secondary-fixed rounded-xl flex items-center gap-3 p-3 cursor-default">
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-label-md text-label-md">Analytic</span>
          </div>
          <Link to="#" className="text-secondary dark:text-secondary-fixed-dim hover:bg-surface-container-low transition-colors flex items-center gap-3 p-3 rounded-xl group">
            <span className="material-symbols-outlined group-hover:text-primary transition-colors">folder_shared</span>
            <span className="font-label-md text-label-md">Collections</span>
          </Link>
          <Link to="#" className="text-secondary dark:text-secondary-fixed-dim hover:bg-surface-container-low transition-colors flex items-center gap-3 p-3 rounded-xl group">
            <span className="material-symbols-outlined group-hover:text-primary transition-colors">history</span>
            <span className="font-label-md text-label-md">History</span>
          </Link>
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
      <main className="lg:ml-[280px] pt-16 h-screen flex flex-col">
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
            <h1 className="text-body-lg font-bold text-on-surface">Chatting across all documents</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-secondary text-label-md font-medium hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">share</span>
              Export
            </button>
            <div className="h-4 w-[1px] bg-outline-variant"></div>
            <button className="flex items-center gap-1.5 text-secondary text-label-md font-medium hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">clear_all</span>
              Clear Chat
            </button>
          </div>
        </div>
        
        {/* Chat Area */}
        <div 
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto bg-surface-container-lowest p-8 custom-scrollbar"
        >
          <div className="max-w-4xl mx-auto space-y-10 pb-20">
            {/* Date Separator */}
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-grow bg-outline-variant"></div>
              <span className="text-[11px] font-bold text-outline uppercase tracking-widest">Today, October 24</span>
              <div className="h-[1px] flex-grow bg-outline-variant"></div>
            </div>
            
            {/* User Message */}
            <div className="flex justify-end items-start gap-4">
              <div className="max-w-[80%] bg-zinc-100 p-4 rounded-2xl rounded-tr-none border border-outline-variant/30">
                <p className="text-body-md text-on-surface">What are the Q4 revenue targets for the APAC region according to the financial summary?</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-on-secondary-fixed">JD</span>
              </div>
            </div>
            
            {/* AI Message */}
            <div className="flex justify-start items-start gap-4">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div className="max-w-[85%] space-y-4">
                <div className="bg-white p-6 rounded-2xl rounded-tl-none border border-outline-variant shadow-sm prose prose-zinc max-w-none">
                  <p className="text-body-lg text-on-surface leading-relaxed">
                    Based on the <strong>Q4_Financials.pdf</strong> document, the revenue targets for the APAC region are structured as follows:
                  </p>
                  <ul className="list-disc pl-5 mt-3 space-y-2 text-body-md text-on-surface-variant">
                    <li><strong>Primary Target:</strong> $14.2M in recurring software subscriptions.</li>
                    <li><strong>Growth Objective:</strong> 18% YoY increase compared to Q4 of the previous fiscal year.</li>
                    <li><strong>High-Priority Market:</strong> Southeast Asia (specifically Singapore and Vietnam) is expected to contribute 40% of the total regional target.</li>
                  </ul>
                  <p className="mt-4 text-body-md text-on-surface-variant italic">
                    Note: These figures are contingent on the finalization of the Enterprise Licensing Agreement with regional partners.
                  </p>
                </div>
                
                {/* Citations Footer */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-label-md text-outline font-bold uppercase tracking-tighter mr-2">Sources:</span>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container border border-outline-variant rounded-full cursor-pointer hover:bg-primary-fixed transition-colors">
                    <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                    <span className="font-code text-code text-primary">Q4_Financials.pdf</span>
                    <span className="text-code text-outline ml-1">p. 12</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container border border-outline-variant rounded-full cursor-pointer hover:bg-primary-fixed transition-colors">
                    <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                    <span className="font-code text-code text-primary">Regional_Strategy_2024.docx</span>
                    <span className="text-code text-outline ml-1">p. 4</span>
                  </div>
                </div>
                
                {/* Action Bar */}
                <div className="flex items-center gap-4 px-2">
                  <button className="p-1.5 text-outline hover:text-primary hover:bg-surface-container rounded-md transition-all">
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </button>
                  <button className="p-1.5 text-outline hover:text-emerald-600 hover:bg-surface-container rounded-md transition-all">
                    <span className="material-symbols-outlined text-[20px]">thumb_up</span>
                  </button>
                  <button className="p-1.5 text-outline hover:text-error hover:bg-surface-container rounded-md transition-all">
                    <span className="material-symbols-outlined text-[20px]">thumb_down</span>
                  </button>
                  <button className="p-1.5 text-outline hover:text-primary hover:bg-surface-container rounded-md transition-all">
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Input Panel */}
        <div className="border-t border-outline-variant bg-white p-6 shrink-0 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.1)]">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 rounded-2xl -m-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
              <div className="relative bg-white border border-outline-variant rounded-2xl p-3 focus-within:border-primary transition-all ring-primary/20 focus-within:ring-4">
                <textarea 
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full resize-none border-none focus:ring-0 text-body-lg text-on-surface placeholder:text-outline/60 outline-none" 
                  placeholder="Ask a question about your documents..." 
                  rows="2"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-outline hover:bg-surface-container rounded-lg transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined">attach_file</span>
                      <span className="text-label-md">Attach</span>
                    </button>
                    <button className="p-2 text-outline hover:bg-surface-container rounded-lg transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined">language</span>
                      <span className="text-label-md">Web Search</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-outline font-medium">{inputText.length} / 2000</span>
                    <button className="bg-primary text-white p-2.5 rounded-xl flex items-center justify-center hover:shadow-lg active:scale-95 transition-all">
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-label-md text-outline">
              AI can make mistakes. Verify citations. Powered by <span className="font-bold text-primary">DocuSense Enterprise AI</span>.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}

export default Dashboard
