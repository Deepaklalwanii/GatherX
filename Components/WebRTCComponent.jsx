import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import VideoPanel from './VideoPanel';
import RoomDialog from './RoomDialog';
import ButtonPanel from './ButtonPanel';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function WebRTCComponent() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

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
      localStreamRef.current = stream;

      const remoteStream = new MediaStream();
      setRemoteStream(remoteStream);
      remoteStreamRef.current = remoteStream;

      document.querySelector('#localVideo').srcObject = stream;
      document.querySelector('#remoteVideo').srcObject = remoteStream;

      document.querySelector('#cameraBtn').disabled = true;
      document.querySelector('#joinBtn').disabled = false;
      document.querySelector('#createBtn').disabled = false;
      document.querySelector('#hangupBtn').disabled = false;

      setLoading(false);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Could not access your camera or microphone. Please check your browser permissions.');
      setLoading(false);
    }
  }

  async function hangUp() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
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

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      const callerCandidatesCollection = collection(db, 'rooms', 'temp', 'callerCandidates');
      peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
          addDoc(callerCandidatesCollection, event.candidate.toJSON());
        }
      });

      const remoteStream = remoteStreamRef.current;
      peerConnection.addEventListener('track', event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const roomRef = await addDoc(collection(db, 'rooms'), {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        creator: auth.currentUser ? auth.currentUser.email : 'Anonymous',
        createdAt: new Date(),
      });

      setCurrentRoom(roomRef.id);
      setLoading(false);
      alert('Room created! Room ID: ' + roomRef.id);
    } catch (error) {
      console.error('Error creating room: ', error);
      setError('Could not create the room. Please try again later.');
      setLoading(false);
    }
  }

  async function joinRoomById(roomId) {
    if (!localStreamRef.current) {
      alert('Please enable your camera and microphone first by clicking "Start camera".');
      return;
    }

    setLoading(true);
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists()) {
      setError('Room not found. Please check the Room ID.');
      setLoading(false);
      return;
    }

    const roomData = roomSnapshot.data();
    if (!roomData.offer) {
      setError('This room does not have a valid offer.');
      setLoading(false);
      return;
    }

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    localStreamRef.current.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (event.candidate) {
        addDoc(calleeCandidatesCollection, event.candidate.toJSON());
      }
    });

    const remoteStream = remoteStreamRef.current;
    peerConnection.addEventListener('track', event => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await updateDoc(roomRef, {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });

    setLoading(false);
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
