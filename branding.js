// ─────────────────────────────────────────────────────────────────────
// branding.js — Centralized Identity, Wake Words & Persona Config
// ─────────────────────────────────────────────────────────────────────

export const BRANDING = {
  appName: "HireScout",
  appTitle: "HireScout AI Agent",
  packageName: "hirescout",
  version: "2.0.0",
  tagline: "Live Job Discovery, 7-Signal Matching & Visual Auto-Apply Agent",
  
  // Voice Persona Configuration
  personaName: "Scout",
  voiceGender: "Female", // System.Speech voice selection preference
  voiceNamePreference: ["Zira", "Hazel", "Eva", "David"],
  speechPitch: "0st",
  speechRate: "0st",

  // Wake Word & Recognition Rules
  wakeWords: [
    "hello scout",
    "hey scout",
    "hi scout",
    "scout",
    "okay scout",
    "ok scout",
    "wake up scout"
  ],

  // Regex pattern for matching wake word variants in speech input
  wakeWordRegex: /\b(hello|hey|hi|ok|okay)\s*(scout|skout|scouts)\b/i,

  // Temp & Cache Directories
  tempDir: ".hirescout_temp",
  legacyTempDir: ".kairo_temp",

  // Console Banners & ASCII Art
  headerBanner: `
╭──────────────────────────────────────────────────────────────────────────╮
│  💼  H I R E S C O U T  —  AI Job Discovery & Application Agent           │
│  SerpApi Powered • 7-Signal Matching • Live Visual Browser Auto-Apply   │
╰──────────────────────────────────────────────────────────────────────────╯
`,
  voiceBanner: `
╭──────────────────────────────────────────────────────────────────────────╮
│  🎙️  H I R E S C O U T  V O I C E  A G E N T  A C T I V E                 │
│  Listening for "Hey Scout" or 3x Spacebar...                            │
╰──────────────────────────────────────────────────────────────────────────╯
`
};
