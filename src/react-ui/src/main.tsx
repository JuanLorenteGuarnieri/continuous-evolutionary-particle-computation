import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <div id="root-app">CEPC UI Shell</div>;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
