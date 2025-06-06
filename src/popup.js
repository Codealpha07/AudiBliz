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

async function initializePopup() {
  console.log('Initializing popup');
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tabs[0].id;
  loadPreferences();
  loadLanguagesAndVoices();
  getStatusFromBackground();
  setupEventListeners();
}

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

async function loadLanguagesAndVoices() {
  try {
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

function populateLanguageSelect(languages) {
  while (languageSelect.options.length > 0) {
    languageSelect.remove(0);
  }
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
  });
  languageSelect.value = targetLanguage;
}

let allAvailableVoices = [];

function populateVoiceSelect(voices, filterByLanguage = true) {
  if (voices) {
    allAvailableVoices = voices;
  }
  
  while (voiceSelect.options.length > 0) {
    voiceSelect.remove(0);
  }
  const filteredVoices = filterByLanguage 
    ? allAvailableVoices.filter(voice => {
        return voice.language.toLowerCase().startsWith(targetLanguage.toLowerCase());
      })
    : allAvailableVoices;
  filteredVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    
    let displayName = voice.name;
    const nameMatch = voice.name.match(/^([^(]+)\s*\((.+)\)/);
    if (nameMatch) {
      const voiceName = nameMatch[1].trim();
      const voiceDescription = nameMatch[2].trim();
      
      if (voice.language.includes('-')) {
        const langParts = voice.language.split('-');
        const subLang = langParts[1];
        displayName = `${voiceName} (${subLang})`;
      } else {
        displayName = voiceName;
      }
    }
    
    option.textContent = displayName;
    voiceSelect.appendChild(option);
  });
  
  if (filteredVoices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `No voices available for ${targetLanguage}`;
    option.disabled = true;
    voiceSelect.appendChild(option);
  }
  
  if (filteredVoices.find(voice => voice.id === preferredVoice)) {
    voiceSelect.value = preferredVoice;
  } else if (filteredVoices.length > 0) {
    preferredVoice = filteredVoices[0].id;
    voiceSelect.value = preferredVoice;
    chrome.storage.sync.set({ preferredVoice });
  }
}

function getStatusFromBackground() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      console.log('Status from background:', response);
      
      if (response.audioChunks && response.audioChunks.length > 0) {
        currentAudioChunks = response.audioChunks;
        currentPlayingIndex = response.currentPlayingIndex;
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

function setupEventListeners() {
  playPauseBtn.addEventListener('click', togglePlayPause);
  translateBtn.addEventListener('click', startTranslation);
  downloadBtn.addEventListener('click', downloadAudioFiles);
  copyTextBtn.addEventListener('click', copyTranslatedText);
  viewTextBtn.addEventListener('click', viewTranslatedText);
  languageSelect.addEventListener('change', updateLanguagePreference);
  voiceSelect.addEventListener('change', updateVoicePreference);
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('ended', playNextChunk);
  audioSeek.addEventListener('input', seekAudio);
  audioSeek.addEventListener('change', seekAudioEnd);
  chrome.runtime.onMessage.addListener(handleBackgroundMessages);
}
function updateLanguagePreference() {
  targetLanguage = languageSelect.value;
  chrome.storage.sync.set({ targetLanguage });
  populateVoiceSelect(null, true);
  chrome.runtime.sendMessage({
    type: 'UPDATE_PREFERENCES',
    targetLanguage,
    preferredVoice: voiceSelect.value
  });
  console.log('Updated target language to:', targetLanguage);
  console.log('Updated preferred voice to:', voiceSelect.value);
}
function updateVoicePreference() {
  preferredVoice = voiceSelect.value;
  chrome.storage.sync.set({ preferredVoice });
  chrome.runtime.sendMessage({
    type: 'UPDATE_PREFERENCES',
    preferredVoice
  });
  console.log('Updated preferred voice to:', preferredVoice);
}
function startTranslation() {
  setStatus('Starting translation...');
  disableTranslateButton();
  chrome.runtime.sendMessage({
    type: 'START_TRANSLATION',
    tabId: currentTabId
  }, (response) => {
    console.log('Translation started:', response);
  });
}
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
function playAudio() {
  if (currentPlayingIndex < 0 || currentPlayingIndex >= currentAudioChunks.length) {
    currentPlayingIndex = 0;
  }
  
  const chunk = currentAudioChunks[currentPlayingIndex];
  if (chunk && chunk.audioUrl) {
    console.log('Playing audio from local chunk:', chunk);
    tryPlayAudio(chunk);
  } else {
    console.log('Requesting audio from service worker for index:', currentPlayingIndex);
    chrome.runtime.sendMessage({
      type: 'PLAY_AUDIO',
      index: currentPlayingIndex
    }, (response) => {
      console.log('Received play response from service worker:', response);
      
      if (response && response.status === 'playing' && response.audioChunk) {
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
function pauseAudio() {
  audioPlayer.pause();
  isPlaying = false;
  playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  setStatus('Paused');
}
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
  playAudio();
}
function updateProgressBar() {
  if (audioPlayer.duration) {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = progress + '%';
    audioSeek.value = progress;
    const currentTime = formatTime(audioPlayer.currentTime);
    const duration = formatTime(audioPlayer.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
  }
}
function seekAudio() {
  if (audioPlayer.duration) {
    const seekPosition = audioSeek.value;
    progressBar.style.width = seekPosition + '%';
    const seekTime = (seekPosition / 100) * audioPlayer.duration;
    const currentTime = formatTime(seekTime);
    const duration = formatTime(audioPlayer.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
  }
}
function seekAudioEnd() {
  if (audioPlayer.duration) {
    const seekPosition = audioSeek.value;
    const seekTime = (seekPosition / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  }
}
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
function updateUIWithAudioChunks() {
  if (currentAudioChunks.length > 0) {
    enablePlayButton();
    enableDownloadButton();
  } else {
    disablePlayButton();
    disableDownloadButton();
  }
}
function downloadAudioFiles() {
  chrome.runtime.sendMessage({ type: 'DOWNLOAD_AUDIO_FILES' }, (response) => {
    if (response.status === 'downloading') {
      setStatus('Downloading audio files...');
    } else {
      setStatus('Error: ' + (response.error || 'Could not download files'));
    }
  });
}
function copyTranslatedText() {
  setStatus('Requesting translated text...');
  copyTextBtn.classList.add('loading');
  copyTextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  chrome.runtime.sendMessage({ type: 'PING' }, () => {
    chrome.runtime.sendMessage({ type: 'GET_TRANSLATED_TEXT' }, (response) => {
      console.log('Got response for translated text:', response);
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
        navigator.clipboard.writeText(response.translatedText)
          .then(() => {
            setStatus('Translated text copied to clipboard');
            copyTextBtn.classList.add('success');
            copyTextBtn.innerHTML = '<i class="fas fa-check"></i>';
            const message = document.createElement('div');
            message.className = 'copy-success-message';
            message.textContent = 'Copied!';
            document.body.appendChild(message);
            const btnRect = copyTextBtn.getBoundingClientRect();
            message.style.top = `${btnRect.top - 30}px`;
            message.style.left = `${btnRect.left + (btnRect.width/2) - 30}px`;
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
function viewTranslatedText() {
  setStatus('Opening translated text in new page...');
  chrome.runtime.sendMessage({ type: 'GET_TRANSLATED_TEXT' }, (response) => {
    console.log('Got response for viewing translated text:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Runtime error during GET_TRANSLATED_TEXT:', chrome.runtime.lastError);
      setStatus('Error: Could not get translated text. Try translating again.');
      return;
    }
    
    if (response && response.translationId) {
      const url = `translated-text.html?id=${response.translationId}`;
      chrome.tabs.create({ url: url });
      setStatus('Opened translated text in new tab');
    } else {
      console.error('No translation ID available:', response);
      setStatus('No translated text available. Please translate content first.');
    }
  });
}
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
  
  return true;
}
function setStatus(message) {
  statusElement.textContent = message;
}
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
