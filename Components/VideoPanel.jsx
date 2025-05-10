function VideoPanel() {
    return (
      <div id="videos">
        <video id="localVideo" muted autoPlay playsInline></video>
        <video id="remoteVideo" autoPlay playsInline></video>
      </div>
    );
  }
  
  export default VideoPanel;
  