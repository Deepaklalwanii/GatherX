// WebRTCComponent.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase'; // your path may differ

const configuration = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
  iceCandidatePoolSize: 10,
};

const WebRTCComponent = () => {
  const [roomId, setRoomId] = useState('');
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isInCall, setIsInCall] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [isMediaReady]);

  const openUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      setIsMediaReady(true);
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const createRoom = async () => {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnectionRef.current = peerConnection;

  registerPeerConnectionListeners();

  localStreamRef.current.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStreamRef.current);
  });

  remoteStreamRef.current = new MediaStream();
  peerConnection.addEventListener('track', event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStreamRef.current.addTrack(track);
    });
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const roomData = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  };

  // ✅ Create a new room document in Firestore
  const roomRef = await addDoc(collection(db, 'rooms'), roomData);
  setRoomId(roomRef.id);

  // ✅ Create subcollection for ICE candidates
  const callerCandidatesCollection = collection(roomRef, 'callerCandidates');

  peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate) {
      addDoc(callerCandidatesCollection, event.candidate.toJSON());
    }
  });

  const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
  onSnapshot(calleeCandidatesCollection, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  setIsInCall(true);
};

  const joinRoom = () => {
    setRoomDialogOpen(true);
  };

  const confirmJoinRoom = async () => {
    try {
      const roomRef = db.collection('rooms').doc(roomId);
      const roomSnapshot = await roomRef.get();

      if (!roomSnapshot.exists) {
        alert('Room not found!');
        return;
      }

      peerConnectionRef.current = new RTCPeerConnection(configuration);
      registerPeerConnectionListeners();

      localStreamRef.current.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStreamRef.current);
      });

      remoteStreamRef.current = new MediaStream();
      peerConnectionRef.current.addEventListener('track', event => {
        event.streams[0].getTracks().forEach(track => {
          remoteStreamRef.current.addTrack(track);
        });
      });

      const roomData = roomSnapshot.data();
      const offer = roomData.offer;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      await roomRef.update({
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      roomRef.collection('callerCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });

      const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
      peerConnectionRef.current.addEventListener('icecandidate', event => {
        if (event.candidate) {
          calleeCandidatesCollection.add(event.candidate.toJSON());
        }
      });

      setIsInCall(true);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const hangUp = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      if (roomId) {
        const roomRef = db.collection('rooms').doc(roomId);

        const calleeCandidates = await roomRef.collection('calleeCandidates').get();
        calleeCandidates.forEach(async candidate => await candidate.ref.delete());

        const callerCandidates = await roomRef.collection('callerCandidates').get();
        callerCandidates.forEach(async candidate => await candidate.ref.delete());

        await roomRef.delete();
      }

      setRoomId('');
      setIsMediaReady(false);
      setIsInCall(false);
      window.location.reload();
    } catch (error) {
      console.error('Error hanging up the call:', error);
    }
  };

  const registerPeerConnectionListeners = () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    pc.addEventListener('icegatheringstatechange', () => {
      console.log(`ICE gathering state changed: ${pc.iceGatheringState}`);
    });

    pc.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${pc.connectionState}`);
    });

    pc.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${pc.signalingState}`);
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log(`ICE connection state change: ${pc.iceConnectionState}`);
    });
  };

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted playsInline></video>
      <video ref={remoteVideoRef} autoPlay playsInline></video>

      <div>
        <button onClick={openUserMedia}>Open Camera</button>
        <button onClick={createRoom} disabled={!isMediaReady}>Create Room</button>
        <button onClick={joinRoom} disabled={!isMediaReady}>Join Room</button>
        <button onClick={hangUp} disabled={!isInCall}>Hang Up</button>
      </div>

      {roomDialogOpen && (
        <div className="room-dialog">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
          />
          <button onClick={confirmJoinRoom}>Confirm Join</button>
        </div>
      )}
    </div>
  );
};

export default WebRTCComponent;
