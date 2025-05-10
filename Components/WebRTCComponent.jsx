// WebRTCComponent.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from './firebase'; // Import Firebase services
import { collection, addDoc, getDocs } from 'firebase/firestore';
import VideoPanel from './VideoPanel'; 
import RoomDialog from './RoomDialog';
import ButtonPanel from './ButtonPanel';

function WebRTCComponent() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rooms, setRooms] = useState([]); // State to store available rooms
  const [currentRoom, setCurrentRoom] = useState('');

  useEffect(() => {
    // Initialize Firebase and listen for room updates (Firestore)
    const fetchRooms = async () => {
      const roomCollection = collection(db, 'rooms');
      const roomSnapshot = await getDocs(roomCollection);
      const roomList = roomSnapshot.docs.map(doc => doc.data());
      setRooms(roomList);
    };

    fetchRooms();

    // Event listeners for buttons
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

  // Handle opening camera and microphone
  async function openUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);

    const remoteStream = new MediaStream();
    setRemoteStream(remoteStream);

    document.querySelector('#localVideo').srcObject = stream;
    document.querySelector('#remoteVideo').srcObject = remoteStream;

    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
  }

  // Handle hanging up (stopping streams)
  async function hangUp() {
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';
  }

  // Create a new room (store in Firestore)
  async function createRoom() {
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        creator: auth.currentUser ? auth.currentUser.email : 'Anonymous',
        createdAt: new Date(),
      });
      alert('Room created! Room ID: ' + docRef.id);
      setCurrentRoom(docRef.id);
    } catch (error) {
      console.error('Error creating room: ', error);
    }
  }

  // Join an existing room
  async function joinRoomById(roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);
  
    if (roomSnapshot.exists) {
      console.log('Create PeerConnection with configuration: ', configuration);
      peerConnection = new RTCPeerConnection(configuration);
      registerPeerConnectionListeners();
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
  
      // Code for collecting ICE candidates below
      const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
      peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
          console.log('Got final candidate!');
          return;
        }
        console.log('Got candidate: ', event.candidate);
        calleeCandidatesCollection.add(event.candidate.toJSON());
      });
      // Code for collecting ICE candidates above
  
      peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
          console.log('Add a track to the remoteStream:', track);
          remoteStream.addTrack(track);
        });
      });
  
      // Code for creating SDP answer below
      const offer = roomSnapshot.data().offer;
      console.log('Got offer:', offer);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      console.log('Created answer:', answer);
      await peerConnection.setLocalDescription(answer);
  
      const roomWithAnswer = {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      };
      await roomRef.update(roomWithAnswer);
      // Code for creating SDP answer above
  
      // Listening for remote ICE candidates below
      roomRef.collection('callerCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
      // Listening for remote ICE candidates above
    }
  }

  return (
    <div>
      {/* Render ButtonPanel, VideoPanel, and RoomDialog */}
      <ButtonPanel />
      <VideoPanel />
      <RoomDialog />
      <div id="currentRoom">Room: {currentRoom}</div>
    </div>
  );
}

export default WebRTCComponent;
