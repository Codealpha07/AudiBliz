// DOM elements
const murfApiKeyInput = document.getElementById('murfApiKey');
const defaultTargetLanguageSelect = document.getElementById('defaultTargetLanguage');
const defaultVoiceSelect = document.getElementById('defaultVoice');
const chunkSizeInput = document.getElementById('chunkSize');
const storageDurationSelect = document.getElementById('storageDuration');
const storedAudioCountSpan = document.getElementById('storedAudioCount');
const storageUsedSpan = document.getElementById('storageUsed');

// Status elements
const apiStatusDiv = document.getElementById('apiStatus');
const preferencesStatusDiv = document.getElementById('preferencesStatus');
const storageStatusDiv = document.getElementById('storageStatus');

// Button elements
const saveApiSettingsBtn = document.getElementById('saveApiSettings');
const savePreferencesBtn = document.getElementById('savePreferences');
const clearStorageBtn = document.getElementById('clearStorage');

// Initialize the options page
document.addEventListener('DOMContentLoaded', initializeOptionsPage);

async function initializeOptionsPage() {
  console.log('Initializing options page');
  
  loadSavedSettings();
  
  loadLanguagesAndVoices();
  
  updateStorageStats();
  
  setupEventListeners();
}

async function loadSavedSettings() {
  try {
    const apiSettings = await chrome.storage.local.get(['murfApiKey']);
    
    if (apiSettings.murfApiKey) {
      const maskedKey = '*'.repeat(Math.max(0, apiSettings.murfApiKey.length - 4)) + 
                        apiSettings.murfApiKey.slice(-4);
      murfApiKeyInput.value = maskedKey;
      murfApiKeyInput.dataset.masked = 'true';
    }
    
    const preferences = await chrome.storage.sync.get([
      'targetLanguage', 
      'preferredVoice', 
      'chunkSize',
      'storageDuration'
    ]);
    
    if (preferences.targetLanguage) {
      defaultTargetLanguageSelect.value = preferences.targetLanguage;
    }
    
    if (preferences.preferredVoice) {
      defaultVoiceSelect.value = preferences.preferredVoice;
    }
    
    if (preferences.chunkSize) {
      chunkSizeInput.value = preferences.chunkSize;
    }
    
    if (preferences.storageDuration) {
      storageDurationSelect.value = preferences.storageDuration;
    }
    
    console.log('Settings loaded successfully');
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus(apiStatusDiv, 'Error loading settings', 'error');
  }
}

let allAvailableVoices = [];

async function loadLanguagesAndVoices() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_LANGUAGES_AND_VOICES' }, (response) => {
      if (response && response.languages) {
        populateLanguageSelect(response.languages);
      } else {
        populateLanguageSelect([
          { code: 'en', name: 'English' },
          { code: 'fr', name: 'French' },
          { code: 'es', name: 'Spanish' }
        ]);
      }
      
      if (response && response.voices) {
        allAvailableVoices = response.voices;
        const selectedLanguage = defaultTargetLanguageSelect.value;
        filterAndPopulateVoices(selectedLanguage);
      } else {
        allAvailableVoices = [
          { id: 'en-US-ryan', name: 'Ken (English)', language: 'en-US' },
          { id: 'fr-FR-emma', name: 'Emma (French)', language: 'fr-FR' },
          { id: 'es-ES-miguel', name: 'Miguel (Spanish)', language: 'es-ES' }
        ];
        filterAndPopulateVoices(defaultTargetLanguageSelect.value);
      }
    });
  } catch (error) {
    console.error('Error loading languages and voices:', error);
  }
}

function populateLanguageSelect(languages) {
  const currentSelection = defaultTargetLanguageSelect.value;
  
  defaultTargetLanguageSelect.innerHTML = '';
  
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    defaultTargetLanguageSelect.appendChild(option);
  });
  
  if (currentSelection) {
    defaultTargetLanguageSelect.value = currentSelection;
  }
  defaultTargetLanguageSelect.addEventListener('change', function() {
    const selectedLanguage = this.value;
    filterAndPopulateVoices(selectedLanguage);
  });
}

function filterAndPopulateVoices(languageCode) {
  const filteredVoices = allAvailableVoices.filter(voice => {
    return voice.language.toLowerCase().startsWith(languageCode.toLowerCase());
  });
  
  populateVoiceSelect(filteredVoices);
}

function populateVoiceSelect(voices) {
  const currentSelection = defaultVoiceSelect.value;
  
  defaultVoiceSelect.innerHTML = '';
  
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    
    let displayName = voice.name;
    const nameMatch = voice.name.match(/^([^(]+)\s*\((.+)\)/);
    if (nameMatch) {
      const voiceName = nameMatch[1].trim();
      
      if (voice.language.includes('-')) {
        const langParts = voice.language.split('-');
        const subLang = langParts[1];
        displayName = `${voiceName} (${subLang})`;
      } else {
        displayName = voiceName;
      }
    }
    
    option.textContent = displayName;
    defaultVoiceSelect.appendChild(option);
  });
  
  if (voices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `No voices available for selected language`;
    option.disabled = true;
    defaultVoiceSelect.appendChild(option);
  }
  
  if (currentSelection && [...defaultVoiceSelect.options].some(opt => opt.value === currentSelection)) {
    defaultVoiceSelect.value = currentSelection;
  } else if (voices.length > 0) {
    defaultVoiceSelect.value = voices[0].id;
  }
}

async function updateStorageStats() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_STORAGE_STATS' }, (response) => {
      if (response) {
        storedAudioCountSpan.textContent = response.audioCount || '0';
        storageUsedSpan.textContent = response.storageUsed || '0 MB';
      } else {
        storedAudioCountSpan.textContent = '0';
        storageUsedSpan.textContent = '0 MB';
      }
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
  }
}

function setupEventListeners() {
  saveApiSettingsBtn.addEventListener('click', saveApiSettings);
  
  savePreferencesBtn.addEventListener('click', savePreferences);
  
  clearStorageBtn.addEventListener('click', clearStorage);
  
  murfApiKeyInput.addEventListener('focus', function() {
    if (this.dataset.masked === 'true') {
      this.value = '';
      this.dataset.masked = 'false';
    }
  });
}

async function saveApiSettings() {
  try {
    const murfApiKey = murfApiKeyInput.value.trim();
    
    if (!murfApiKey) {
      showStatus(apiStatusDiv, 'Murf API key is required', 'error');
      return;
    }
  
    if (murfApiKey === 'default') {
      const defaultKey = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
      await chrome.storage.local.set({ murfApiKey: defaultKey });
      showStatus(apiStatusDiv, 'Using default Murf API key', 'success');
      
      const maskedKey = '*'.repeat(Math.max(0, defaultKey.length - 4)) + 
                       defaultKey.slice(-4);
      murfApiKeyInput.value = maskedKey;
      murfApiKeyInput.dataset.masked = 'true';
      return;
    }
    
    await chrome.storage.local.set({ murfApiKey });
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_API_SETTINGS',
      murfApiKey
    });
    
    const maskedMurfKey = '*'.repeat(Math.max(0, murfApiKey.length - 4)) + 
                         murfApiKey.slice(-4);
    murfApiKeyInput.value = maskedMurfKey;
    murfApiKeyInput.dataset.masked = 'true';
    
    showStatus(apiStatusDiv, 'API settings saved successfully', 'success');
    console.log('API settings saved');
  } catch (error) {
    console.error('Error saving API settings:', error);
    showStatus(apiStatusDiv, 'Error saving API settings', 'error');
  }
}

async function savePreferences() {
  try {
    const targetLanguage = defaultTargetLanguageSelect.value;
    const preferredVoice = defaultVoiceSelect.value;
    const chunkSize = parseInt(chunkSizeInput.value.trim(), 10);
    const storageDuration = storageDurationSelect.value;
    
    if (isNaN(chunkSize) || chunkSize < 100 || chunkSize > 10000) {
      showStatus(preferencesStatusDiv, 'Chunk size must be between 100 and 10,000 characters', 'error');
      return;
    }
    await chrome.storage.sync.set({
      targetLanguage,
      preferredVoice,
      chunkSize,
      storageDuration
    });
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_PREFERENCES',
      targetLanguage,
      preferredVoice,
      chunkSize,
      storageDuration
    });
    
    showStatus(preferencesStatusDiv, 'Preferences saved successfully', 'success');
    console.log('Preferences saved');
  } catch (error) {
    console.error('Error saving preferences:', error);
    showStatus(preferencesStatusDiv, 'Error saving preferences', 'error');
  }
}

async function clearStorage() {
  try {
    if (!confirm('Are you sure you want to clear all stored audio files?')) {
      return;
    }
    
    chrome.runtime.sendMessage({ type: 'CLEAR_AUDIO_STORAGE' }, (response) => {
      if (response && response.status === 'success') {
        showStatus(storageStatusDiv, 'Storage cleared successfully', 'success');
        updateStorageStats();
      } else {
        showStatus(storageStatusDiv, 'Error clearing storage', 'error');
      }
    });
  } catch (error) {
    console.error('Error clearing storage:', error);
    showStatus(storageStatusDiv, 'Error clearing storage', 'error');
  }
}

function showStatus(element, message, type) {
  element.classList.remove('success', 'error', 'warning');
  element.classList.add(type);
  element.textContent = message;
  setTimeout(() => {
    element.textContent = '';
    element.classList.remove('success', 'error', 'warning');
  }, 5000);
}
