"use client";

import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs";

interface CameraProcessorProps {
  onVisualUpdate: (desc: string) => void;
  onVisualError?: (err: string) => void;
}

const videoConstraints = {
  width: 320,
  height: 240,
  facingMode: "user",
};

export default function CameraProcessor({ onVisualUpdate, onVisualError }: CameraProcessorProps) {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cocoModel, setCocoModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [blazeModel, setBlazeModel] = useState<blazeface.BlazeFaceModel | null>(null);
  const isProcessingRef = useRef(false);
  const lastDescriptionRef = useRef("");

  useEffect(() => {
    async function loadModels() {
      try {
        const coco = await cocoSsd.load();
        const blaze = await blazeface.load();
        setCocoModel(coco);
        setBlazeModel(blaze);
        setModelsLoaded(true);
      } catch (err) {
        const msg = "Failed to load models. Check network or TensorFlow.js compatibility.";
        console.error("Model load error:", err);
        onVisualUpdate(msg);
        if (onVisualError) onVisualError(msg);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !cocoModel || !blazeModel) return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !webcamRef.current) return;

      const video = webcamRef.current.video;
      if (!video || video.readyState !== 4) {
        const msg = "Webcam not ready or no video frame available.";
        if (lastDescriptionRef.current !== msg) {
          onVisualUpdate(msg);
          lastDescriptionRef.current = msg;
          if (onVisualError) onVisualError(msg);
        }
        return;
      }

      isProcessingRef.current = true;
      let desc = "";
      try {
        let faceCount = 0;
        try {
          const faces = await blazeModel.estimateFaces(video, false);
          faceCount = faces.length;
          desc += faceCount === 0 ? "No faces detected. " : `${faceCount} face${faceCount > 1 ? "s" : ""} detected. `;
        } catch (err) {
          console.error("Face detection error:", err);
          if (onVisualError) onVisualError("Face detection failed.");
        }

        let objects: string[] = [];
        try {
          const predictions = await cocoModel.detect(video);
          objects = predictions.map((p) => p.class);
          if (objects.length > 0) desc += `Objects: ${[...new Set(objects)].join(", ")}.`;
        } catch (err) {
          console.error("Object detection error:", err);
          if (onVisualError) onVisualError("Object detection failed.");
        }

        desc = desc.trim() || "Nothing detected.";
        if (desc !== lastDescriptionRef.current) {
          onVisualUpdate(desc);
          lastDescriptionRef.current = desc;
        }
      } finally {
        isProcessingRef.current = false;
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      isProcessingRef.current = false;
    };
  }, [modelsLoaded, cocoModel, blazeModel, onVisualUpdate, onVisualError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Webcam
        audio={false}
        ref={webcamRef}
        mirrored
        videoConstraints={videoConstraints}
        style={{
          width: 320,
          height: 240,
          borderRadius: 10,
          background: "#1e1e1e",
          border: "2px solid #333",
        }}
      />
      <div style={{ color: "#bbb", fontSize: 13, marginTop: 8, textAlign: "center" }}>
        Camera is live. Objects and faces will be detected automatically.
      </div>
    </div>
  );
}