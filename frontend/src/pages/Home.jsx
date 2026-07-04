import { Link } from 'react-router-dom'

const Home = () => {
  return (
    <>
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 px-6">
          <div className="absolute top-0 right-0 -z-10 w-1/2 h-full opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-l from-primary/30 to-transparent blur-3xl rounded-full"></div>
          </div>
          
          <div className="max-w-container-max mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed border border-on-primary-fixed-variant/10">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="font-label-md text-label-md">Next-Gen RAG Architecture</span>
              </div>
              <h1 className="font-display text-display tracking-tight text-on-surface">
                Chat with your <br />
                <span className="text-primary">Company Documents</span>
              </h1>
              <p className="font-body-lg text-body-lg text-secondary max-w-xl leading-relaxed">
                Unlock organizational intelligence with Retrieval-Augmented Generation. Connect your data silos and get grounded, hallucination-free answers cited directly from your internal sources.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Link to="/dashboard" className="px-8 py-3 bg-primary text-on-primary font-title-md text-title-md rounded-xl hover:bg-on-primary-fixed-variant transition-all active:scale-[0.98] shadow-lg shadow-primary/10">
                  Open Dashboard
                </Link>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-surface border border-outline-variant text-on-surface font-title-md text-title-md rounded-xl hover:bg-surface-container transition-all active:scale-[0.98] flex items-center gap-2">
                  <span className="material-symbols-outlined">code</span>
                  View on GitHub
                </a>
              </div>
              
              <div className="flex items-center gap-6 pt-8 border-t border-outline-variant/30">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
                    <img className="w-full h-full object-cover" alt="User 1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdIJqVId9w38PK6L40yotYxOGa8hKp-u-HlJqtFX8ntTLGNd5aN2qoX6GshE9LbuP9bs6AI2aJdOgtl5ILhOQMBZEGU_z7nnBrTxJc22RFH2XWHjMJN47-QP1aNl3Ehfh2gkDhSC7IksreBl5eKBMTKcjHNy2ekMusS4WqEelSfZnrMWPYswGfkI4wC-ThHXWM7CNIhseR5_h3UVRzt6TCLLNQX9V26UMIO30BXpZjFG-LSDaz6hV-9w" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-300 overflow-hidden">
                    <img className="w-full h-full object-cover" alt="User 2" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI1G453UpuQNIDu9K083MiQH8na055nAwOCBmOD2IPTCY6Oes3BX3VrYEjuo_UQSun6AR9aERSKZKiTJYYtjNb6RoshzRzZhxECk7DE3oAVfuM_jHf25aPqgpX9Ht3fbS8xS43Sv0136D0NJ-5HkMi1yVu9wIAObBf1IjcqRonoYbJRfmLSL7PSC5VfAm7tjZhScZjGxfXlj86wjKfCtYkm-FmaIh56QyuZRt5MJex8KXkxlUi10X0Sg" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-400 overflow-hidden">
                    <img className="w-full h-full object-cover" alt="User 3" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBjcxKNGSqwpBcFvi6HD9VElHDsPkObAnTtOPjTIxKsK_SL-n9SmFWN8NrrmA896OVk-dMw683yIJXxDPTkO2RsukMofRStX0_LXrET5FksSz9hiuLXpnvl4UORDHNaSXPL3557wPeC3-HxnEPmq_shEulx4mQWa-p4PEa8XWmradfWI85rqmgVeHlBbs_6RJXRRczSdQcEej84N0gsfBNQ2OZzKtAvE8wjJwB_oFt4PLbacd06W9wkQ" />
                  </div>
                </div>
                <p className="font-label-md text-label-md text-secondary">
                  Trusted by <span className="font-bold text-on-surface">2,400+</span> enterprise teams worldwide.
                </p>
              </div>
            </div>
            
            <div className="relative lg:h-[600px] flex items-center justify-center">
              <div className="relative w-full max-w-lg">
                <div className="bg-white/70 backdrop-blur-md border border-zinc-200/50 p-6 rounded-2xl shadow-2xl relative z-10">
                  <div className="flex items-center justify-between mb-6 border-b border-outline-variant pb-4">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                    </div>
                    <span className="text-label-md font-label-md text-outline">docusense_query.v2</span>
                  </div>
                  <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px]">person</span>
                      </div>
                      <div className="bg-surface-container-low p-4 rounded-xl rounded-tl-none border border-outline-variant">
                        <p className="font-body-md text-body-md">What's our policy on remote work for Q3?</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center flex-shrink-0 text-on-primary-container">
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                      </div>
                      <div className="p-4 rounded-xl rounded-tl-none border border-primary/20 space-y-3">
                        <p className="font-body-md text-body-md leading-relaxed">According to the <span className="text-primary font-medium underline">Employee_Handbook_2024.pdf [1]</span>, employees can work remotely up to 3 days per week starting July 1st.</p>
                        <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                          <span className="font-label-md text-label-md text-outline">Sources:</span>
                          <span className="px-2 py-0.5 rounded-full border border-outline-variant font-code text-code text-outline bg-surface-container-lowest">Doc #1024</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -top-12 -right-12 bg-white/70 backdrop-blur-md border border-zinc-200/50 p-4 rounded-xl shadow-xl z-20 hidden md:block">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    <div>
                      <p className="font-label-md text-label-md text-outline">Indexing Speed</p>
                      <p className="font-title-md text-title-md font-bold">1.2 GB/sec</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-10 -left-12 bg-white/70 backdrop-blur-md border border-zinc-200/50 p-4 rounded-xl shadow-xl z-20 hidden md:block">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="font-label-md text-label-md font-medium">99.8% Accuracy Score</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="py-32 px-6 bg-surface-container-low/30">
          <div className="max-w-container-max mx-auto">
            <div className="text-center mb-20 space-y-4">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Precision-Engineered Intelligence</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-2xl mx-auto">
                DocuSense leverages sophisticated vector search and large language models to turn static documents into interactive conversations.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl border border-outline-variant bg-surface hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined text-[28px]">upload_file</span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface mb-3">Upload Documents</h3>
                <p className="font-body-md text-body-md text-secondary leading-relaxed mb-6">
                  Native support for PDFs, Word documents, Markdown, and text files. Our ingestion pipeline handles OCR and complex table parsing automatically.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Multi-format ingestion
                  </li>
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Cloud storage sync
                  </li>
                </ul>
              </div>
              
              <div className="p-8 rounded-2xl border border-outline-variant bg-surface hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined text-[28px]">manage_search</span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface mb-3">Semantic Search</h3>
                <p className="font-body-md text-body-md text-secondary leading-relaxed mb-6">
                  Beyond keyword matching. We use state-of-the-art vector embeddings to understand the intent and context of your queries.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Vector-space clustering
                  </li>
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Metadata filtering
                  </li>
                </ul>
              </div>
              
              <div className="p-8 rounded-2xl border border-outline-variant bg-surface hover:shadow-xl transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined text-[28px]">chat_bubble</span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface mb-3">AI-Powered Answers</h3>
                <p className="font-body-md text-body-md text-secondary leading-relaxed mb-6">
                  Grounded answers backed by verifiable citations. Every claim made by the AI includes a direct link to the source document for auditability.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Grounded generation
                  </li>
                  <li className="flex items-center gap-2 text-label-md font-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    Audit trail citations
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Integration Section */}
        <section className="py-32 px-6">
          <div className="max-w-container-max mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[600px]">
              <div className="md:col-span-2 md:row-span-2 rounded-2xl border border-outline-variant overflow-hidden relative group min-h-[300px]">
                <div className="absolute inset-0 bg-gradient-to-t from-on-background/80 to-transparent z-10"></div>
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Futuristic data center" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAM3u6TbnIJlUkOKcaVh0Tinyq6Den1VH_TjCokTWXuDTTzUTbqP51_0LdORcxX6eSkxHKa3H7AuasBoH8kQuFSLlm6Ku9aFa1z8XcLKt_dTfx3uSjuViAOPWaNuf_FQ4jIc7yLHUbPu0BRwzXXNuJQQTY8vlB-lr-eXqyyE-8QT0y9Wz2W5V8GoPp0JHdLDnoz7xLyT3YASm-E3hwfPogKk1KGi7gXW-zkGDPs_r83PIO4SN9SiIgQwg" />
                <div className="absolute bottom-8 left-8 z-20 text-white">
                  <h4 className="font-headline-md text-headline-md mb-2">Secure Core Infrastructure</h4>
                  <p className="font-body-md text-body-md text-zinc-300 max-w-sm">Enterprise-grade security with SOC2 compliance and end-to-end encryption for all document fragments.</p>
                </div>
              </div>
              <div className="md:col-span-2 bg-surface-container rounded-2xl border border-outline-variant p-8 flex flex-col justify-between min-h-[200px]">
                <div>
                  <span className="material-symbols-outlined text-primary text-[32px] mb-4">hub</span>
                  <h4 className="font-title-md text-title-md text-on-surface mb-2">Seamless Integration</h4>
                  <p className="font-body-md text-body-md text-secondary">Connect to Slack, Notion, and Google Drive in minutes with our native connectors.</p>
                </div>
                <div className="flex gap-4 mt-4 md:mt-0">
                  <div className="w-10 h-10 rounded-lg bg-white border border-outline-variant flex items-center justify-center">
                    <span className="material-symbols-outlined">share</span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white border border-outline-variant flex items-center justify-center">
                    <span className="material-symbols-outlined">cloud</span>
                  </div>
                </div>
              </div>
              <div className="md:col-span-1 bg-primary text-on-primary rounded-2xl p-8 flex flex-col justify-center text-center min-h-[200px]">
                <p className="text-display font-display leading-none mb-1">0.3s</p>
                <p className="font-label-md text-label-md uppercase tracking-wider opacity-80">Latency</p>
              </div>
              <div className="md:col-span-1 border border-outline-variant rounded-2xl p-8 flex flex-col justify-center text-center bg-surface min-h-[200px]">
                <p className="text-display font-display leading-none mb-1 text-on-surface">50M+</p>
                <p className="font-label-md text-label-md uppercase tracking-wider text-outline">Docs Indexed</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 bg-on-background text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
          </div>
          <div className="max-w-container-max mx-auto text-center relative z-10">
            <h2 className="font-display text-display mb-6">Ready to talk to your data?</h2>
            <p className="font-body-lg text-body-lg text-zinc-400 mb-10 max-w-xl mx-auto">
              Deploy DocuSense in your infrastructure or use our managed cloud. Start your 14-day free trial today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <button className="px-10 py-4 bg-primary rounded-xl font-title-md text-title-md hover:bg-on-primary-fixed-variant transition-all shadow-xl shadow-primary/20">
                Get Started Free
              </button>
              <button className="px-10 py-4 border border-zinc-700 rounded-xl font-title-md text-title-md hover:bg-zinc-800 transition-all">
                Schedule Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface py-16 px-6 border-t border-outline-variant">
        <div className="max-w-container-max mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-1 space-y-4">
            <span className="text-title-md font-title-md font-bold text-primary">DocuSense</span>
            <p className="font-body-md text-body-md text-secondary">Advanced retrieval systems for the modern enterprise.</p>
            <div className="flex gap-4">
              <a className="text-secondary hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">public</span></a>
              <a className="text-secondary hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">terminal</span></a>
            </div>
          </div>
          <div>
            <h5 className="font-title-md text-title-md text-on-surface mb-6">Product</h5>
            <ul className="space-y-4 font-body-md text-body-md text-secondary">
              <li><a className="hover:text-primary transition-colors" href="#">Features</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Security</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-title-md text-title-md text-on-surface mb-6">Resources</h5>
            <ul className="space-y-4 font-body-md text-body-md text-secondary">
              <li><a className="hover:text-primary transition-colors" href="#">Documentation</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">API Reference</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Blog</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-title-md text-title-md text-on-surface mb-6">Company</h5>
            <ul className="space-y-4 font-body-md text-body-md text-secondary">
              <li><a className="hover:text-primary transition-colors" href="#">About Us</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Careers</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-container-max mx-auto mt-16 pt-8 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-label-md text-label-md text-outline">© 2024 DocuSense Inc. All rights reserved.</p>
          <p className="font-label-md text-label-md text-outline">Built with Precision by DocuSense Core Team.</p>
        </div>
      </footer>
    </>
  )
}

export default Home
