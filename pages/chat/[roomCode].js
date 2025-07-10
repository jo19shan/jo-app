// pages/chat/[roomCode].js
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import axios from 'axios';
import loadScript from 'load-script';
import Image from 'next/image';
import styles from '../../styles/Chat.module.css';

export default function Room() {
  const router = useRouter();
  const { roomCode } = router.query;

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentVideoId, setCurrentVideoId] = useState('');
  const [playing, setPlaying] = useState(false);
  const [isPlayerReady, setPlayerReady] = useState(false);
  const playerRef = useRef();
  const bottomRef = useRef();

  const roomRef = roomCode ? doc(db, 'rooms', roomCode) : null;

  // YouTube Player API load
  useEffect(() => {
    if (!window.YT) {
      loadScript('https://www.youtube.com/iframe_api', err => {
        if (err) console.error('YT API load failed', err);
      });
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      createPlayer();
    }
  }, [currentVideoId]);

  function createPlayer() {
    playerRef.current = new window.YT.Player('yt-player', {
      height: '200',
      width: '100%',
      videoId: currentVideoId,
      playerVars: { controls: 1, playsinline: 1 },
      events: {
        onReady: () => setPlayerReady(true),
        onStateChange: e => {
          if (e.data === window.YT.PlayerState.ENDED) handleEnded();
        }
      }
    });
  }

  useEffect(() => {
    if (!roomCode) return;
    const unsubMessages = onSnapshot(query(collection(db, 'rooms', roomCode, 'messages'), orderBy('createdAt')), snap => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubQueue = onSnapshot(query(collection(db, 'rooms', roomCode, 'queue'), orderBy('addedAt')), snap => {
      setQueueItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRoom = onSnapshot(doc(db, 'rooms', roomCode), snap => {
      const data = snap.data();
      if (data?.currentVideoId) setCurrentVideoId(data.currentVideoId);
      if (typeof data?.playing === 'boolean') setPlaying(data.playing);
    });

    return () => {
      unsubMessages();
      unsubQueue();
      unsubRoom();
    };
  }, [roomCode]);

  useEffect(() => {
    if (isPlayerReady) {
      playing ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
    }
  }, [playing, isPlayerReady]);

  const handleEnded = useCallback(async () => {
    if (queueItems.length === 0) return;
    const next = queueItems[0];
    await setDoc(roomRef, { currentVideoId: next.videoId, playing: true }, { merge: true });
    await deleteDoc(doc(db, 'rooms', roomCode, 'queue', next.id));
  }, [queueItems]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
      text: newMessage,
      sender: user?.displayName || 'Anonymous',
      createdAt: serverTimestamp()
    });
    setNewMessage('');
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
        part: 'snippet',
        q: searchTerm,
        maxResults: 8,
        type: 'video'
      }
    });
    setSearchResults(
      data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url
      }))
    );
  };

  const addToQueue = async video => {
    await addDoc(collection(db, 'rooms', roomCode, 'queue'), {
      ...video,
      addedAt: serverTimestamp()
    });
    setActiveTab('queue');
  };

  useEffect(() => {
    setUser(auth.currentUser);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.playerWrapperFixed}><div id="yt-player"></div></div>

      <div className={styles.tabButtons}>
        <button onClick={() => setActiveTab('chat')}>💬 Chat</button>
        <button onClick={() => setActiveTab('search')}>🔍 Search</button>
        <button onClick={() => setActiveTab('queue')}>📃 Queue</button>
      </div>

      {activeTab === 'chat' && (
        <div className={styles.chatBox}>
          {messages.map(msg => (
            <div key={msg.id} className={styles.message}>
              <strong>{msg.sender}:</strong> {msg.text}
            </div>
          ))}
          <div ref={bottomRef} />
          <input
            className={styles.input}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
          />
        </div>
      )}

      {activeTab === 'search' && (
        <div>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." />
          <button onClick={handleSearch}>Search</button>
          <div>
            {searchResults.map(video => (
              <div key={video.videoId}>
                <Image src={video.thumbnail} alt={video.title} width={120} height={90} unoptimized />
                <p>{video.title}</p>
                <button onClick={() => addToQueue(video)}>Add to Queue</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div>
          {queueItems.map(item => (
            <div key={item.id} onClick={() => setDoc(roomRef, { currentVideoId: item.videoId, playing: true }, { merge: true })}>
              <Image src={item.thumbnail} alt={item.title} width={120} height={90} unoptimized />
              <p>{item.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  return {
    props: {}
  };
}
