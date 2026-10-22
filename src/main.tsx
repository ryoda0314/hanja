import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App.tsx";
import DataGate from "./components/DataGate.tsx";
import { PrefsProvider } from "./prefs.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
      <DataGate>
        <RouterProvider router={router} />
      </DataGate>
    </PrefsProvider>
  </StrictMode>
);
