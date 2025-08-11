// types/global.d.ts

export {};

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  var webkitSpeechRecognition: typeof SpeechRecognition;
}
