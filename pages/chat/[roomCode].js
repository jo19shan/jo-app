// pages/room/[roomCode].js
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import styles from '../../styles/Chat.module.css';

export default function ChatRoom({ initialRoomCode }) {
  const router = useRouter();
  const roomCode = initialRoomCode || router.query.roomCode;

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState('Klv9ZSpjWPI');
  const [playing, setPlaying] = useState(true);
  const [isPlayerReady, setPlayerReady] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const bottomRef = useRef(null);
  const playerRef = useRef(null);
  const roomRef = roomCode ? doc(db, 'rooms', roomCode) : null;

  // get current user
  useEffect(() => {
    if (typeof window !== 'undefined') setUser(auth.currentUser);
  }, []);

  // Firestore: listen messages
  useEffect(() => {
    if (!roomCode) return;
    const msgs = collection(db, 'rooms', roomCode, 'messages');
    const q = query(msgs, orderBy('createdAt'));
    return onSnapshot(q, snap =>
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [roomCode]);

  // Firestore: listen queue
  useEffect(() => {
    if (!roomCode) return;
    const qcol = collection(db, 'rooms', roomCode, 'queue');
    const q = query(qcol, orderBy('addedAt'));
    return onSnapshot(q, snap =>
      setQueueItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [roomCode]);

  // Firestore: listen room state
  useEffect(() => {
    if (!roomRef) return;
    return onSnapshot(roomRef, snap => {
      const data = snap.data() || {};
      if (data.currentVideoId) setCurrentVideoId(data.currentVideoId);
      if (typeof data.playing === 'boolean') setPlaying(data.playing);
    });
  }, [roomRef]);

  // auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
      text: newMessage,
      sender: user.displayName,
      avatar: user.photoURL,
      replyTo,
      createdAt: serverTimestamp()
    });
    setNewMessage('');
    setReplyTo(null);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    const { data } = await axios.get(
      'https://www.googleapis.com/youtube/v3/search',
      {
        params: {
          key: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
          part: 'snippet',
          type: 'video',
          maxResults: 6,
          q: searchTerm
        }
      }
    );
    setSearchResults(
      data.items.map(i => ({
        videoId: i.id.videoId,
        title: i.snippet.title,
        thumbnail: i.snippet.thumbnails.medium.url
      }))
    );
  };

  const addToQueue = async item => {
    if (!user) return;
    await addDoc(collection(db, 'rooms', roomCode, 'queue'), {
      ...item,
      addedBy: user.displayName,
      addedAt: serverTimestamp()
    });
    setActiveTab('queue');
  };

  const updateRoom = data =>
    roomRef && setDoc(roomRef, data, { merge: true });

  const handleEnded = useCallback(async () => {
    if (!queueItems.length) return;
    const next = queueItems[0];
    await updateRoom({ currentVideoId: next.videoId, playing: true });
    await deleteDoc(doc(db, 'rooms', roomCode, 'queue', next.id));
  }, [queueItems, roomCode]);

  const playVideo = vid => {
    updateRoom({ currentVideoId: vid, playing: true });
    setActiveTab('chat');
  };

  // YouTube player init & sync
  useEffect(() => {
    const createPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        height: '250',
        width: '100%',
        videoId: currentVideoId,
        playerVars: { controls: 1, playsinline: 1 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: e => {
            if (e.data === window.YT.PlayerState.ENDED) handleEnded();
            if (e.data === window.YT.PlayerState.PLAYING)
              updateRoom({ playing: true });
            if (e.data === window.YT.PlayerState.PAUSED)
              updateRoom({ playing: false });
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      createPlayer();
    }
  }, [currentVideoId, handleEnded]);

  useEffect(() => {
    if (!isPlayerReady) return;
    playing ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
  }, [playing, isPlayerReady]);

  const changeTab = tab => setActiveTab(tab);

  const signOut = () => {
    auth.signOut();
    router.replace('/login');
  };

  if (!roomCode)
    return <div className={styles.container}>Loading room…</div>;

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <h2 className={styles.roomTitle}>Room: {roomCode}</h2>
        <button onClick={signOut} className={styles.signOut}>
          Sign Out
        </button>
      </header>

      <div className={styles.playerWrapperFixed}>
        <div id="yt-player" />
      </div>

      <nav className={styles.tabButtons}>
        {['chat', 'search', 'queue'].map(tab => (
          <button
            key={tab}
            onClick={() => changeTab(tab)}
            className={
              activeTab === tab ? styles.activeTab : styles.tab
            }
          >
            {tab === 'chat' ? '💬 Chat' : tab === 'search' ? '🔍 Search' : '📃 Queue'}
          </button>
        ))}
      </nav>

      {activeTab === 'chat' && (
        <>
          <section className={styles.chatBox}>
            {messages.map(msg => (
              <div key={msg.id} className={styles.message}>
                {msg.avatar && (
                  <Image
                    src={msg.avatar}
                    width={32}
                    height={32}
                    className={styles.avatar}
                    alt=""
                    unoptimized
                  />
                )}
                <div className={styles.bubble}>
                  <div className={styles.sender}>{msg.sender}</div>
                  {msg.replyTo && (
                    <div className={styles.repliedMsg}>
                      {msg.replyTo.sender}: "{msg.replyTo.text}"
                    </div>
                  )}
                  <div className={styles.text}>{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </section>
          <footer className={styles.inputBar}>
            {replyTo && (
              <div className={styles.replyPreview}>
                Replying to: "{replyTo.text}"
                <span
                  className={styles.cancelReply}
                  onClick={() => setReplyTo(null)}
                >
                  ✖
                </span>
              </div>
            )}
            <input
              className={styles.input}
              value={newMessage}
              placeholder="Type a message…"
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage} className={styles.sendButton}>
              ➤
            </button>
          </footer>
        </>
      )}

      {activeTab === 'search' && (
        <section className={styles.searchPanel}>
          <div className={styles.searchBar}>
            <input
              className={styles.input}
              value={searchTerm}
              placeholder="Search YouTube…"
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className={styles.sendButton}>
              🔎
            </button>
          </div>
          <div className={styles.results}>
            {searchResults.map(item => (
              <div key={item.videoId} className={styles.resultItem}>
                <Image
                  src={item.thumbnail}
                  width={120}
                  height={90}
                  className={styles.resultThumb}
                  alt=""
                  unoptimized
                />
                <div className={styles.resultInfo}>
                  <p className={styles.resultTitle}>{item.title}</p>
                  <button
                    onClick={() => addToQueue(item)}
                    className={styles.queueButton}
                  >
                    ➕ Queue
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'queue' && (
        <section className={styles.queuePanel}>
          {queueItems.map(item => (
            <div
              key={item.id}
              className={styles.queueItem}
              onClick={() => playVideo(item.videoId)}
            >
              <Image
                src={item.thumbnail}
                width={120}
                height={90}
                className={styles.resultThumb}
                alt=""
                unoptimized
              />
              <div className={styles.resultInfo}>
                <p className={styles.resultTitle}>{item.title}</p>
                <small>added by {item.addedBy}</small>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export async function getServerSideProps({ params }) {
  return { props: { initialRoomCode: params.roomCode } };
}
