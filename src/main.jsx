import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BravuraDemo } from './pages/BravuraDemo.jsx'
import { Chords } from './pages/Chords.tsx'
import { Tuner } from './pages/Tuner.tsx'
import { Editor } from './pages/Editor.tsx'
import { Scales } from './pages/Scales.tsx'
import { DesignGuide } from './pages/DesignGuide.tsx'

// Initialize dark mode based on system preference or saved preference
(() => {
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (systemPrefersDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.add('light');
  }
})();

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

  // TODO: re-enable when tuplet drag is resolved.
  /*
  if (route === '#/editor-v2') {
    return <EditorV2 />;
  }
    */

  if (route === '#/design-guide') {
    return <DesignGuide />;
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
