# Web-to-Podcast Translator

![Chrome Web Store](https://img.shields.io/chrome-web-store/v/your-extension-id.svg) ![License](https://img.shields.io/github/license/your-repo/your-extension.svg) ![Downloads](https://img.shields.io/chrome-web-store/d/your-extension-id.svg)

Transform your browsing experience into an auditory journey with the **Web-to-Podcast Translator**. This Chrome Extension seamlessly converts webpage text into speech, allowing you to consume content hands-free, like a podcast.

## Introduction

The Web-to-Podcast Translator is a cutting-edge extension that turns text from any webpage into spoken word using the Murf API. Perfect for multitaskers and auditory learners, it supports multiple languages and offers a range of voices to choose from.

## Features

- **Content Extraction**: Automatically extracts main content using Readability.js.
- **Language Detection**: Identifies the original language of the webpage content.
- **Translation**: Translates text into your preferred language effortlessly.
- **Text-to-Speech**: Converts translated text into high-quality audio via Murf API.
- **Podcast-Style Playback**: Enjoy audio with intuitive playback controls.
- **Downloadable Audio**: Save generated audio files for offline listening.
- **Voice and Language Options**: Choose from multiple voices and languages.

## What Stands Out

- **Customizable Voices**: Tailor the audio experience with a variety of voice options.
- **Instant Translation**: Real-time text-to-speech conversion.
- **User-Friendly Interface**: Clean and modern UI for easy navigation.
- **Seamless API Integration**: Leverages Murf API for reliable performance.
- **Cross-Tab Functionality**: Operates smoothly across multiple tabs.

## About Murf API

The Murf API powers our text-to-speech capabilities, offering diverse voices and language support to enhance your auditory experience. It seamlessly integrates with our extension to provide high-quality audio output.

## Installation

1. **Get Your API Key**: Sign up at [murf.ai/api](https://murf.ai/api) to obtain your API key.
2. **Clone or Download**: Retrieve the extension files from the repository.
3. **Load in Chrome**: Go to `chrome://extensions`, enable Developer Mode, and click "Load unpacked". Select the extension directory.
4. **Configure Settings**: Enter your Murf API key in the options page and set your preferences.

## Troubleshooting

- **Translation Stuck**: Ensure your API key is valid and your internet connection is stable.
- **403 Errors**: Check API key permissions and validity.
- **Auto-Translation**: Disable auto-extraction if unnecessary.

## Usage

1. **Navigate**: Open any webpage you wish to listen to.
2. **Activate**: Click the extension icon to open the popup.
3. **Translate & Play**: Hit "Translate & Play" to begin.
4. **Control Playback**: Use the controls to manage audio playback.

## Development

Interested in contributing? Follow these steps:

1. **Clone the Repo**: Get a copy of the project.
2. **Implement Changes**: Modify the code as needed.
3. **Load Unpacked**: Test your changes by loading the extension in Chrome.

## Project Structure

- **popup.js**: Handles UI and user interactions.
- **service-worker.js**: Manages background processes and API calls.
- **options.html/js**: Manages user settings and API key input.
- **content-script.js**: Extracts webpage content for processing.

## Future Enhancements

- **Expanded Language Support**: Add more languages and voices.
- **Offline Capabilities**: Enable offline voice caching.
- **Enhanced Error Handling**: Improve user feedback and error management.

## Privacy Policy

Your privacy is important. This extension does not store or transmit user content. API keys are securely stored using Chrome's local storage, and all processing occurs locally or via the Murf API.

---

Elevate your browsing with the Web-to-Podcast Translator, transforming text into a rich auditory experience. Perfect for those on the go or anyone who prefers listening over reading.
