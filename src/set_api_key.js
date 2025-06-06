const MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';

chrome.storage.local.set({ murfApiKey: MURF_API_KEY }, () => {
  console.log('Murf API Key saved to storage');
});

chrome.storage.local.get(['murfApiKey'], (result) => {
  console.log('Stored API key:', result.murfApiKey);
});
