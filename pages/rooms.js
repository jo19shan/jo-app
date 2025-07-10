// pages/rooms.js
import { useState } from 'react'
import { useRouter } from 'next/router'
import { collection, doc, setDoc, getDoc } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import styles from '../styles/Rooms.module.css'

export default function Rooms() {
  const [joinCode, setJoinCode] = useState('')
  const router = useRouter()

  const generateRoomCode = () => {
    return 'JO-' + Math.random().toString(36).substr(2, 5).toUpperCase()
  }

  const handleCreate = async () => {
    const user = auth.currentUser
    if (!user) {
      alert('Please sign in first.')
      return
    }

    const code = generateRoomCode()
    const roomRef = doc(collection(db, 'rooms'), code)

    await setDoc(roomRef, {
      createdAt: Date.now(),
      createdBy: user.uid,
      users: [user.uid],
      currentVideoId: 'Klv9ZSpjWPI',
      playing: true
    })

    router.push(`/chat/${code}`)
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      alert('Enter a room code.')
      return
    }
    const roomRef = doc(db, 'rooms', code)
    const snap = await getDoc(roomRef)
    if (snap.exists()) {
      router.push(`/chat/${code}`)
    } else {
      alert('Room not found.')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.bgAnimation}>
        <div className={styles.earth}></div>
        <div className={styles.moon}></div>
      </div>
      <h1 className={styles.heading}>
        Welcome, {auth.currentUser?.displayName || 'User'}
      </h1>
      <div className={styles.card}>
        <button onClick={handleCreate} className={styles.button}>
          🚀 Create Room
        </button>
      </div>
      <div className={styles.card}>
        <input
          className={styles.input}
          placeholder="Enter Room Code"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value)}
        />
        <button onClick={handleJoin} className={styles.button}>
          🔑 Join Room
        </button>
      </div>
    </div>
  )
}