// pages/login.js
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Login() {
  const router = useRouter()

  // If already signed in, redirect to chat automatically
  useEffect(() => {
    if (auth.currentUser) router.replace('/rooms')
  }, [router])

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
      router.replace('/rooms')
    } catch (err) {
      console.error('Sign-in error:', err)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e0337',
        color: '#e33d89',
        fontFamily: 'sans-serif'
      }}
    >
      <h1>Welcome to Jo</h1>
      <button
        onClick={handleGoogle}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#276ef1',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign in with Google
      </button>
    </div>
  )
}