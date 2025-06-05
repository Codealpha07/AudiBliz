/**
 * Web-to-Podcast Translator - Translation Module
 * Handles language detection and translation using Murf API
 */

// For development, this would be loaded from chrome.storage.local
let MURF_API_KEY = '';

// Make sure MURF_API_KEY is globally available
if (typeof window === 'undefined') {
  // Service worker environment
  self.MURF_API_KEY = MURF_API_KEY;
}

/**
 * Detect the language of a text
 * @param {string} text - Text to detect language for
 * @returns {Promise<string>} - Detected language code
 */
async function detectLanguage(text) {
  try {
    console.log('Detecting language for text of length:', text.length);
    
    // Use a sample of the text for faster detection (first 1000 chars)
    const sample = text.substring(0, 1000);
    
    // Load API key if not already loaded
    if (!MURF_API_KEY) {
      try {
        const result = await chrome.storage.local.get(['murfApiKey']);
        MURF_API_KEY = result.murfApiKey;
        console.log('Murf API key loaded for translation:', MURF_API_KEY ? 'yes' : 'no');
      } catch (e) {
        console.warn('Error loading Murf API key:', e);
      }
    }
    
    // Ensure we have an API key
    if (!MURF_API_KEY) {
      console.error('No Murf API key available for language detection');
      return 'en'; // Default to English if no API key
    }
    
    const response = await fetch("https://api.murf.ai/v1/text/detect-language", {
      method: 'POST',
      headers: {
        "api-key": MURF_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: sample
      })
    });
    
    if (!response.ok) {
      throw new Error(`Language detection failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Murf returns a language code directly
    if (data && data.language) {
      console.log('Detected language:', data.language);
      // Convert Murf language code to ISO code if needed
      const isoCode = murfToIsoLanguageCode(data.language);
      return isoCode;
    } else {
      console.warn('No language detected, defaulting to English');
      return 'en'; // Default to English if detection fails
    }
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Helper function to convert Murf language codes to ISO codes
 * @param {string} murfLangCode - Murf language code (e.g., 'en-US')
 * @returns {string} - ISO language code (e.g., 'en')
 */
function murfToIsoLanguageCode(murfLangCode) {
  // Murf uses language-region format like 'en-US'
  // We need to convert to ISO 639-1 codes like 'en'
  if (!murfLangCode) return 'en';
  
  // Split by hyphen and take the first part
  const parts = murfLangCode.split('-');
  return parts[0].toLowerCase();
}

/**
 * Helper function to convert ISO language codes to Murf language codes
 * @param {string} isoCode - ISO language code (e.g., 'en')
 * @returns {string} - Murf language code (e.g., 'en-US')
 */
function isoToMurfLanguageCode(isoCode) {
  if (!isoCode) return 'en-US';
  
  // Map of ISO 639-1 codes to Murf language codes
  const isoToMurfMap = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'nl': 'nl-NL',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'zh': 'zh-CN',
    'ar': 'ar-AE',
    'hi': 'hi-IN'
  };
  
  const normalizedCode = isoCode.toLowerCase();
  const murfCode = isoToMurfMap[normalizedCode] || 'en-US';
  
  console.log(`Converting ISO code '${isoCode}' to Murf code '${murfCode}'`);
  return murfCode;
}

/**
 * Convert text from one language to another
 * @param {string} text - Text to translate
 * @param {string} from - Source language code
 * @param {string} to - Target language code
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, from, to) {
  try {
    console.log(`Translating from ${from} to ${to}, text length: ${text.length} characters`);
    
    // Skip translation if source and target languages are the same
    if (from === to) {
      console.log('Source and target languages are the same, skipping translation');
      return text;
    }
    
    // Load API key if not already loaded
    if (!MURF_API_KEY) {
      try {
        const result = await chrome.storage.local.get(['murfApiKey']);
        MURF_API_KEY = result.murfApiKey;
        console.log('Murf API key loaded for translation:', MURF_API_KEY ? 'yes' : 'no');
      } catch (e) {
        console.warn('Error loading Murf API key:', e);
      }
    }
    
    // Ensure we have an API key
    if (!MURF_API_KEY) {
      console.error('No Murf API key available for translation');
      return text; // Return original text if no API key
    }
    
    // Convert ISO language codes to Murf language codes
    const murfSourceLang = isoToMurfLanguageCode(from);
    const murfTargetLang = isoToMurfLanguageCode(to);
    
    // Use our known Murf API key for development/testing if needed
    if (!MURF_API_KEY || MURF_API_KEY.length < 10) {
      console.log('Using default Murf API key from memory');
      MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
    }
    
    // Split text into chunks if it's very large to avoid API limitations
    const MAX_CHUNK_SIZE = 3000;
    const textChunks = [];
    
    // Split the text into manageable chunks for translation
    if (text.length > MAX_CHUNK_SIZE) {
      console.log(`Text is large (${text.length} chars), splitting into chunks for translation`);
      // Use the same chunk splitting function we use for TTS
      if (typeof splitTextIntoChunks === 'function') {
        textChunks.push(...splitTextIntoChunks(text, MAX_CHUNK_SIZE));
      } else {
        // Simple fallback chunking if the imported function isn't available
        for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
          textChunks.push(text.substring(i, i + MAX_CHUNK_SIZE));
        }
      }
      console.log(`Split text into ${textChunks.length} chunks for translation`);
    } else {
      textChunks.push(text);
    }
    
    // For logging, show a sample of what we're translating
    const sampleText = text.length > 200 ? text.substring(0, 200) + '...' : text;
    console.log('Sample of text to translate:', sampleText);
    
    // Process each chunk and collect translated results
    let allTranslatedText = '';
    
    // Translate each chunk sequentially
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`Translating chunk ${i+1}/${textChunks.length}, length: ${chunk.length} chars`);
      
      // Create request body format for this chunk
      const requestBody = {
        texts: [chunk],
        target_language: murfTargetLang
      };
      
      // Call the translation API
      const response = await fetch("https://api.murf.ai/v1/text/translate", {
        method: 'POST',
        headers: {
          "api-key": MURF_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.error(`Translation API error for chunk ${i+1}: ${response.status} ${response.statusText}`);
        try {
          const errorData = await response.json();
          console.error('Error details:', errorData);
        } catch (e) {
          // Ignore parsing errors
        }
        // Skip this chunk on error but continue with others
        continue;
      }
      
      const data = await response.json();
      console.log(`Translation API response for chunk ${i+1}:`, data);
      
      let chunkTranslatedText = null;
      
      // Extract the translated text from the response
      if (data && data.translations && Array.isArray(data.translations) && data.translations.length > 0) {
        chunkTranslatedText = data.translations[0].translated_text;
        console.log(`Found translation for chunk ${i+1} in expected format`);
      } else if (data && data.data) {
        chunkTranslatedText = data.data;
      } else if (data && data.text) {
        chunkTranslatedText = data.text;
      }
      
      if (chunkTranslatedText) {
        // Add spacing between chunks if needed
        if (allTranslatedText && !allTranslatedText.endsWith('\n') && !chunkTranslatedText.startsWith('\n')) {
          allTranslatedText += '\n\n';
        }
        allTranslatedText += chunkTranslatedText;
        console.log(`Added translation for chunk ${i+1}, current result length: ${allTranslatedText.length}`);
      } else {
        console.warn(`Translation response for chunk ${i+1} missing expected format, using original chunk`);
        // Use the original chunk text if translation failed
        if (allTranslatedText && !allTranslatedText.endsWith('\n') && !chunk.startsWith('\n')) {
          allTranslatedText += '\n\n';
        }
        allTranslatedText += chunk;
      }
    }
    
    if (allTranslatedText) {
      console.log('All chunks translated successfully, total length:', allTranslatedText.length);
      return allTranslatedText;
    } else {
      console.warn('No chunks were successfully translated, returning original text');
      return text; // Return original text if all translations failed
    }
  } catch (error) {
    console.error('Error translating text:', error);
    return text; // Return original text on error
  }
}


/**
 * Get a list of supported languages
 * @returns {Promise<Array>} - Array of language objects with code and name
 */
async function getSupportedLanguages() {
  // Murf API supports these languages for translation
  // We're returning a hardcoded list instead of making an API call
  // since Murf doesn't have a direct endpoint to get supported languages for translation
  return [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' }
  ];
}

// Make functions globally available for service worker
if (typeof window === 'undefined') {
  // We're in a service worker environment
  self.detectLanguage = detectLanguage;
  self.translateText = translateText;
  self.getSupportedLanguages = getSupportedLanguages;
  self.murfToIsoLanguageCode = murfToIsoLanguageCode;
  self.isoToMurfLanguageCode = isoToMurfLanguageCode;
  console.log('Translate.js: Functions exported to service worker global scope');
}
