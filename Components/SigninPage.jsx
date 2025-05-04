import React from 'react';


const SigninPage = () => {
  return (
    <div className="signin-container">
      <div className="signin-card">
        <h1>Sign in</h1>

        <form className="signin-form">
          <label>Email</label>
          <input type="email" placeholder="Enter your email" required />

          <label>Password</label>
          <input type="password" placeholder="Enter your password" required />

          <button type="submit">Sign In</button>
        </form>

        <a href="#" className="forgot-link">Forgot your password?</a>
      </div>
    </div>
  );
};

export default SigninPage;
