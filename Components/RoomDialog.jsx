function RoomDialog() {
    return (
      <div className="mdc-dialog"
        id="room-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="my-dialog-title"
        aria-describedby="my-dialog-content">
        <div className="mdc-dialog__container">
          <div className="mdc-dialog__surface">
            <h2 className="mdc-dialog__title" id="my-dialog-title">Join room</h2>
            <div className="mdc-dialog__content" id="my-dialog-content">
              Enter ID for room to join:
              <div className="mdc-text-field">
                <input type="text" id="room-id" className="mdc-text-field__input" />
                <label className="mdc-floating-label" htmlFor="my-text-field">Room ID</label>
                <div className="mdc-line-ripple"></div>
              </div>
            </div>
            <footer className="mdc-dialog__actions">
              <button type="button" className="mdc-button mdc-dialog__button" data-mdc-dialog-action="no">
                <span className="mdc-button__label">Cancel</span>
              </button>
              <button id="confirmJoinBtn" type="button" className="mdc-button mdc-dialog__button" data-mdc-dialog-action="yes">
                <span className="mdc-button__label">Join</span>
              </button>
            </footer>
          </div>
        </div>
        <div className="mdc-dialog__scrim"></div>
      </div>
    );
  }
  
  export default RoomDialog;
  