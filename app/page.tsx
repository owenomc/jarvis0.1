"use client";

// Main entry for JARVIS: Audio, Visual, and LLM integration
import React, { useState } from "react";
import CameraProcessor from "./CameraProcessor";
import JarvisListener from "./JarvisListener";

export default function Page() {
  const [visualDescription, setVisualDescription] = useState("");
  const [visualError, setVisualError] = useState<string | null>(null);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 30,
        height: "100vh",
        backgroundColor: "#121212",
        color: "#eee",
        fontFamily: "Segoe UI, Tahoma, sans-serif",
      }}
    >
      <h1 style={{ color: "#ffffff", marginBottom: 20, fontSize: 28 }}>JARVIS</h1>
      <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "calc(100% - 60px)" }}>
        <section style={{ flex: 1, paddingRight: 30, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h2 style={{ fontSize: 22, marginBottom: 10, color: "#a78bfa" }}>
            Visual Scanner
          </h2>
          <CameraProcessor
            onVisualUpdate={setVisualDescription}
            onVisualError={setVisualError}
          />
          <div
            style={{
              marginTop: 15,
              padding: 10,
              background: "#1e1e1e",
              borderRadius: 6,
              fontSize: 14,
              color: "#ccc",
              maxWidth: 340,
              lineHeight: 1.4,
            }}
          >
            <strong>Detected:</strong>
            <br />
            {visualDescription || "Analyzing..."}
            {visualError && (
              <div style={{ color: "#ff5555", marginTop: 5 }}>
                Error: {visualError}
              </div>
            )}
          </div>
        </section>
        <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: 22, marginBottom: 10, color: "#a78bfa" }}>
            Assistant
          </h2>
          <JarvisListener
            visualDescription={visualDescription}
            visualError={visualError}
          />
        </section>
      </div>
    </main>
  );
}