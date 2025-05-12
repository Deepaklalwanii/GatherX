import React, { useEffect, useState, useRef } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import VideoPanel from './VideoPanel';
import RoomDialog from './RoomDialog';
import ButtonPanel from './ButtonPanel';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function WebRTCComponent() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomSnapshot = await getDocs(collection(db, 'rooms'));
        setRooms(roomSnapshot.docs.map(doc => doc.data()));
      } catch (error) {
        console.error('Error fetching rooms:', error);
        setError('Error fetching rooms. Please try again later.');
      }
    };
    fetchRooms();
  }, []);

  async function openUserMedia() {
    try {
      setLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      const newRemoteStream = new MediaStream();
      setRemoteStream(newRemoteStream);
      document.querySelector('#localVideo').srcObject = stream;
      document.querySelector('#remoteVideo').srcObject = newRemoteStream;
      setLoading(false);
    } catch (err) {
      setError('Could not access camera/microphone.');
      setLoading(false);
    }
  }

  async function createRoom() {
    setLoading(true);
    try {
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      const callerCandidatesCollection = collection(db, 'rooms');
      const roomRef = await addDoc(callerCandidatesCollection, {
        creator: auth.currentUser ? auth.currentUser.email : 'Anonymous',
        createdAt: new Date(),
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await updateDoc(doc(db, 'rooms', roomRef.id), {
        offer: { type: offer.type, sdp: offer.sdp },
      });

      pc.addEventListener('icecandidate', event => {
        if (event.candidate) {
          const candidatesRef = collection(doc(db, 'rooms', roomRef.id), 'callerCandidates');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      });

      pc.addEventListener('track', event => {
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
      });

      setCurrentRoom(roomRef.id);
    } catch (err) {
      setError('Failed to create room.');
    }
    setLoading(false);
  }

  async function joinRoomById(roomId) {
    if (!(localStream instanceof MediaStream) || localStream.getTracks().length === 0) {
      alert('Camera and microphone are not active. Please click "Start camera" first.');
      return;
    }

    setLoading(true);
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnapshot = await getDoc(roomRef);

      if (!roomSnapshot.exists()) {
        setError('Room not found. Please check the Room ID.');
        setLoading(false);
        return;
      }

      const roomData = roomSnapshot.data();
      const offer = roomData?.offer;

      if (!offer) {
        setError('Offer not found. The room might not be initialized properly.');
        setLoading(false);
        return;
      }

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.addEventListener('icecandidate', event => {
        if (event.candidate) {
          const calleeCandidates = collection(roomRef, 'calleeCandidates');
          addDoc(calleeCandidates, event.candidate.toJSON());
        }
      });

      pc.addEventListener('track', event => {
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(roomRef, {
        answer: { type: answer.type, sdp: answer.sdp },
      });

      setCurrentRoom(roomId);
    } catch (err) {
      console.error(err);
      setError('Failed to join room.');
    }
    setLoading(false);
  }

  function hangUp() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;
    setCurrentRoom('');
  }

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <ButtonPanel
        onCameraClick={openUserMedia}
        onCreateRoom={createRoom}
        onJoinRoom={() => {
          const roomId = prompt('Enter Room ID to join:');
          if (roomId) joinRoomById(roomId);
        }}
        onHangUp={hangUp}
      />
      <VideoPanel />
      <RoomDialog />
      <div id="currentRoom">Room: {currentRoom}</div>
    </div>
  );
}

export default WebRTCComponent;
