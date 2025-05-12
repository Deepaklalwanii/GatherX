import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import VideoPanel from './VideoPanel';
import RoomDialog from './RoomDialog';
import ButtonPanel from './ButtonPanel';

function WebRTCComponent() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null); // ✅ Fix for reliable stream tracking

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomCollection = collection(db, 'rooms');
        const roomSnapshot = await getDocs(roomCollection);
        const roomList = roomSnapshot.docs.map(doc => doc.data());
        setRooms(roomList);
      } catch (error) {
        console.error('Error fetching rooms: ', error);
        setError('Error fetching rooms. Please try again later.');
      }
    };

    fetchRooms();

    const cameraBtn = document.querySelector('#cameraBtn');
    const createBtn = document.querySelector('#createBtn');
    const joinBtn = document.querySelector('#joinBtn');
    const hangupBtn = document.querySelector('#hangupBtn');
    const confirmJoinBtn = document.querySelector('#confirmJoinBtn');
    
    const roomDialog = new window.mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));

    cameraBtn?.addEventListener('click', openUserMedia);
    hangupBtn?.addEventListener('click', hangUp);
    createBtn?.addEventListener('click', createRoom);
    joinBtn?.addEventListener('click', () => {
      confirmJoinBtn?.addEventListener(
        'click',
        () => joinRoomById(document.querySelector('#room-id').value),
        { once: true }
      );
      roomDialog.open();
    });

    return () => {
      cameraBtn?.removeEventListener('click', openUserMedia);
      hangupBtn?.removeEventListener('click', hangUp);
      createBtn?.removeEventListener('click', createRoom);
    };
  }, []);

  async function openUserMedia() {
    try {
      setLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream; // ✅ Store in ref as well

      const remoteStream = new MediaStream();
      setRemoteStream(remoteStream);

      document.querySelector('#localVideo').srcObject = stream;
      document.querySelector('#remoteVideo').srcObject = remoteStream;

      document.querySelector('#cameraBtn').disabled = true;
      document.querySelector('#joinBtn').disabled = false;
      document.querySelector('#createBtn').disabled = false;
      document.querySelector('#hangupBtn').disabled = false;

      setLoading(false);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Could not access your camera or microphone. Please check your devices.');
      setLoading(false);
    }
  }

  async function hangUp() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;

    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;

    setCurrentRoom('');
  }

  async function createRoom() {
    try {
      setLoading(true);
      const docRef = await addDoc(collection(db, 'rooms'), {
        creator: auth.currentUser ? auth.currentUser.email : 'Anonymous',
        createdAt: new Date(),
      });
      alert('Room created! Room ID: ' + docRef.id);
      setCurrentRoom(docRef.id);
      setLoading(false);
    } catch (error) {
      console.error('Error creating room: ', error);
      setError('Could not create the room. Please try again later.');
      setLoading(false);
    }
  }

  async function joinRoomById(roomId) {
    // ✅ Use the ref instead of state
    const localStream = localStreamRef.current;
    if (!localStream) {
      alert('Please enable your camera and microphone first by clicking "Start camera".');
      return;
    }

    setLoading(true);
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);

    if (roomSnapshot.exists()) {
      const offer = roomSnapshot.data().offer;
      console.log('Got offer:', offer);

      const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      registerPeerConnectionListeners();
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
      peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
          console.log('Got final candidate!');
          return;
        }
        console.log('Got candidate: ', event.candidate);
        addDoc(calleeCandidatesCollection, event.candidate.toJSON());
      });

      peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await roomRef.update({ answer: { type: answer.type, sdp: answer.sdp } });
      setLoading(false);
    } else {
      setError('Room not found. Please check the Room ID.');
      setLoading(false);
    }
  }

  function registerPeerConnectionListeners() {
    // Add useful listeners here for debugging if needed
    console.log('PeerConnection listeners registered.');
  }

  return (
    <div>
      {loading && <div>Loading... Please wait.</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <ButtonPanel />
      <VideoPanel />
      <RoomDialog />
      <div id="currentRoom">Room: {currentRoom}</div>
    </div>
  );
}

export default WebRTCComponent;
