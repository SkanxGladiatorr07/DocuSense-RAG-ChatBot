import { Link } from 'react-router-dom'
import styles from './Home.module.css'

/**
 * Home.jsx
 * Landing page. Introduces the product and links to the Dashboard.
 * Replace placeholder copy with real content when design is finalised.
 */
const Home = () => {
  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.badge}>RAG-Powered AI</div>
        <h1 className={styles.heading}>
          Chat with your<br />
          <span className={styles.highlight}>Company Documents</span>
        </h1>
        <p className={styles.subheading}>
          DocuSense uses Retrieval-Augmented Generation to let you ask natural
          language questions across all your internal knowledge — instantly and
          accurately.
        </p>
        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.btnPrimary}>
            Open Dashboard →
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Feature Cards */}
      <section className={styles.features}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.card}>
            <span className={styles.cardIcon}>{f.icon}</span>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardDesc}>{f.description}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

const FEATURES = [
  {
    icon: '📄',
    title: 'Upload Documents',
    description:
      'Upload PDFs, Word docs, or plain text files. DocuSense parses and indexes them automatically.',
  },
  {
    icon: '🔍',
    title: 'Semantic Search',
    description:
      'Queries are converted to vector embeddings and matched against your document store for precise retrieval.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Answers',
    description:
      'An LLM synthesises retrieved context into concise, grounded answers with source citations.',
  },
]

export default Home
