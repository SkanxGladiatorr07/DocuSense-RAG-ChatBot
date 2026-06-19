import styles from './Dashboard.module.css'

/**
 * Dashboard.jsx
 * Main workspace page for the chat interface.
 * Currently a placeholder — the chat UI, document panel,
 * and upload controls will be built here in later phases.
 */
const Dashboard = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Your RAG workspace — upload documents and start chatting.
          </p>
        </div>
        <button className={styles.uploadBtn} disabled>
          + Upload Document
        </button>
      </header>

      {/* Placeholder content area */}
      <div className={styles.workspace}>
        {/* Left panel — document list */}
        <aside className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Documents</p>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📂</span>
            <p>No documents uploaded yet.</p>
          </div>
        </aside>

        {/* Right panel — chat interface */}
        <section className={styles.chat}>
          <div className={styles.chatMessages}>
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <p>Upload a document and ask your first question.</p>
            </div>
          </div>
          <div className={styles.chatInputRow}>
            <input
              className={styles.chatInput}
              type="text"
              placeholder="Ask a question about your documents…"
              disabled
            />
            <button className={styles.sendBtn} disabled>
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
