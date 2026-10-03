// ─────────────────────────────────────────────────────────────────────
// tts.js — Persistent SAPI Speech Engine for HireScout Voice Persona
// Prevents spawning powershell.exe per sentence — uses continuous SAPI queue.
// ─────────────────────────────────────────────────────────────────────

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { BRANDING } from "./branding.js";

let psProcess = null;
const queue = [];
let isSpeaking = false;

/**
 * Initialize Persistent PowerShell SAPI Host
 */
function initSapiHost() {
  if (psProcess) return;

  const scriptContent = `
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.Rate = 0
try { $speak.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female) } catch {}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq "QUIT") { break }
  if ($line.Trim().Length -gt 0) {
    try {
      $speak.Speak($line)
    } catch {}
    Write-Output "TTS_DONE"
  }
}
`;

  try {
    psProcess = spawn("powershell", ["-NoProfile", "-Command", scriptContent], {
      stdio: ["pipe", "pipe", "ignore"]
    });

    psProcess.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("TTS_DONE")) {
        isSpeaking = false;
        processNextInQueue();
      }
    });

    psProcess.on("exit", () => {
      psProcess = null;
    });
  } catch {
    psProcess = null;
  }
}

function processNextInQueue() {
  if (queue.length === 0) {
    isSpeaking = false;
    return;
  }
  isSpeaking = true;
  const nextText = queue.shift();

  if (psProcess && psProcess.stdin.writable) {
    try {
      psProcess.stdin.write(nextText + "\n");
    } catch {
      isSpeaking = false;
    }
  } else {
    initSapiHost();
    if (psProcess && psProcess.stdin.writable) {
      try {
        psProcess.stdin.write(nextText + "\n");
      } catch {
        isSpeaking = false;
      }
    } else {
      isSpeaking = false;
    }
  }
}

export function speakQueued(text = "") {
  if (!text || text.trim() === "") return;
  const cleaned = text.replace(/[\r\n]+/g, " ").slice(0, 300);
  queue.push(cleaned);
  if (!isSpeaking) {
    processNextInQueue();
  }
}

export function isTtsSpeaking() {
  return isSpeaking || queue.length > 0;
}

export function stopTts() {
  queue.length = 0;
  isSpeaking = false;
  if (psProcess) {
    try {
      psProcess.stdin.write("QUIT\n");
      psProcess.kill();
    } catch {}
    psProcess = null;
  }
}
