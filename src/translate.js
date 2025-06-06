let MURF_API_KEY = '';

if (typeof window === 'undefined') {
  self.MURF_API_KEY = MURF_API_KEY;
}

async function detectLanguage(text) {
  try {
    console.log('Detecting language for text of length:', text.length);
    
    const sample = text.substring(0, 1000);
    
    if (!MURF_API_KEY) {
      try {
        const result = await chrome.storage.local.get(['murfApiKey']);
        MURF_API_KEY = result.murfApiKey;
        console.log('Murf API key loaded for translation:', MURF_API_KEY ? 'yes' : 'no');
      } catch (e) {
        console.warn('Error loading Murf API key:', e);
      }
    }
    
    if (!MURF_API_KEY) {
      console.error('No Murf API key available for language detection');
      return 'en';
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
    
    if (data && data.language) {
      console.log('Detected language:', data.language);
      const isoCode = murfToIsoLanguageCode(data.language);
      return isoCode;
    } else {
      console.warn('No language detected, defaulting to English');
      return 'en';
    }
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en';
  }
}


function murfToIsoLanguageCode(murfLangCode) {
  if (!murfLangCode) return 'en';
  
  const parts = murfLangCode.split('-');
  return parts[0].toLowerCase();
}


function isoToMurfLanguageCode(isoCode) {
  if (!isoCode) return 'en-US';
  
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

async function translateText(text, from, to) {
  try {
    console.log(`Translating from ${from} to ${to}, text length: ${text.length} characters`);
  
    if (from === to) {
      console.log('Source and target languages are the same, skipping translation');
      return text;
    }
    
    if (!MURF_API_KEY) {
      try {
        const result = await chrome.storage.local.get(['murfApiKey']);
        MURF_API_KEY = result.murfApiKey;
        console.log('Murf API key loaded for translation:', MURF_API_KEY ? 'yes' : 'no');
      } catch (e) {
        console.warn('Error loading Murf API key:', e);
      }
    }
    
    if (!MURF_API_KEY) {
      console.error('No Murf API key available for translation');
      return text; 
    }
    
    const murfSourceLang = isoToMurfLanguageCode(from);
    const murfTargetLang = isoToMurfLanguageCode(to);
    
    if (!MURF_API_KEY || MURF_API_KEY.length < 10) {
      console.log('Using default Murf API key from memory');
      MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
    }
    
    const MAX_CHUNK_SIZE = 3000;
    const textChunks = [];
    
    if (text.length > MAX_CHUNK_SIZE) {
      console.log(`Text is large (${text.length} chars), splitting into chunks for translation`);
      if (typeof splitTextIntoChunks === 'function') {
        textChunks.push(...splitTextIntoChunks(text, MAX_CHUNK_SIZE));
      } else {
        for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
          textChunks.push(text.substring(i, i + MAX_CHUNK_SIZE));
        }
      }
      console.log(`Split text into ${textChunks.length} chunks for translation`);
    } else {
      textChunks.push(text);
    }
    
    const sampleText = text.length > 200 ? text.substring(0, 200) + '...' : text;
    console.log('Sample of text to translate:', sampleText);
    
    let allTranslatedText = '';
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`Translating chunk ${i+1}/${textChunks.length}, length: ${chunk.length} chars`);
      
      const requestBody = {
        texts: [chunk],
        target_language: murfTargetLang
      };
      
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
        }
        continue;
      }
      
      const data = await response.json();
      console.log(`Translation API response for chunk ${i+1}:`, data);
      
      let chunkTranslatedText = null;
      
      if (data && data.translations && Array.isArray(data.translations) && data.translations.length > 0) {
        chunkTranslatedText = data.translations[0].translated_text;
        console.log(`Found translation for chunk ${i+1} in expected format`);
      } else if (data && data.data) {
        chunkTranslatedText = data.data;
      } else if (data && data.text) {
        chunkTranslatedText = data.text;
      }
      
      if (chunkTranslatedText) {
        if (allTranslatedText && !allTranslatedText.endsWith('\n') && !chunkTranslatedText.startsWith('\n')) {
          allTranslatedText += '\n\n';
        }
        allTranslatedText += chunkTranslatedText;
        console.log(`Added translation for chunk ${i+1}, current result length: ${allTranslatedText.length}`);
      } else {
        console.warn(`Translation response for chunk ${i+1} missing expected format, using original chunk`);
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
      return text;
    }
  } catch (error) {
    console.error('Error translating text:', error);
    return text;
  }
}

async function getSupportedLanguages() {
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

if (typeof window === 'undefined') {
  self.detectLanguage = detectLanguage;
  self.translateText = translateText;
  self.getSupportedLanguages = getSupportedLanguages;
  self.murfToIsoLanguageCode = murfToIsoLanguageCode;
  self.isoToMurfLanguageCode = isoToMurfLanguageCode;
  console.log('Translate.js: Functions exported to service worker global scope');
}
