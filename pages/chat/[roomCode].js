// pages/chat/[roomCode].js

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import Image from 'next/image';
import axios from 'axios';
import loadScript from 'load-script';
import styles from '../../styles/Chat.module.css';

export default function ChatRoom() {
  const router = useRouter();
  const { roomCode } = router.query;

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState('');
  const [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState('chat');

  const playerRef = useRef(null);
  const bottomRef = useRef(null);
  const roomRef = roomCode ? doc(db, 'rooms', roomCode) : null;

  // Redirect to login if not authenticated
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else router.replace('/login');
    });
    return () => unsub();
  }, []);

  // Subscribe to chat messages
  useEffect(() => {
    if (!roomCode) return;
    const q = query(
      collection(db, 'rooms', roomCode, 'messages'),
      orderBy('createdAt')
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [roomCode]);

  // Subscribe to queue
  useEffect(() => {
    if (!roomCode) return;
    const q = query(
      collection(db, 'rooms', roomCode, 'queue'),
      orderBy('addedAt')
    );
    return onSnapshot(q, (snap) => {
      setQueueItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [roomCode]);

  // Subscribe to room state (current video + play/pause)
  useEffect(() => {
    if (!roomRef) return;
    return onSnapshot(roomRef, (snap) => {
      const data = snap.data() || {};
      if (data.currentVideoId) setCurrentVideoId(data.currentVideoId);
      if (typeof data.playing === 'boolean') setPlaying(data.playing);
    });
  }, [roomRef]);

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize/update YouTube player
  useEffect(() => {
    const setup = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        height: '220',
        width: '100%',
        videoId: currentVideoId,
        playerVars: { controls: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) handleEnded();
            if (e.data === window.YT.PlayerState.PLAYING) updateRoom({ playing: true });
            if (e.data === window.YT.PlayerState.PAUSED) updateRoom({ playing: false });
          },
        },
      });
    };

    if (!window.YT) {
      loadScript('https://www.youtube.com/iframe_api', () => {
        window.onYouTubeIframeAPIReady = setup;
      });
    } else {
      setup();
    }
  }, [currentVideoId]);

  // Sync play/pause with player
  useEffect(() => {
    if (!playerRef.current) return;
    playing ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
  }, [playing]);

  // Send a chat message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
      text: newMessage,
      sender: user.displayName,
      avatar: user.photoURL,
      createdAt: serverTimestamp(),
    });
    setNewMessage('');
  };

  // Helper to update room document
  const updateRoom = (data) => {
    roomRef && setDoc(roomRef, data, { merge: true });
  };

  // Perform YouTube search
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params: {
            key: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
            part: 'snippet',
            type: 'video',
            maxResults: 8,
            q: searchTerm,
          },
        }
      );
      setSearchResults(
        data.items.map((i) => ({
          videoId: i.id.videoId,
          title: i.snippet.title,
          thumbnail: i.snippet.thumbnails.medium.url,
        }))
      );
    } catch (err) {
      console.error('YouTube API error', err);
      alert('Search failed. Check your API key or referer restrictions.');
    }
  };

  // Add a video to the queue
  const addToQueue = async (item) => {
    if (!user) return;
    await addDoc(collection(db, 'rooms', roomCode, 'queue'), {
      ...item,
      addedBy: user.displayName,
      addedAt: serverTimestamp(),
    });
    setTab('queue');
  };

  // Play next video in FIFO order
  const handleEnded = useCallback(async () => {
    if (!queueItems.length) return;
    const next = queueItems[0];
    await updateRoom({ currentVideoId: next.videoId, playing: true });
    await deleteDoc(doc(db, 'rooms', roomCode, 'queue', next.id));
  }, [queueItems]);

  if (!roomCode || !user) {
    return <div className={styles.container}>Loading…</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>💖 Room: {roomCode} 💖</header>

      <div className={styles.playerWrapperFixed}>
        <div id="yt-player" />
      </div>

      <nav className={styles.tabButtons}>
        {['chat', 'search', 'queue'].map((t) => (
          <button
            key={t}
            className={tab === t ? styles.activeTab : styles.tab}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'chat' && (
        <>
          <section className={styles.chatBox}>
            {messages.map((msg) => (
              <div key={msg.id} className={styles.message}>
                {msg.avatar && (
                  <Image
                    src={msg.avatar}
                    width={32}
                    height={32}
                    className={styles.avatar}
                    alt="avatar"
                  />
                )}
                <div className={styles.bubble}>
                  <div className={styles.sender}>{msg.sender}</div>
                  <div className={styles.text}>{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </section>
          <footer className={styles.inputBar}>
            <input
              className={styles.input}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your love note…"
            />
            <button onClick={sendMessage} className={styles.sendButton}>
              ❤️ Send
            </button>
          </footer>
        </>
      )}

      {tab === 'search' && (
        <section className={styles.searchPanel}>
          <div className={styles.searchBar}>
            <input
              className={styles.input}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs…"
            />
            <button onClick={handleSearch} className={styles.sendButton}>
              🔍
            </button>
          </div>
          <div className={styles.results}>
            {searchResults.map((item) => (
              <div key={item.videoId} className={styles.resultItem}>
                <Image
                  src={item.thumbnail}
                  width={120}
                  height={90}
                  alt="thumb"
                />
                <div>
                  <p className={styles.resultTitle}>{item.title}</p>
                  <button
                    onClick={() => addToQueue(item)}
                    className={styles.queueButton}
                  >
                    ➕ Love
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'queue' && (
        <section className={styles.queuePanel}>
          {queueItems.map((item) => (
            <div key={item.id} className={styles.queueItem}>
              <Image
                src={item.thumbnail}
                width={120}
                height={90}
                alt="thumb"
              />
              <div>
                <p className={styles.resultTitle}>{item.title}</p>
                <small>Added by {item.addedBy}</small>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
