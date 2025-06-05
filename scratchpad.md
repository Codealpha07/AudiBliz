# Project Scratchpad: Web-to-Podcast Translator Chrome Extension

## Current Task
Fixing Murf API integration issues in the Chrome extension

### Problems
1. Murf translation API returning 400 errors
2. `generateAudio` function not available in service worker
3. `splitIntoChunks` function not available in service worker

### Solutions Implemented

#### 1. Murf Translation API Fix
- Correct endpoint is `/v1/text/translate`
- API requires the following request format:
  ```json
  {
    "texts": ["Text to translate"],
    "target_language": "es-ES"
  }
  ```
- Response is formatted as:
  ```json
  {
    "metadata": { ... },
    "translations": [
      { "source_text": "...", "translated_text": "..." }
    ]
  }
  ```
- Added fallback to use the default Murf API key: `ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7`

#### 2. Murf TTS API Fix
- Correct endpoint is `/v1/speech/generate`
- API requires the following request format:
  ```json
  {
    "voiceId": "en-US-terrell",
    "text": "Text to convert to speech",
    "audioFormat": "mp3",
    "audioSpeed": 1.0,
    "sampleRate": 44100,
    "audioSampleRate": 44100
  }
  ```
- Murf voice IDs should use the format `language-region-name` (all lowercase), such as:
  - `en-US-natalie`, `en-US-terrell`, `en-US-miles` (English US)
  - `en-GB-charlie`, `en-GB-emma` (English UK)
  - `es-ES-alba`, `es-ES-andres` (Spanish)
  - `fr-FR-axel`, `fr-FR-emilie` (French)
  - `de-DE-anna`, `de-DE-klaus` (German)
- Response is a binary audio file that needs to be converted to a data URL
- Added fallback to use the default Murf API key when needed

#### 3. Service Worker Function Availability
- Implemented `generateAudioLocal` function directly in service worker
- Created `splitTextIntoChunks` function directly in service worker
- Implemented `getAvailableVoicesLocal` function in service worker
- Added robust error handling and fallbacks for all critical functions
- Added detailed logging for better debugging

#### 4. Lessons Learned
- Murf API voice IDs must use the exact format shown in their docs: `language-region-voicename` (e.g., `en-US-terrell`)
  - Language code must be lowercase (e.g., `en`) 
  - Region code must be uppercase (e.g., `US`)
  - Voice name must be lowercase (e.g., `terrell`)
  - All three parts must be connected with hyphens
  - Any code comments or documentation referencing voice IDs should be updated to reflect this format
- Correct endpoints for Murf API:
  - Translation: `/v1/text/translate`
  - Text-to-Speech: `/v1/speech/generate`
- Parameter naming is critical for API success:
  - Use `voiceId` instead of `voice_id`
  - Use `audioFormat` instead of `format`
  - Use `audioSpeed` instead of `speed`
  - Use `sampleRate` (some versions also need `audioSampleRate`) 
- Be consistent with property names in your state management (e.g., use `audioUrl` consistently)
- Add comprehensive error handling and logging to debug API integration issues
- Murf API responses may be JSON (with audio URL) or binary (direct audio data) - handle both cases

#### 5. Testing and Completion
- [X] Fix API endpoint URLs
- [X] Fix request body formats
- [X] Fix voice ID formats
- [X] Improve error handling
- [ ] Test the extension end-to-end with real content
- [ ] Verify translation works correctly
- [ ] Confirm audio generation and playback
- [ ] Document final implementation

### Resolution
- The extension should now handle translation and audio generation properly
- Functions are no longer dependent on external module loading
- More detailed error logging for troubleshooting

## Project Plan
1. Set up the extension skeleton
2. Implement content extraction and language detection
3. Implement translation, chunking, and audio conversion
4. Create the popup player UI
5. Implement preferences and storage
6. Build the playback engine
7. Package and QA

## Progress
- [X] Understand project requirements from roadmap
- [X] Set up project structure
  - [X] Create manifest.json
  - [X] Create service-worker.js
  - [X] Create popup.html and popup.js
  - [X] Create options.html
  - [X] Create content-script.js
  - [X] Create translate.js
  - [X] Create murf.js
- [X] Implement core functionality
  - [X] Content extraction with Readability.js
  - [X] Language detection with LibreTranslate
  - [X] Translation with LibreTranslate
  - [X] Text chunking
  - [X] Speech synthesis with Murf API
- [X] Implement UI and playback
  - [X] Popup player UI
  - [X] Preferences and storage
  - [X] Playback engine
- [X] Package and QA
  - [X] CSP compliance (handled in manifest.json)
  - [X] Create icons directory
  - [X] Add icon placeholder instructions
  - [X] Add README documentation
  - [X] Extension ready for testing

## Technical Details
- Translation API: LibreTranslate (https://libretranslate.com/)
- TTS API: Murf API (requires api-key)
- Supported Languages: English, French, Spanish, German, Italian, Portuguese, Chinese, Hindi, Korean, Croatian, Greek, Slovak, Dutch, Polish, Tamil, Bengali, Japanese
- Murf chunk size: ~3000 characters per API call
- Storage: chrome.storage.sync for preferences, IndexedDB for audio files

## Lessons
### User Specified Lessons 
- You have a python venv in ./venv.
- Include info useful for debugging in the progress output.
- Read the file before you try to edit it.
- Use LLM to perform flexible text understanding tasks. First test on a few files. After success, make it parallel.

### Windsurf Learned
- Chrome Extension MV3 service workers do NOT support ES modules or dynamic imports (`import()` statement is disallowed). Use `importScripts()` with global functions instead
- Message passing between popup and service worker requires careful handling - make sure to add handlers for all message types
- Murf API provides comprehensive services beyond TTS - it also offers translation via `/v1/text/translate` and language detection via `/v1/text/detect-language` endpoints
- Using a single API provider (Murf) for multiple services simplifies the codebase, reduces API key management, and provides better integration
- When working with APIs like LibreTranslate and Murf, always add proper error handling and fallbacks
- Text chunking is crucial for TTS APIs - splitting by paragraphs and then by sentences produces the best results
- Store API keys in chrome.storage.local (not sync) for security reasons
- Mask API keys in the UI for security, but show a few characters to help users identify different keys
- Murf's translation API expects different parameter names than standard APIs: `content` instead of `text`, `fromLang` instead of `sourceLanguage`, and `toLang` instead of `targetLanguage`
- When using `importScripts()` in service workers, functions aren't automatically available - you need to explicitly make them global by attaching them to the `self` object
- Don't rely on global function export from imported scripts in service workers - either reimplement critical functions or add a backup implementation
- For a good UX in Chrome Extensions, provide clear status updates during async operations
- IndexedDB is the preferred storage solution for binary data like audio files in extensions
- Specific Murf voice IDs for our supported languages:
  - English: 'en-US-natalie', 'en-UK-theo', 'en-IN-aarav', 'en-AU-kylie', 'en-SCOTT-rory', 'en-SCOTT-emily'
  - French: 'fr-FR-maxime', 'fr-FR-adélie'
  - Spanish: 'es-ES-elvira', 'es-MX-carlos'
  - German: 'de-DE-matthias'
  - Italian: 'it-IT-lorenzo'
  - Portuguese: 'pt-BR-heitor'
  - Chinese: 'zh-CN-tao'
  - Hindi: 'hi-IN-kabir'
  - Korean: 'ko-KR-gyeong'
  - Croatian: 'hr-HR-marija'
  - Greek: 'el-GR-stavros'
  - Slovak: 'sk-SK-tibor'
  - Dutch: 'nl-NL-dirk', 'nl-NL-merel', 'nl-NL-famke'
  - Polish: 'pl-PL-jacek', 'pl-PL-kasia', 'pl-PL-blazej'
  - Tamil: 'ta-IN-iniya', 'ta-IN-mani'
  - Bengali: 'bn-IN-anwesha', 'bn-IN-ishani', 'bn-IN-abhik'
  - Japanese: 'ja-JP-kenji', 'ja-JP-kimi', 'ja-JP-denki'
- In Chrome Extensions, make sure icon paths in manifest.json match their actual location (relative paths from extension root)
- We're using Murf API key: ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7
