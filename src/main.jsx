import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadAndApplyTheme } from './theme'
import App from './App.jsx'
import { BravuraDemo } from './pages/BravuraDemo.jsx'
import { Chords } from './pages/Chords.tsx'
import { Tuner } from './pages/Tuner.tsx'
import { Editor } from './pages/Editor.tsx'
import { GridEditor } from './pages/GridEditor.tsx'
import { Scales } from './pages/Scales.tsx'

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
    return <Chords />;
  }

  if (route === '#/scales') {
    return <Scales />;
  }

  if (route === '#/tuner') {
    return <Tuner />;
  }

  if (route === '#/editor') {
    return <Editor />;
  }

  if (route === '#/grid-editor') {
    return <GridEditor />;
  }

  if (route === '#/debug') {
    return <Scales />;
  }

  if (route === '#/reference') {
    return <Chords />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
