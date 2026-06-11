import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";
import App from "./App";
import HomePage from "./HomePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/activity" element={<App viewMode="activity" />} />
        <Route path="/admin" element={<App viewMode="admin" />} />
        <Route path="/playerview" element={<App viewMode="player" />} />
        <Route path="/acceptance-list" element={<HomePage />} />
        <Route path="/ranking" element={<App viewMode="ranking" />} />
        <Route path="/activity" element={<App viewMode="activity" />} />
        <Route path="/activity/:tournamentId" element={<App viewMode="activityDetail" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);