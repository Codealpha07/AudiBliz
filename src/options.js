/**
 * Web-to-Podcast Translator - Options Script
 * Handles options page UI interactions and storage
 */

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

/**
 * Initialize the options page
 */
async function initializeOptionsPage() {
  console.log('Initializing options page');
  
  // Load saved settings and preferences
  loadSavedSettings();
  
  // Load available languages and voices
  loadLanguagesAndVoices();
  
  // Get storage statistics
  updateStorageStats();
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Load saved settings from storage
 */
async function loadSavedSettings() {
  try {
    // Load API settings
    const apiSettings = await chrome.storage.local.get(['murfApiKey']);
    
    if (apiSettings.murfApiKey) {
      // Mask the API key for display (show only last 4 chars)
      const maskedKey = '*'.repeat(Math.max(0, apiSettings.murfApiKey.length - 4)) + 
                        apiSettings.murfApiKey.slice(-4);
      murfApiKeyInput.value = maskedKey;
      murfApiKeyInput.dataset.masked = 'true';
    }
    
    // Load preferences
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

// Store all available voices globally so we can filter them later
let allAvailableVoices = [];

/**
 * Load available languages and voices
 */
async function loadLanguagesAndVoices() {
  try {
    // Send message to background script to get languages and voices
    chrome.runtime.sendMessage({ type: 'GET_LANGUAGES_AND_VOICES' }, (response) => {
      if (response && response.languages) {
        populateLanguageSelect(response.languages);
      } else {
        // Fallback to default languages
        populateLanguageSelect([
          { code: 'en', name: 'English' },
          { code: 'fr', name: 'French' },
          { code: 'es', name: 'Spanish' }
        ]);
      }
      
      if (response && response.voices) {
        // Store all voices for filtering
        allAvailableVoices = response.voices;
        // Get the current selected language
        const selectedLanguage = defaultTargetLanguageSelect.value;
        // Filter voices by the selected language
        filterAndPopulateVoices(selectedLanguage);
      } else {
        // Fallback to default voices
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

/**
 * Populate language dropdown with available languages
 */
function populateLanguageSelect(languages) {
  // Save the current selection
  const currentSelection = defaultTargetLanguageSelect.value;
  
  // Clear existing options
  defaultTargetLanguageSelect.innerHTML = '';
  
  // Add new options
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    defaultTargetLanguageSelect.appendChild(option);
  });
  
  // Restore selection if it exists in the new options
  if (currentSelection) {
    defaultTargetLanguageSelect.value = currentSelection;
  }
  
  // Add event listener to update voices when language changes
  defaultTargetLanguageSelect.addEventListener('change', function() {
    const selectedLanguage = this.value;
    filterAndPopulateVoices(selectedLanguage);
  });
}

/**
 * Filter voices by language and populate the voice dropdown
 */
function filterAndPopulateVoices(languageCode) {
  // Filter voices by the selected language
  const filteredVoices = allAvailableVoices.filter(voice => {
    // Match language code at the beginning of the language string
    // For example, 'en-US' should match when languageCode is 'en'
    return voice.language.toLowerCase().startsWith(languageCode.toLowerCase());
  });
  
  // Populate the dropdown with filtered voices
  populateVoiceSelect(filteredVoices);
}

/**
 * Populate voice dropdown with available voices
 */
function populateVoiceSelect(voices) {
  // Save the current selection
  const currentSelection = defaultVoiceSelect.value;
  
  // Clear existing options
  defaultVoiceSelect.innerHTML = '';
  
  // Add new options
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    
    // Extract just the name part from the voice name
    // Example: "Natalie (English US)" -> "Natalie"
    let displayName = voice.name;
    const nameMatch = voice.name.match(/^([^(]+)\s*\((.+)\)/);
    if (nameMatch) {
      const voiceName = nameMatch[1].trim();
      
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
    defaultVoiceSelect.appendChild(option);
  });
  
  // If no voices match the selected language, show a message
  if (voices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = `No voices available for selected language`;
    option.disabled = true;
    defaultVoiceSelect.appendChild(option);
  }
  
  // Restore selection if it exists in the new options
  if (currentSelection && [...defaultVoiceSelect.options].some(opt => opt.value === currentSelection)) {
    defaultVoiceSelect.value = currentSelection;
  } else if (voices.length > 0) {
    // If the previous selection doesn't exist in the new options, select the first one
    defaultVoiceSelect.value = voices[0].id;
  }
}

/**
 * Update storage statistics
 */
async function updateStorageStats() {
  try {
    // Send message to background script to get storage stats
    chrome.runtime.sendMessage({ type: 'GET_STORAGE_STATS' }, (response) => {
      if (response) {
        storedAudioCountSpan.textContent = response.audioCount || '0';
        storageUsedSpan.textContent = response.storageUsed || '0 MB';
      } else {
        // Fallback values
        storedAudioCountSpan.textContent = '0';
        storageUsedSpan.textContent = '0 MB';
      }
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
  }
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // API Settings save button
  saveApiSettingsBtn.addEventListener('click', saveApiSettings);
  
  // Preferences save button
  savePreferencesBtn.addEventListener('click', savePreferences);
  
  // Clear storage button
  clearStorageBtn.addEventListener('click', clearStorage);
  
  // API key input focus to clear masked value
  murfApiKeyInput.addEventListener('focus', function() {
    if (this.dataset.masked === 'true') {
      this.value = '';
      this.dataset.masked = 'false';
    }
  });
}

/**
 * Save API settings
 */
async function saveApiSettings() {
  try {
    const murfApiKey = murfApiKeyInput.value.trim();
    
    // Validate inputs
    if (!murfApiKey) {
      showStatus(apiStatusDiv, 'Murf API key is required', 'error');
      return;
    }
    
    // Set default Murf API key if not provided (using the one from memory)
    if (murfApiKey === 'default') {
      const defaultKey = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
      await chrome.storage.local.set({ murfApiKey: defaultKey });
      showStatus(apiStatusDiv, 'Using default Murf API key', 'success');
      
      // Mask the API key for display
      const maskedKey = '*'.repeat(Math.max(0, defaultKey.length - 4)) + 
                       defaultKey.slice(-4);
      murfApiKeyInput.value = maskedKey;
      murfApiKeyInput.dataset.masked = 'true';
      return;
    }
    
    // Save to local storage (API keys should not be synced)
    await chrome.storage.local.set({ murfApiKey });
    
    // Notify background script of changes
    chrome.runtime.sendMessage({
      type: 'UPDATE_API_SETTINGS',
      murfApiKey
    });
    
    // Mask the Murf API key for display
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

/**
 * Save preferences
 */
async function savePreferences() {
  try {
    const targetLanguage = defaultTargetLanguageSelect.value;
    const preferredVoice = defaultVoiceSelect.value;
    const chunkSize = parseInt(chunkSizeInput.value.trim(), 10);
    const storageDuration = storageDurationSelect.value;
    
    // Validate inputs
    if (isNaN(chunkSize) || chunkSize < 100 || chunkSize > 10000) {
      showStatus(preferencesStatusDiv, 'Chunk size must be between 100 and 10,000 characters', 'error');
      return;
    }
    
    // Save to sync storage (preferences should be synced across devices)
    await chrome.storage.sync.set({
      targetLanguage,
      preferredVoice,
      chunkSize,
      storageDuration
    });
    
    // Notify background script of changes
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

/**
 * Clear stored audio files
 */
async function clearStorage() {
  try {
    // Confirm with user
    if (!confirm('Are you sure you want to clear all stored audio files?')) {
      return;
    }
    
    // Send message to background script to clear storage
    chrome.runtime.sendMessage({ type: 'CLEAR_AUDIO_STORAGE' }, (response) => {
      if (response && response.status === 'success') {
        showStatus(storageStatusDiv, 'Storage cleared successfully', 'success');
        updateStorageStats(); // Refresh storage stats
      } else {
        showStatus(storageStatusDiv, 'Error clearing storage', 'error');
      }
    });
  } catch (error) {
    console.error('Error clearing storage:', error);
    showStatus(storageStatusDiv, 'Error clearing storage', 'error');
  }
}

/**
 * Show status message
 * @param {HTMLElement} element - Status div element
 * @param {string} message - Status message
 * @param {string} type - Status type (success, error, warning)
 */
function showStatus(element, message, type) {
  // Remove any existing status classes
  element.classList.remove('success', 'error', 'warning');
  
  // Add the new class
  element.classList.add(type);
  
  // Set the message
  element.textContent = message;
  
  // Clear the status after 5 seconds
  setTimeout(() => {
    element.textContent = '';
    element.classList.remove('success', 'error', 'warning');
  }, 5000);
}
