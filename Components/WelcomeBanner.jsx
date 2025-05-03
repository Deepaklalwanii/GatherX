import React, { useState, useEffect, useRef } from 'react'

const WelcomeBanner = () => {
  const [text, setText] = useState('')
  const message = 'GatherX'
  const indexRef = useRef(0)

  useEffect(() => {
    setText('')
    const interval = setInterval(() => {
      const currentIndex = indexRef.current
      if (currentIndex < message.length) {
        setText(prev => prev + message.charAt(currentIndex))
        indexRef.current += 1
      } else {
        clearInterval(interval)
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <section>
      <div className='gx-welcome-banner'>
        <h1 className='gx-welcome-banner-title'>
          <span>Welcome to </span>
          <span className='typewriter'>{text}</span>
        </h1>
        <p>We are glad to have you here. Explore our features and enjoy your stay!</p>
        <button>Get Started</button>
      </div>
    </section>
  )
}

export default WelcomeBanner
