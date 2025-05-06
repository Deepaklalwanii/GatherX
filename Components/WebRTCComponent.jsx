import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// ✅ Free TURN server (for testing only — replace in production)
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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
  }, [isMediaReady]);

  const openUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
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
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const roomData = {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    };

    const roomRef = await addDoc(collection(db, 'rooms'), roomData);
    setRoomId(roomRef.id);

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
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnapshot = await getDoc(roomRef);

      if (!roomSnapshot.exists()) {
        alert('Room not found!');
        return;
      }

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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      });

      const roomData = roomSnapshot.data();
      const offer = roomData.offer;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await updateDoc(roomRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });

      const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
      peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
          addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        }
      });

      setIsInCall(true);
      setRoomDialogOpen(false);
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
        const roomRef = doc(db, 'rooms', roomId);

        const calleeCandidates = await getDocs(collection(roomRef, 'calleeCandidates'));
        calleeCandidates.forEach(async candidate => await deleteDoc(candidate.ref));

        const callerCandidates = await getDocs(collection(roomRef, 'callerCandidates'));
        callerCandidates.forEach(async candidate => await deleteDoc(candidate.ref));

        await deleteDoc(roomRef);
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
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '300px' }}></video>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px' }}></video>

      <div>
        <button onClick={openUserMedia}>Open Camera</button>
        <button onClick={createRoom} disabled={!isMediaReady}>Create Room</button>
        <button onClick={joinRoom} disabled={!isMediaReady}>Join Room</button>
        <button onClick={hangUp} disabled={!isInCall}>Hang Up</button>
      </div>

      {roomId && !roomDialogOpen && (
        <p><strong>Room ID:</strong> {roomId}</p>
      )}

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
