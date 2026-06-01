import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.tsx";
import DataGate from "./components/DataGate.tsx";
import { ScriptProvider } from "./prefs.tsx";
import "./index.css";

// Capacitor の WebView は file:// で動くため、BrowserRouter ではなく HashRouter を使う。
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScriptProvider>
      <DataGate>
        <HashRouter>
          <App />
        </HashRouter>
      </DataGate>
    </ScriptProvider>
  </StrictMode>
);
