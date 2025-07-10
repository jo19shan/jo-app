// pages/index.js

import Link from 'next/link'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🌙 + 🌍 = ❤️</h1>
      <Link href="/login" passHref>
        <button className={styles.button}>Get Started</button>
      </Link>
    </div>
  )
}