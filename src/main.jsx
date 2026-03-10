import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadAndApplyTheme } from './theme'
import App from './App.jsx'
import { BravuraDemo } from './pages/BravuraDemo.jsx'
import { Reference } from './pages/Reference.jsx'
import { Tuner } from './pages/Tuner.jsx'
import { Editor } from './pages/Editor.jsx'
import { Debug } from './pages/Debug.jsx'

loadAndApplyTheme()

function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#/bravura-demo') {
    return <BravuraDemo />;
  }

  if (route === '#/chords') {
    return <Reference />;
  }

  if (route === '#/scales') {
    return <Debug />;
  }

  if (route === '#/tuner') {
    return <Tuner />;
  }

  if (route === '#/editor') {
    return <Editor />;
  }

  if (route === '#/debug') {
    return <Debug />;
  }

  if (route === '#/reference') {
    return <Reference />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
