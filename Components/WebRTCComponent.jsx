// WebRTCComponent.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from './firebase'; // Correct Firebase imports
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore'; // Import modular Firestore functions
import VideoPanel from './VideoPanel';
import RoomDialog from './RoomDialog';
import ButtonPanel from './ButtonPanel';

function WebRTCComponent() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('');
  let peerConnection;
  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  useEffect(() => {
    const fetchRooms = async () => {
      const roomCollection = collection(db, 'rooms');
      const roomSnapshot = await getDocs(roomCollection);
      const roomList = roomSnapshot.docs.map(doc => doc.data());
      setRooms(roomList);
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
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);

    const remote = new MediaStream();
    setRemoteStream(remote);

    document.querySelector('#localVideo').srcObject = stream;
    document.querySelector('#remoteVideo').srcObject = remote;

    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
  }

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

  async function joinRoomById(roomId) {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);
    console.log('Got room:', roomSnapshot.exists());

    if (roomSnapshot.exists()) {
      console.log('Create PeerConnection with configuration: ', configuration);
      peerConnection = new RTCPeerConnection(configuration);
      registerPeerConnectionListeners();

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      const calleeCandidatesCollection = collection(db, 'rooms', roomId, 'calleeCandidates');
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
          console.log('Add a track to the remoteStream:', track);
          remoteStream.addTrack(track);
        });
      });

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

      const callerCandidatesCollection = collection(db, 'rooms', roomId, 'callerCandidates');
      const unsubscribe = callerCandidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    }
  }

  function registerPeerConnectionListeners() {
    if (!peerConnection) return;
    peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
      console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
  }

  return (
    <div>
      <ButtonPanel />
      <VideoPanel />
      <RoomDialog />
      <div id="currentRoom">Room: {currentRoom}</div>
    </div>
  );
}

export default WebRTCComponent;
