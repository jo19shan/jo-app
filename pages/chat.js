// pages/chat.js
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useRouter } from 'next/router'

export default function Chat() {
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) router.replace('/login')
    })
    return unsub
  }, [router])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>Chat will go here…</h2>
    </div>
  )
}