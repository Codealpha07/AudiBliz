/**
 * Web-to-Podcast Translator - Popup Script
 * Handles popup UI interactions and communication with the background script
 */

// DOM elements
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const audioSeek = document.getElementById('audioSeek');
const timeDisplay = document.getElementById('timeDisplay');
const languageSelect = document.getElementById('languageSelect');
const voiceSelect = document.getElementById('voiceSelect');
const translateBtn = document.getElementById('translateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyTextBtn = document.getElementById('copyTextBtn');
const viewTextBtn = document.getElementById('viewTextBtn');
const statusElement = document.getElementById('status');
const audioPlayer = document.getElementById('audioPlayer');

// State management
let isPlaying = false;
let currentAudioChunks = [];
let currentPlayingIndex = -1;
let targetLanguage = 'en';
let preferredVoice = 'en-US-natalie';
let currentTabId = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize popup UI and state
 */
async function initializePopup() {
  console.log('Initializing popup');
  
  // Get current tab ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tabs[0].id;
  
  // Load saved preferences
  loadPreferences();
  
  // Load available languages and voices
  loadLanguagesAndVoices();
  
  // Get current status from background script
  getStatusFromBackground();
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Load user preferences from storage
 */
async function loadPreferences() {
  try {
    const result = await chrome.storage.sync.get(['targetLanguage', 'preferredVoice']);
    
    if (result.targetLanguage) {
      targetLanguage = result.targetLanguage;
      languageSelect.value = targetLanguage;
    }
    
    if (result.preferredVoice) {
      preferredVoice = result.preferredVoice;
      voiceSelect.value = preferredVoice;
    }
    
    console.log('Loaded preferences:', { targetLanguage, preferredVoice });
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

/**
 * Load available languages and voices
 */
async function loadLanguagesAndVoices() {
  try {
    // Send message to background script to get languages and voices
    chrome.runtime.sendMessage({ type: 'GET_LANGUAGES_AND_VOICES' }, (response) => {
      if (response && response.languages) {
        populateLanguageSelect(response.languages);
      }
      
      if (response && response.voices) {
        populateVoiceSelect(response.voices);
      }
    });
  } catch (error) {
    console.error('Error loading languages and voices:', error);
  }
}

/**
 * Populate language dropdown with available languages
 */
function populateLanguageSelect(languages) {
  // Clear existing options first (except the default ones)
  while (languageSelect.options.length > 0) {
    languageSelect.remove(0);
  }
  
  // Add new options
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
  });
  
  // Set the selected value to the saved preference
  languageSelect.value = targetLanguage;
}

// Store all available voices globally so we can filter them later
let allAvailableVoices = [];

/**
 * Populate voice dropdown with available voices
 */
function populateVoiceSelect(voices, filterByLanguage = true) {
  // Store all voices for later filtering
  if (voices) {
    allAvailableVoices = voices;
  }
  
  // Clear existing options first
  while (voiceSelect.options.length > 0) {
    voiceSelect.remove(0);
  }
  
  // Filter voices by the selected language
  const filteredVoices = filterByLanguage 
    ? allAvailableVoices.filter(voice => {
        // Match language code at the beginning of the language string
        // For example, 'en-US' should match when targetLanguage is 'en'
        return voice.language.toLowerCase().startsWith(targetLanguage.toLowerCase());
      })
    : allAvailableVoices;
  
  // Add new options
  filteredVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    
    // Extract just the name part from the voice name
    // Example: "Natalie (English US)" -> "Natalie"
    let displayName = voice.name;
    const nameMatch = voice.name.match(/^([^(]+)\s*\((.+)\)/);
    if (nameMatch) {
      const voiceName = nameMatch[1].trim();
      const voiceDescription = nameMatch[2].trim();
      
      // Check if this is a sub-language that needs to be shown
      // For example, distinguish between English US, English UK, etc.
      if (voice.language.includes('-')) {
        const langParts = voice.language.split('-');
        const subLang = langParts[1]; // Get the region code (US, UK, etc.)
        displayName = `${voiceName} (${subLang})`;
      } else {
        displayName = voiceName;
      }
    }
    
    option.textContent = displayName;
    voiceSelect.appendChild(option);
  });
  
  // If no voices match the selected language, show a message
  if (filteredVoices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `No voices available for ${targetLanguage}`;
    option.disabled = true;
    voiceSelect.appendChild(option);
  }
  
  // Set the selected value to the saved preference if it exists in the filtered list
  // Otherwise select the first option
  if (filteredVoices.find(voice => voice.id === preferredVoice)) {
    voiceSelect.value = preferredVoice;
  } else if (filteredVoices.length > 0) {
    preferredVoice = filteredVoices[0].id;
    voiceSelect.value = preferredVoice;
    // Save this new selection
    chrome.storage.sync.set({ preferredVoice });
  }
}

/**
 * Get current status from background script
 */
function getStatusFromBackground() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      console.log('Status from background:', response);
      
      if (response.audioChunks && response.audioChunks.length > 0) {
        currentAudioChunks = response.audioChunks;
        currentPlayingIndex = response.currentPlayingIndex;
        
        // Update UI based on received status
        updateUIWithAudioChunks();
        
        if (response.status === 'processing') {
          setStatus('Processing content...');
          disableTranslateButton();
        } else {
          setStatus('Ready to play');
          enableTranslateButton();
        }
      } else if (response.status === 'processing') {
        setStatus('Processing content...');
        disableTranslateButton();
      } else {
        setStatus('Ready to translate');
        enableTranslateButton();
      }
    }
  });
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // Play/Pause button
  playPauseBtn.addEventListener('click', togglePlayPause);
  
  // Translate button
  translateBtn.addEventListener('click', startTranslation);
  
  // Download button
  downloadBtn.addEventListener('click', downloadAudioFiles);
  
  // Copy Text button
  copyTextBtn.addEventListener('click', copyTranslatedText);
  
  // View Text button
  viewTextBtn.addEventListener('click', viewTranslatedText);
  
  // Language select
  languageSelect.addEventListener('change', updateLanguagePreference);
  
  // Voice select
  voiceSelect.addEventListener('change', updateVoicePreference);
  
  // Audio player events
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('ended', playNextChunk);
  
  // Audio seek slider events
  audioSeek.addEventListener('input', seekAudio);
  audioSeek.addEventListener('change', seekAudioEnd);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessages);
}

/**
 * Update language preference
 */
function updateLanguagePreference() {
  targetLanguage = languageSelect.value;
  
  // Save to storage
  chrome.storage.sync.set({ targetLanguage });
  
  // Update voice dropdown to show only voices for the selected language
  populateVoiceSelect(null, true);
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'UPDATE_PREFERENCES',
    targetLanguage,
    preferredVoice: voiceSelect.value // Send the updated voice preference
  });
  
  console.log('Updated target language to:', targetLanguage);
  console.log('Updated preferred voice to:', voiceSelect.value);
}

/**
 * Update voice preference
 */
function updateVoicePreference() {
  preferredVoice = voiceSelect.value;
  
  // Save to storage
  chrome.storage.sync.set({ preferredVoice });
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'UPDATE_PREFERENCES',
    preferredVoice
  });
  
  console.log('Updated preferred voice to:', preferredVoice);
}

/**
 * Start translation process
 */
function startTranslation() {
  setStatus('Starting translation...');
  disableTranslateButton();
  
  // Send message to background script to start translation
  chrome.runtime.sendMessage({
    type: 'START_TRANSLATION',
    tabId: currentTabId
  }, (response) => {
    console.log('Translation started:', response);
  });
}

/**
 * Toggle play/pause of audio
 */
function togglePlayPause() {
  if (currentAudioChunks.length === 0) {
    setStatus('No audio available. Translate the page first.');
    return;
  }
  
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

/**
 * Play audio
 */
function playAudio() {
  // If no current playing index, start from the beginning
  if (currentPlayingIndex < 0 || currentPlayingIndex >= currentAudioChunks.length) {
    currentPlayingIndex = 0;
  }
  
  // First try to use the local audio chunk if available
  const chunk = currentAudioChunks[currentPlayingIndex];
  if (chunk && chunk.audioUrl) {
    console.log('Playing audio from local chunk:', chunk);
    tryPlayAudio(chunk);
  } else {
    // If not available locally, request from service worker
    console.log('Requesting audio from service worker for index:', currentPlayingIndex);
    chrome.runtime.sendMessage({
      type: 'PLAY_AUDIO',
      index: currentPlayingIndex
    }, (response) => {
      console.log('Received play response from service worker:', response);
      
      if (response && response.status === 'playing' && response.audioChunk) {
        // Update the local audio chunk with the one from service worker
        if (currentAudioChunks[currentPlayingIndex]) {
          Object.assign(currentAudioChunks[currentPlayingIndex], response.audioChunk);
        } else {
          currentAudioChunks[currentPlayingIndex] = response.audioChunk;
        }
        
        // Play the audio
        tryPlayAudio(response.audioChunk);
      } else {
        console.error('Error getting audio from service worker:', response);
        setStatus('Error playing audio: ' + (response?.error || 'Unknown error'));
      }
    });
  }
}

// Helper function to play audio from a chunk
function tryPlayAudio(chunk) {
  if (chunk && chunk.audioUrl) {
    audioPlayer.src = chunk.audioUrl;
    audioPlayer.play()
      .then(() => {
        isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        setStatus(`Playing: ${chunk.title || 'Audio'}`);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
        setStatus('Error playing audio: ' + error.message);
      });
  } else {
    setStatus('Error: Audio URL not available');
  }
}

/**
 * Pause audio
 */
function pauseAudio() {
  audioPlayer.pause();
  isPlaying = false;
  playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  setStatus('Paused');
}

/**
 * Play next audio chunk
 */
function playNextChunk() {
  currentPlayingIndex++;
  
  // If we've reached the end, stop playing
  if (currentPlayingIndex >= currentAudioChunks.length) {
    currentPlayingIndex = 0;
    isPlaying = false;
    playPauseBtn.textContent = '▶ Play';
    setStatus('Playback complete');
    return;
  }
  
  // Otherwise, play the next chunk
  playAudio();
}

/**
 * Update progress bar based on audio playback
 */
function updateProgressBar() {
  if (audioPlayer.duration) {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = progress + '%';
    
    // Update slider position without triggering the 'input' event
    audioSeek.value = progress;
    
    // Update time display
    const currentTime = formatTime(audioPlayer.currentTime);
    const duration = formatTime(audioPlayer.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
  }
}

/**
 * Seek audio to a specific position when the user drags the slider
 */
function seekAudio() {
  if (audioPlayer.duration) {
    const seekPosition = audioSeek.value;
    progressBar.style.width = seekPosition + '%';
    
    // Update time display while dragging
    const seekTime = (seekPosition / 100) * audioPlayer.duration;
    const currentTime = formatTime(seekTime);
    const duration = formatTime(audioPlayer.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
  }
}

/**
 * Apply the seek position when the user releases the slider
 */
function seekAudioEnd() {
  if (audioPlayer.duration) {
    const seekPosition = audioSeek.value;
    const seekTime = (seekPosition / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  }
}

/**
 * Format time in MM:SS format
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Update UI with available audio chunks
 */
function updateUIWithAudioChunks() {
  if (currentAudioChunks.length > 0) {
    enablePlayButton();
    enableDownloadButton();
  } else {
    disablePlayButton();
    disableDownloadButton();
  }
}

/**
 * Download all audio files as a zip
 */
function downloadAudioFiles() {
  chrome.runtime.sendMessage({ type: 'DOWNLOAD_AUDIO_FILES' }, (response) => {
    if (response.status === 'downloading') {
      setStatus('Downloading audio files...');
    } else {
      setStatus('Error: ' + (response.error || 'Could not download files'));
    }
  });
}

/**
 * Copy translated text to clipboard
 */
function copyTranslatedText() {
  setStatus('Requesting translated text...');
  
  // Add loading state to button
  copyTextBtn.classList.add('loading');
  copyTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  // Force the service worker to wake up if needed
  chrome.runtime.sendMessage({ type: 'PING' }, () => {
    // Now request the translated text
    chrome.runtime.sendMessage({ type: 'GET_TRANSLATED_TEXT' }, (response) => {
      console.log('Got response for translated text:', response);
      
      // Remove loading state
      copyTextBtn.classList.remove('loading');
      
      if (chrome.runtime.lastError) {
        console.error('Runtime error during GET_TRANSLATED_TEXT:', chrome.runtime.lastError);
        setStatus('Error: Could not get translated text. Try translating again.');
        copyTextBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
        setTimeout(() => {
          copyTextBtn.innerHTML = '<i class="fas fa-clipboard"></i>';
        }, 2000);
        return;
      }
      
      if (response && response.translatedText && response.translatedText.length > 0) {
        // Copy to clipboard
        navigator.clipboard.writeText(response.translatedText)
          .then(() => {
            setStatus('Translated text copied to clipboard');
            
            // Visual feedback for successful copy with animation
            copyTextBtn.classList.add('success');
            copyTextBtn.innerHTML = '<i class="fas fa-check"></i>';
            
            // Add a tooltip or floating message
            const message = document.createElement('div');
            message.className = 'copy-success-message';
            message.textContent = 'Copied!';
            document.body.appendChild(message);
            
            // Position the message near the button
            const btnRect = copyTextBtn.getBoundingClientRect();
            message.style.top = `${btnRect.top - 30}px`;
            message.style.left = `${btnRect.left + (btnRect.width/2) - 30}px`;
            
            // Remove message and reset button after a delay
            setTimeout(() => {
              message.classList.add('fade-out');
              setTimeout(() => {
                document.body.removeChild(message);
              }, 300);
              copyTextBtn.classList.remove('success');
              copyTextBtn.innerHTML = '<i class="fas fa-clipboard"></i>';
            }, 2000);
          })
          .catch(err => {
            console.error('Could not copy text: ', err);
            setStatus('Error copying text to clipboard');
            copyTextBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            setTimeout(() => {
              copyTextBtn.innerHTML = '<i class="fas fa-clipboard"></i>';
            }, 2000);
          });
      } else {
        console.error('No translated text available in response:', response);
        setStatus('No translated text available. Please translate content first.');
        copyTextBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
        setTimeout(() => {
          copyTextBtn.innerHTML = '<i class="fas fa-clipboard"></i>';
        }, 2000);
      }
    });
  });
}

/**
 * View translated text in a new page
 */
function viewTranslatedText() {
  setStatus('Opening translated text in new page...');
  
  // Request the translated text and translation ID from the service worker
  chrome.runtime.sendMessage({ type: 'GET_TRANSLATED_TEXT' }, (response) => {
    console.log('Got response for viewing translated text:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Runtime error during GET_TRANSLATED_TEXT:', chrome.runtime.lastError);
      setStatus('Error: Could not get translated text. Try translating again.');
      return;
    }
    
    if (response && response.translationId) {
      // Open the translated text page with the translation ID
      const url = `translated-text.html?id=${response.translationId}`;
      chrome.tabs.create({ url: url });
      setStatus('Opened translated text in new tab');
    } else {
      console.error('No translation ID available:', response);
      setStatus('No translated text available. Please translate content first.');
    }
  });
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessages(message, sender, sendResponse) {
  console.log('Message from background:', message);
  
  switch (message.type) {
    case 'PROCESSING_COMPLETE':
      setStatus('Processing complete');
      currentAudioChunks = message.audioChunks;
      updateUIWithAudioChunks();
      enableTranslateButton();
      sendResponse({ status: 'acknowledged' });
      break;
      
    case 'PROCESSING_ERROR':
      setStatus(`Error: ${message.error}`);
      enableTranslateButton();
      sendResponse({ status: 'acknowledged' });
      break;
      
    case 'CHUNK_PROCESSED':
      const progress = message.progress;
      setStatus(`Processing: ${progress.current}/${progress.total}`);
      sendResponse({ status: 'acknowledged' });
      break;
  }
  
  return true; // Indicate we'll respond asynchronously
}

/**
 * Set status message
 */
function setStatus(message) {
  statusElement.textContent = message;
}

/**
 * Enable/disable UI buttons
 */
function enableTranslateButton() {
  translateBtn.disabled = false;
}

function disableTranslateButton() {
  translateBtn.disabled = true;
}

function enablePlayButton() {
  playPauseBtn.disabled = false;
}

function disablePlayButton() {
  playPauseBtn.disabled = true;
}

function enableDownloadButton() {
  downloadBtn.disabled = false;
}

function disableDownloadButton() {
  downloadBtn.disabled = true;
}
