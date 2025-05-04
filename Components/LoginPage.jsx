import React from 'react';

const LoginPage = () => {
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Login</h1>
        <p>Welcome back to your video calling app!</p>

        <form className="login-form">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" placeholder="Enter your email" required />

          <label htmlFor="password">Password</label>
          <input type="password" id="password" placeholder="Enter your password" required />

          <button type="submit">Login</button>
        </form>

      <div className='login-footer'>
      <a href="#" className="forgot-link">Forgot your password?</a>
      <p>Don't have an account? <a href='#' className='signin-navigation'>sign up</a></p>
      </div>
      </div>
    </div>
  );
};

export default LoginPage;
