import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import { db, auth } from '../../lib/firebase';
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
  getDoc
} from 'firebase/firestore';
import styles from '../../styles/Chat.module.css';

export default function ChatRoom() {
  const router = useRouter();
  const roomCode = router.query.roomCode;

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState('');
  const [activeTab, setActiveTab] = useState('chat');

  const bottomRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => {
      if (u) setUser(u);
      else router.push('/login');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const unsubMessages = onSnapshot(
      query(collection(db, 'rooms', roomCode, 'messages'), orderBy('createdAt')),
      snapshot => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubQueue = onSnapshot(
      query(collection(db, 'rooms', roomCode, 'queue'), orderBy('addedAt')),
      snapshot => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setQueue(items);
      }
    );

    const unsubRoom = onSnapshot(doc(db, 'rooms', roomCode), snap => {
      const data = snap.data();
      if (data?.currentVideoId) setCurrentVideoId(data.currentVideoId);
    });

    return () => {
      unsubMessages();
      unsubQueue();
      unsubRoom();
    };
  }, [roomCode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = loadPlayer;
      document.body.appendChild(tag);
    } else {
      loadPlayer();
    }
  }, [currentVideoId]);

  const loadPlayer = () => {
    if (playerRef.current) return;

    playerRef.current = new window.YT.Player('yt-player', {
      height: '200',
      width: '100%',
      videoId: currentVideoId,
      playerVars: { autoplay: 1 },
      events: {
        onStateChange: async (e) => {
          if (e.data === window.YT.PlayerState.ENDED && queue.length > 0) {
            const next = queue[0];
            await setDoc(doc(db, 'rooms', roomCode), { currentVideoId: next.videoId });
            await deleteDoc(doc(db, 'rooms', roomCode, 'queue', next.id));
          }
        }
      }
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
      text: newMessage,
      sender: user.displayName,
      avatar: user.photoURL,
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
        type: 'video',
        maxResults: 8,
        q: searchTerm
      }
    });
    setSearchResults(data.items.map(i => ({
      videoId: i.id.videoId,
      title: i.snippet.title,
      thumbnail: i.snippet.thumbnails.medium.url
    })));
  };

  const addToQueue = async (item) => {
    await addDoc(collection(db, 'rooms', roomCode, 'queue'), {
      ...item,
      addedBy: user.displayName,
      addedAt: serverTimestamp()
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.player}>
        <div id="yt-player"></div>
      </div>

      <div className={styles.tabs}>
        <button onClick={() => setActiveTab('chat')}>Chat</button>
        <button onClick={() => setActiveTab('search')}>Search</button>
        <button onClick={() => setActiveTab('queue')}>Queue</button>
      </div>

      {activeTab === 'chat' && (
        <div className={styles.chatPanel}>
          <div className={styles.chatBox}>
            {messages.map(msg => (
              <div key={msg.id} className={styles.message}>
                <Image src={msg.avatar} width={24} height={24} alt="avatar" />
                <div>
                  <b>{msg.sender}</b>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef}></div>
          </div>
          <div className={styles.inputBar}>
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}

      {activeTab === 'search' && (
        <div className={styles.searchPanel}>
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search YouTube"
          />
          <button onClick={handleSearch}>Search</button>
          <div className={styles.results}>
            {searchResults.map(item => (
              <div key={item.videoId} className={styles.resultItem}>
                <Image src={item.thumbnail} width={120} height={90} alt={item.title} />
                <div>
                  <p>{item.title}</p>
                  <button onClick={() => addToQueue(item)}>Add to Queue</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className={styles.queuePanel}>
          {queue.map(item => (
            <div key={item.id}>
              <p>{item.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
