"use client";

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const videoConstraints = {
  width: 320,
  height: 240,
  facingMode: "user",
};

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models"; // public/models

      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setInitialized(true);
        setStatus("Models loaded");
      } catch (err) {
        setStatus("Failed to load models");
        console.error(err);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    let interval: number;

    if (initialized) {
      interval = window.setInterval(async () => {
        const video = webcamRef.current?.video;
        if (video && !video.paused && !video.ended) {
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          if (detections.length > 0) {
            const expression = detections[0].expressions;
            const topExpression = Object.entries(expression).sort((a, b) => b[1] - a[1])[0];
            setStatus(`You look ${topExpression[0]}`);
          } else {
            setStatus("No face detected");
          }
        }
      }, 1500);
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [initialized]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold mb-4">JARVIS</h1>
      <Webcam
        ref={webcamRef}
        videoConstraints={videoConstraints}
        style={{ borderRadius: "12px" }}
        className="mb-4"
        width={videoConstraints.width}
        height={videoConstraints.height}
        audio={false}
      />
      <p className="text-xl">{status}</p>
    </main>
  );
}
