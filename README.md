# AudiBliz Chrome Extension

Turn any web article into spoken audio in your preferred language!

---

## Table of Content

- [Introduction](#introduction)
- [Features](#features)
- [What Makes This Extension Special?](#what-makes-this-extension-special)
- [About Murf API](#about-murf-api)
- [Installation (Step-by-Step)](#installation-step-by-step)
- [Troubleshooting (If Something Goes Wrong)](#troubleshooting-if-something-goes-wrong)
- [How to Use It (For Everyone)](#how-to-use-it-for-everyone)
- [For Developers (How to Modify or Improve)](#for-developers-how-to-modify-or-improve)
- [Project Structure (What’s in Each Folder)](#project-structure-whats-in-each-folder)
- [Future Enhancements (What Could Be Added Next)](#future-enhancements-what-could-be-added-next)
- [Privacy Policy (How Your Data is Handled)](#privacy-policy-how-your-data-is-handled)

## Introduction
The AudiBliz is a Chrome extension that lets you turn any web article into spoken audio in your preferred language. This tool grabs the main text from a web page, translates it if you want, and then reads it out loud using realistic voices. Perfect for those who want to listen to articles while multitasking or need content in different languages.

## Features
- *Extract Article Content:* Automatically grabs the main text from web pages, skipping ads and menus.
- *Translate to Any Language:* Converts the text into your chosen language using Murf’s translation service.
- *Text-to-Speech (TTS):* Reads the text out loud using natural-sounding voices from Murf.
- *Choose Your Voice:* Pick from a variety of voices and accents.
- *Audio Controls:* Play, pause, skip, and download the audio in chunks.
- *Copy or View Translated Text:* Copy the translated text or open it in a new tab.
- *Easy Preferences:* Set your favorite language, voice, and audio chunk size in the options page.

## What Makes This Extension Special?
- *All-in-One:* Extracts, translates, and voices web content in just a few clicks.
- *High-Quality Voices:* Uses Murf API for realistic, pleasant-sounding audio.
- *Flexible:* Works with many languages and lets you pick different voices.
- *User-Friendly:* Simple popup and settings page designed for everyone.
- *Privacy-Focused:* Your API key and settings are stored only in your browser.

## About Murf API
Murf API is an online service that turns text into speech and translates text between languages. This extension uses Murf to:
- Detect what language the article is in.
- Translate the article if you want.
- Turn the text into audio using the voice you pick.
- Get a list of available voices and languages.

You need a Murf API key to use these features. You can get one by signing up at [Murf’s website](https://murf.ai/).

## Installation (Step-by-Step)
1. *Get the Project:* Download or clone this project folder to your computer.
2. *Open Chrome Extensions:* Go to chrome://extensions in your Chrome browser.
3. *Turn on Developer Mode:* Switch the toggle at the top right.
4. *Load the Extension:* Click “Load unpacked” and select the "src" folder inside your project.
5. *Set Up Your API Key:* Click the extension’s icon, go to “Options,” and enter your Murf API key.
6. *Choose Preferences:* Pick your language, voice, and chunk size (how much text per audio segment).

## Troubleshooting (If Something Goes Wrong)
- *No Audio?*
  - Make sure you entered a valid Murf API key in the options page.
  - Check your internet connection.
- *Translation Not Working?*
  - Double-check your API key and try again.
- *Audio Won’t Play?*
  - Try refreshing the web page or restarting Chrome.
- *Can’t See or Edit API Key?*
  - Click on the API key field in options to reveal or change it.
- *Permission Problems?*
  - Make sure the extension is allowed to run on the web page you’re viewing.

## How to Use It (For Everyone)
1. Click the Web-to-Podcast Translator extension icon in your Chrome toolbar.
2. Go to Options & Settings from the popup.
3. Enter your Murf API Key, select your preferred language, voice, and chunk size.
4. Click Save Preferences.
5. Refresh the web page you want to listen to.
6. Open any article or web page.
7. Click the Web-to-Podcast Translator extension icon again.
8. Choose your target language and voice from the popup.
9. Click "Translate & Generate Audio".
10. Wait a few seconds for the audio to generate.
11. Use the play/pause buttons or download the audio.
12. Optionally, view or copy the translated text.

## For Developers (How to Modify or Improve)
- *Project Files:*
  - content-script.js: Grabs the article text from web pages.
  - service-worker.js: Handles background tasks and communication.
  - murf.js: Talks to the Murf API for voices and audio.
  - translate.js: Handles translation and language detection.
  - popup.js: Controls the popup window you see.
  - options.js: Manages the settings/options page.
  - manifest.json: Chrome extension manifest (setup info).
- *How it Works:*
  - When you click the extension, it extracts the main text, detects the language, translates if needed, and sends it to Murf for audio.
  - Everything is managed with Chrome’s messaging and storage APIs.
- *To Develop:*
  - Use Chrome’s extension developer tools for debugging.
  - API keys and preferences are stored with chrome.storage.local.

## Project Structure (What’s in Each Folder)
- ext/src/ (Main code)
  - content-script.js – Gets article text
  - service-worker.js – Runs background logic
  - murf.js – Connects to Murf API
  - translate.js – Translates text
  - popup.js – Popup UI logic
  - options.js – Settings UI logic
  - manifest.json – Chrome extension info
  - icons/ – Icons for the extension
  - translated-text.html/.js – Shows translated text in a new tab
- README.md, roadmap.md – Extra info and future plans

## Future Enhancements (What Could Be Added Next)
- Add more voices and support for more languages.
- Make content extraction smarter (better at skipping ads, etc.).
- Allow offline audio generation.
- Support other TTS/translation services.
- Give clearer error messages and help.
- Make it work on mobile browsers.

## Privacy Policy (How Your Data is Handled)
- Your Murf API key and preferences are saved only in your browser, never sent anywhere else.
- The extension does NOT collect or share your personal data.
- Text sent to Murf is used only for translation and audio generation.
- Check Murf’s own privacy policy for details about their API.

---
