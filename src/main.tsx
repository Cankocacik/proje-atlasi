import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Yazı tipleri pakette (sabit ağırlıklı dosyalar): Google Fonts'un değişken Plex Sans'ı bazı Windows
// Chrome/Edge kurulumlarında görünmez çiziliyordu (menü adları boş, mono yazılar duruyordu).
// Tarayıcı yalnız sayfadaki karakterlerin alt kümesini indirir (unicode-range).
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
