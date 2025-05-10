function ButtonPanel() {
    return (
      <div id="buttons">
        <button className="mdc-button mdc-button--raised" id="cameraBtn">
          <i className="material-icons mdc-button__icon" aria-hidden="true">perm_camera_mic</i>
          <span className="mdc-button__label">Open camera & microphone</span>
        </button>
        <button className="mdc-button mdc-button--raised" disabled id="createBtn">
          <i className="material-icons mdc-button__icon" aria-hidden="true">group_add</i>
          <span className="mdc-button__label">Create room</span>
        </button>
        <button className="mdc-button mdc-button--raised" disabled id="joinBtn">
          <i className="material-icons mdc-button__icon" aria-hidden="true">group</i>
          <span className="mdc-button__label">Join room</span>
        </button>
        <button className="mdc-button mdc-button--raised" disabled id="hangupBtn">
          <i className="material-icons mdc-button__icon" aria-hidden="true">close</i>
          <span className="mdc-button__label">Hangup</span>
        </button>
      </div>
    );
  }
  
  export default ButtonPanel;
  