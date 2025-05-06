import React from 'react'
import './index.css'
import WelcomeBanner from '../Components/WelcomeBanner.jsx'
import LoginPage from '../Components/LoginPage.jsx'
import SignInPage from '../Components/SigninPage.jsx'
import WebRTCComponent from '../Components/WebRTCComponent.jsx'
import firebase from 'firebase/compat/app'

export default function App() {
  return (
    <>
      <WelcomeBanner />
    </>
  )
}
