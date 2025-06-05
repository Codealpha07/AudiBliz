// Script to set Murf API key directly in Chrome storage
// This is for testing purposes - normally users would enter this in the options page

// The API key to set
const MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';

// Save to Chrome storage
chrome.storage.local.set({ murfApiKey: MURF_API_KEY }, () => {
  console.log('Murf API Key saved to storage');
});

// Optionally, verify it was saved
chrome.storage.local.get(['murfApiKey'], (result) => {
  console.log('Stored API key:', result.murfApiKey);
});
