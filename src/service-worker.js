
try {
  importScripts('./translate.js', './murf.js');
  console.log('Successfully loaded scripts');
  
  chrome.storage.local.get(['murfApiKey'], (result) => {
    if (result.murfApiKey) {
      MURF_API_KEY = result.murfApiKey;
      console.log('Murf API key loaded from storage');
    } else {
      MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
      chrome.storage.local.set({ murfApiKey: MURF_API_KEY });
      console.log('Initialized default Murf API key');
    }
  });
} catch (error) {
  console.error('Error loading scripts:', error);
}

const state = {
  translating: false,
  currentTab: null,
  extractedText: '',
  translatedText: '',
  audioChunks: [],
  currentAudio: null,
  audioPlaying: false,
  detectedLanguage: null,
  preferredVoice: 'en-US-natalie',
  preferredLanguage: 'en-US',
  storedTranslations: {},
  lastTranslationId: null
};

chrome.storage.sync.get(['targetLanguage', 'preferredVoice'], (result) => {
  if (result.targetLanguage) state.preferredLanguage = result.targetLanguage;
  if (result.preferredVoice) state.preferredVoice = result.preferredVoice;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type);

  let isAsync = false;

  switch (message.type) {
    case 'PING':
      console.log('Received PING, service worker is awake');
      sendResponse({ status: 'awake' });
      break;

    case 'WEBPAGE_TEXT':
      handleWebpageContent(message, sender.tab.id);
      sendResponse({ status: 'received' });
      break;

    case 'START_TRANSLATION':
      state.translatedText = '';
      startTranslationProcess(message.tabId);
      sendResponse({ status: 'started' });
      break;

    case 'GET_TRANSLATED_TEXT':
      console.log('GET_TRANSLATED_TEXT received, text available:', !!state.translatedText,
                  state.translatedText ? `length: ${state.translatedText.length}` : 'no text');

      if (state.translatedText && state.translatedText.length > 0) {
        sendResponse({
          translatedText: state.translatedText,
          status: 'success',
          translationId: state.lastTranslationId
        });
      } else {
        sendResponse({
          translatedText: '',
          status: 'no_text_available'
        });
      }
      break;

    case 'GET_STORED_TRANSLATION': {
      const translationId = message.id;
      if (translationId && state.storedTranslations[translationId]) {
        const translation = state.storedTranslations[translationId];
        sendResponse({
          translatedText: translation.text,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          status: 'success'
        });
      } else {
        sendResponse({ status: 'not_found' });
      }
      break;
    }

    case 'GET_STATUS':
      sendResponse({
        status: state.isProcessing ? 'processing' : 'ready',
        audioChunks: state.audioChunks,
        currentPlayingIndex: state.currentPlayingIndex,
        detectedLanguage: state.detectedLanguage,
        targetLanguage: state.targetLanguage
      });
      break;

    case 'PLAY_AUDIO':
      state.currentPlayingIndex = message.index !== undefined ? message.index : 0;
      if (state.audioChunks && state.audioChunks.length > 0 &&
          state.currentPlayingIndex >= 0 &&
          state.currentPlayingIndex < state.audioChunks.length) {
        const audioChunk = state.audioChunks[state.currentPlayingIndex];
        sendResponse({ status: 'playing', index: state.currentPlayingIndex, audioChunk });
      } else {
        sendResponse({ status: 'error', error: 'No audio available or invalid index' });
      }
      break;

    case 'UPDATE_PREFERENCES':
      if (message.targetLanguage) {
        state.targetLanguage = message.targetLanguage;
        state.preferredLanguage = message.targetLanguage;
        chrome.storage.sync.set({ targetLanguage: message.targetLanguage });
      }
      if (message.preferredVoice) {
        state.preferredVoice = message.preferredVoice;
        chrome.storage.sync.set({ preferredVoice: message.preferredVoice });
      }
      sendResponse({ status: 'preferences_updated' });
      break;

    case 'UPDATE_API_SETTINGS':
      if (message.murfApiKey && message.murfApiKey.trim().length > 0) {
        MURF_API_KEY = message.murfApiKey.trim();
        if (typeof self.MURF_API_KEY !== 'undefined') {
          self.MURF_API_KEY = MURF_API_KEY;
        }
        chrome.storage.local.set({ murfApiKey: MURF_API_KEY });
        console.log('Updated Murf API key via UPDATE_API_SETTINGS message');
      }
      sendResponse({ status: 'api_key_updated' });
      break;

    case 'GET_LANGUAGES_AND_VOICES':
      isAsync = true;
      handleLanguagesAndVoicesRequest(sendResponse);
      break;

    case 'DOWNLOAD_AUDIO_FILES':
      isAsync = true;
      if (state.audioChunks && state.audioChunks.length > 0) {
        downloadAudioFiles(state.audioChunks)
          .then(() => sendResponse({ status: 'downloading' }))
          .catch(error => sendResponse({ status: 'error', error: error.message }));
      } else {
        sendResponse({ status: 'error', error: 'No audio files available' });
      }
      break;
  }

  return isAsync;
});

async function handleWebpageContent(message, tabId) {
  if (state.isProcessing) return;
  
  state.isProcessing = true;
  state.currentTab = tabId;
  state.detectedLanguage = message.detectedLang;
  state.audioChunks = [];
  
  try {
    let content = message.content;
    
    if (!state.targetLanguage) {
      state.targetLanguage = state.preferredLanguage;
    }
    console.log(`Processing translation: detected=${state.detectedLanguage}, target=${state.targetLanguage}`);
    
    if (state.detectedLanguage !== state.targetLanguage) {
      const translatedText = await translateText(
        message.content, 
        state.detectedLanguage, 
        state.targetLanguage
      );
      content = translatedText;
    } else {
      content = message.content;
    }
    
    state.translatedText = content;
    
    const translationId = Date.now().toString();
    state.lastTranslationId = translationId;
    
    state.storedTranslations[translationId] = {
      text: content,
      sourceLanguage: state.detectedLanguage,
      targetLanguage: state.targetLanguage,
      timestamp: Date.now(),
      title: message.title || 'Untitled'
    };
    
    console.log('Stored translation with ID:', translationId, 'length:', content.length, 
               'First 100 chars:', content.substring(0, 100));
    
    await generateAudioFromText(content, message.title);
    
    chrome.runtime.sendMessage({
      type: 'PROCESSING_COMPLETE',
      audioChunks: state.audioChunks
    });
  } catch (error) {
    console.error('Error processing content:', error);
    chrome.runtime.sendMessage({
      type: 'PROCESSING_ERROR',
      error: error.message
    });
  } finally {
    state.isProcessing = false;
  }
}

function startTranslationProcess(tabId) {
  state.isProcessing = false;
  state.currentTab = tabId;
  state.audioChunks = [];
  
  chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
  
  console.log('Started translation process for tab:', tabId);
}

function splitTextIntoChunks(text, maxLen = 3000) {
  console.log(`Splitting text into chunks (max ${maxLen} chars), total length: ${text.length}`);
  
  if (text.length <= maxLen) {
    return [text];
  }
  
  const chunks = [];
  
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxLen) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      if (paragraph.length > maxLen) {
        const sentences = paragraph.split(/([.!?]\s)/);
        let sentenceChunk = '';
        
        for (let i = 0; i < sentences.length; i++) {
          if (sentenceChunk.length + sentences[i].length > maxLen) {
            chunks.push(sentenceChunk);
            sentenceChunk = sentences[i];
          } else {
            sentenceChunk += sentences[i];
          }
        }
        
        if (sentenceChunk.length > 0) {
          if (currentChunk.length + sentenceChunk.length <= maxLen) {
            currentChunk += sentenceChunk;
          } else {
            chunks.push(sentenceChunk);
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n';
      }
      currentChunk += paragraph;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  console.log(`Split text into ${chunks.length} chunks`);
  return chunks;
}

async function generateAudioLocal(text, voiceId) {
  console.log(`Generating audio for ${text.length} characters using voice ${voiceId}`);
  
  try {
    if (!MURF_API_KEY || MURF_API_KEY.length < 10) {
      console.log('Using default Murf API key');
      MURF_API_KEY = 'ap2_50da4fd5-db8a-49fb-b638-bad3591e5da7';
    }
    
    let voice = voiceId;
    if (!voice) {
      voice = 'en-US-terrell';
      console.log('Using default voice: en-US-terrell');
    }
    
    if (voice && !voice.includes('-')) {
      const name = voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase();
      voice = `en-US-${name.toLowerCase()}`;
      console.log(`Converting voice name to full ID format: ${voice}`);
    }
    
    console.log('Final voice ID being used:', voice);
    
    const response = await fetch('https://api.murf.ai/v1/speech/generate', {
      method: 'POST',
      headers: {
        'api-key': MURF_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voiceId: voice,
        style: 'Conversational',
        format: 'MP3',
        modelVersion: 'GEN2'
      })
    });
    
    if (!response.ok) {
      console.error(`Failed to generate audio: ${response.status} ${response.statusText}`);
      try {
        const errorData = await response.json();
        console.error('Error details:', errorData);
      } catch (e) {
      }
      return 'data:audio/mp3;base64,AAAA';
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Response content-type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      console.log('Received JSON response from Murf API:', jsonResponse);
      
      if (jsonResponse.audioFile) {
        console.log('Found audioFile URL in response');
        return jsonResponse.audioFile;
      } else if (jsonResponse.audio_file) {
        console.log('Found audio_file URL in response');
        return jsonResponse.audio_file;
      } else if (jsonResponse.url) {
        console.log('Found url in response');
        return jsonResponse.url;
      } else {
        console.error('No audio URL found in JSON response');
        console.log('Response structure:', Object.keys(jsonResponse));
        return 'data:audio/mp3;base64,AAAA';
      }
    } else {
      console.log('Received binary audio response, converting to data URL');
      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('Successfully converted audio to data URL');
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.error('Error generating audio:', error);
    return 'data:audio/mp3;base64,AAAA';
  }
}

async function generateAudioFromText(text, title) {
  const chunks = splitTextIntoChunks(text);
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      if (typeof generateAudio !== 'function') {
        console.log('Using local generateAudio implementation');
        const audioUrl = await generateAudioLocal(chunks[i], state.preferredVoice);
        console.log('Generated audio URL:', audioUrl);
        state.audioChunks.push({
          index: i,
          title: i === 0 ? title : `Part ${i+1}`,
          audioUrl: audioUrl,
          duration: 5,
          chunkText: chunks[i].substring(0, 100) + '...'
        });
        continue;
      }
      
      const audioUrl = await generateAudio(chunks[i], state.preferredVoice);
      
      state.audioChunks.push({
        index: i,
        title: i === 0 ? title : `Part ${i+1}`,
        text: chunks[i].substring(0, 100) + '...',
        audioUrl: audioUrl,
        complete: true
      });
      
      chrome.runtime.sendMessage({
        type: 'CHUNK_PROCESSED',
        chunk: state.audioChunks[i],
        progress: {
          current: i + 1,
          total: chunks.length
        }
      });
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
    }
  }
}

async function getAvailableVoicesLocal() {
  console.log('Using local implementation of getAvailableVoices');
  
  const fallbackVoices = [
    // English US & Canada voices
    { id: 'en-US-natalie', name: 'Natalie (English US)', language: 'en-US' },
    { id: 'en-US-terrell', name: 'Terrell (English US)', language: 'en-US' },
    { id: 'en-US-ariana', name: 'Ariana (English US)', language: 'en-US' },
    { id: 'en-US-miles', name: 'Miles (English US)', language: 'en-US' },
    { id: 'en-US-zion', name: 'Zion (English US)', language: 'en-US' },
    { id: 'en-US-amara', name: 'Amara (English US)', language: 'en-US' },
    { id: 'en-US-maverick', name: 'Maverick (English US)', language: 'en-US' },
    { id: 'en-US-paul', name: 'Paul (English US)', language: 'en-US' },
    { id: 'en-US-charles', name: 'Charles (English US)', language: 'en-US' },
    { id: 'en-US-ken', name: 'Ken (English US)', language: 'en-US' },
    { id: 'en-US-carter', name: 'Carter (English US)', language: 'en-US' },
    { id: 'en-US-phoebe', name: 'Phoebe (English US)', language: 'en-US' },
    { id: 'en-US-riley', name: 'Riley (English US)', language: 'en-US' },
    { id: 'en-US-naomi', name: 'Naomi (English US)', language: 'en-US' },
    { id: 'en-US-alicia', name: 'Alicia (English US)', language: 'en-US' },
    { id: 'en-US-marcus', name: 'Marcus (English US)', language: 'en-US' },
    { id: 'en-US-samantha', name: 'Samantha (English US)', language: 'en-US' },
    { id: 'en-US-michelle', name: 'Michelle (English US)', language: 'en-US' },
    { id: 'en-US-ryan', name: 'Ryan (English US)', language: 'en-US' },
    { id: 'en-US-claire', name: 'Claire (English US)', language: 'en-US' },
    { id: 'en-US-wayne', name: 'Wayne (English US)', language: 'en-US' },
    { id: 'en-US-edmund', name: 'Edmund (English US)', language: 'en-US' },
    { id: 'en-US-iris', name: 'Iris (English US)', language: 'en-US' },
    { id: 'en-US-ronnie', name: 'Ronnie (English US)', language: 'en-US' },
    { id: 'en-US-daisy', name: 'Daisy (English US)', language: 'en-US' },
    { id: 'en-US-cooper', name: 'Cooper (English US)', language: 'en-US' },
    { id: 'en-US-charlotte', name: 'Charlotte (English US)', language: 'en-US' },
    { id: 'en-US-dylan', name: 'Dylan (English US)', language: 'en-US' },
    { id: 'en-US-julia', name: 'Julia (English US)', language: 'en-US' },
    { id: 'en-US-daniel', name: 'Daniel (English US)', language: 'en-US' },
    { id: 'en-US-june', name: 'June (English US)', language: 'en-US' },
    { id: 'en-US-river', name: 'River (English US)', language: 'en-US' },
    { id: 'en-US-evander', name: 'Evander (English US)', language: 'en-US' },
    { id: 'en-US-caleb', name: 'Caleb (English US)', language: 'en-US' },
    { id: 'en-US-molly', name: 'Molly (English US)', language: 'en-US' },
    { id: 'en-US-josie', name: 'Josie (English US)', language: 'en-US' },
    { id: 'en-US-delilah', name: 'Delilah (English US)', language: 'en-US' },
    { id: 'en-US-imani', name: 'Imani (English US)', language: 'en-US' },
    { id: 'en-US-jayden', name: 'Jayden (English US)', language: 'en-US' },
    { id: 'en-US-angela', name: 'Angela (English US)', language: 'en-US' },
    { id: 'en-US-denzel', name: 'Denzel (English US)', language: 'en-US' },
    { id: 'en-US-abigail', name: 'Abigail (English US)', language: 'en-US' },
    { id: 'en-US-ruby', name: 'Ruby (English US)', language: 'en-US' },
    { id: 'en-US-hazel', name: 'Hazel (English US)', language: 'en-US' },
    { id: 'en-US-freddie', name: 'Freddie (English US)', language: 'en-US' },
    { id: 'en-US-juliet', name: 'Juliet (English US)', language: 'en-US' },
    { id: 'en-US-pearl', name: 'Pearl (English US)', language: 'en-US' },
    { id: 'en-US-harrison', name: 'Harrison (English US)', language: 'en-US' },
    { id: 'en-US-hugo', name: 'Hugo (English US)', language: 'en-US' },
    { id: 'en-US-gabriel', name: 'Gabriel (English US)', language: 'en-US' },
    { id: 'en-US-jaxon', name: 'Jaxon (English US)', language: 'en-US' },
    { id: 'en-US-katie', name: 'Katie (English US)', language: 'en-US' },
    { id: 'en-US-jimm', name: 'Jimm (English US)', language: 'en-US' },
    { id: 'en-US-matthias', name: 'Matthias (English US)', language: 'en-US' },
    { id: 'en-US-giorgio', name: 'Giorgio (English US)', language: 'en-US' },
    
    // English UK voices
    { id: 'en-UK-theo', name: 'Theo (English UK)', language: 'en-UK' },
    { id: 'en-UK-ruby', name: 'Ruby (English UK)', language: 'en-UK' },
    { id: 'en-UK-hazel', name: 'Hazel (English UK)', language: 'en-UK' },
    { id: 'en-UK-freddie', name: 'Freddie (English UK)', language: 'en-UK' },
    { id: 'en-UK-mason', name: 'Mason (English UK)', language: 'en-UK' },
    { id: 'en-UK-juliet', name: 'Juliet (English UK)', language: 'en-UK' },
    { id: 'en-UK-pearl', name: 'Pearl (English UK)', language: 'en-UK' },
    { id: 'en-UK-finley', name: 'Finley (English UK)', language: 'en-UK' },
    { id: 'en-UK-harrison', name: 'Harrison (English UK)', language: 'en-UK' },
    { id: 'en-UK-heidi', name: 'Heidi (English UK)', language: 'en-UK' },
    { id: 'en-UK-hugo', name: 'Hugo (English UK)', language: 'en-UK' },
    { id: 'en-UK-gabriel', name: 'Gabriel (English UK)', language: 'en-UK' },
    { id: 'en-UK-jaxon', name: 'Jaxon (English UK)', language: 'en-UK' },
    { id: 'en-UK-peter', name: 'Peter (English UK)', language: 'en-UK' },
    { id: 'en-UK-reggie', name: 'Reggie (English UK)', language: 'en-UK' },
    { id: 'en-UK-katie', name: 'Katie (English UK)', language: 'en-UK' },
    { id: 'en-UK-amber', name: 'Amber (English UK)', language: 'en-UK' },
    { id: 'en-UK-aiden', name: 'Aiden (English UK)', language: 'en-UK' },
    
    // English India voices
    { id: 'en-IN-aarav', name: 'Aarav (English India)', language: 'en-IN' },
    { id: 'en-IN-arohi', name: 'Arohi (English India)', language: 'en-IN' },
    { id: 'en-IN-rohan', name: 'Rohan (English India)', language: 'en-IN' },
    { id: 'en-IN-alia', name: 'Alia (English India)', language: 'en-IN' },
    { id: 'en-IN-surya', name: 'Surya (English India)', language: 'en-IN' },
    { id: 'en-IN-priya', name: 'Priya (English India)', language: 'en-IN' },
    { id: 'en-IN-shivani', name: 'Shivani (English India)', language: 'en-IN' },
    { id: 'en-IN-isha', name: 'Isha (English India)', language: 'en-IN' },
    { id: 'en-IN-eashwar', name: 'Eashwar (English India)', language: 'en-IN' },
    
    // English Australia voices
    { id: 'en-AU-kylie', name: 'Kylie (English Australia)', language: 'en-AU' },
    { id: 'en-AU-jimm', name: 'Jimm (English Australia)', language: 'en-AU' },
    { id: 'en-AU-harper', name: 'Harper (English Australia)', language: 'en-AU' },
    { id: 'en-AU-evelyn', name: 'Evelyn (English Australia)', language: 'en-AU' },
    { id: 'en-AU-mitch', name: 'Mitch (English Australia)', language: 'en-AU' },
    { id: 'en-AU-leyton', name: 'Leyton (English Australia)', language: 'en-AU' },
    { id: 'en-AU-ashton', name: 'Ashton (English Australia)', language: 'en-AU' },
    { id: 'en-AU-ivy', name: 'Ivy (English Australia)', language: 'en-AU' },
    { id: 'en-AU-shane', name: 'Shane (English Australia)', language: 'en-AU' },
    { id: 'en-AU-joyce', name: 'Joyce (English Australia)', language: 'en-AU' },
    { id: 'en-AU-sophia', name: 'Sophia (English Australia)', language: 'en-AU' },
    
    // English Scotland voices
    { id: 'en-SCOTT-rory', name: 'Rory (English Scotland)', language: 'en-SCOTT' },
    { id: 'en-SCOTT-emily', name: 'Emily (English Scotland)', language: 'en-SCOTT' },

    // French voices
    { id: 'fr-FR-adélie', name: 'Adelie (French)', language: 'fr-FR' },
    { id: 'fr-FR-maxime', name: 'Maxime (French)', language: 'fr-FR' },
    { id: 'fr-FR-axel', name: 'Axel (French)', language: 'fr-FR' },
    { id: 'fr-FR-justine', name: 'Justine (French)', language: 'fr-FR' },
    { id: 'fr-FR-louis', name: 'Louis (French)', language: 'fr-FR' },
    { id: 'fr-FR-louise', name: 'Louise (French)', language: 'fr-FR' },
    { id: 'fr-FR-natalie', name: 'Natalie (French)', language: 'fr-FR' },
    
    // German voices
    { id: 'de-DE-matthias', name: 'Matthias (German)', language: 'de-DE' },
    { id: 'de-DE-lia', name: 'Lia (German)', language: 'de-DE' },
    { id: 'de-DE-björn', name: 'Björn (German)', language: 'de-DE' },
    { id: 'de-DE-erna', name: 'Erna (German)', language: 'de-DE' },
    { id: 'de-DE-lara', name: 'Lara (German)', language: 'de-DE' },
    { id: 'de-DE-josephine', name: 'Josephine (German)', language: 'de-DE' },
    { id: 'de-DE-ralf', name: 'Ralf (German)', language: 'de-DE' },
    
    // Spanish Spain voices
    { id: 'es-ES-elvira', name: 'Elvira (Spanish Spain)', language: 'es-ES' },
    { id: 'es-ES-enrique', name: 'Enrique (Spanish Spain)', language: 'es-ES' },
    { id: 'es-ES-carmen', name: 'Carmen (Spanish Spain)', language: 'es-ES' },
    { id: 'es-ES-javier', name: 'Javier (Spanish Spain)', language: 'es-ES' },
    { id: 'es-ES-carla', name: 'Carla (Spanish Spain)', language: 'es-ES' },
    
    // Spanish Mexico voices
    { id: 'es-MX-carlos', name: 'Carlos (Spanish Mexico)', language: 'es-MX' },
    { id: 'es-MX-alejandro', name: 'Alejandro (Spanish Mexico)', language: 'es-MX' },
    { id: 'es-MX-valeria', name: 'Valeria (Spanish Mexico)', language: 'es-MX' },
    { id: 'es-MX-luisa', name: 'Luisa (Spanish Mexico)', language: 'es-MX' },
    
    // Italian voices
    { id: 'it-IT-lorenzo', name: 'Lorenzo (Italian)', language: 'it-IT' },
    { id: 'it-IT-greta', name: 'Greta (Italian)', language: 'it-IT' },
    { id: 'it-IT-vincenzo', name: 'Vincenzo (Italian)', language: 'it-IT' },
    { id: 'it-IT-giorgio', name: 'Giorgio (Italian)', language: 'it-IT' },
    { id: 'it-IT-vera', name: 'Vera (Italian)', language: 'it-IT' },
    
    // Portuguese Brazil voices
    { id: 'pt-BR-heitor', name: 'Heitor (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-isadora', name: 'Isadora (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-eloa', name: 'Eloa (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-benicio', name: 'Benicio (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-gustavo', name: 'Gustavo (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-silvio', name: 'Silvio (Portuguese Brazil)', language: 'pt-BR' },
    { id: 'pt-BR-yago', name: 'Yago (Portuguese Brazil)', language: 'pt-BR' },
    
    // Chinese voices
    { id: 'zh-CN-tao', name: 'Tao (Chinese)', language: 'zh-CN' },
    { id: 'zh-CN-jiao', name: 'Jiao (Chinese)', language: 'zh-CN' },
    { id: 'zh-CN-baolin', name: 'Baolin (Chinese)', language: 'zh-CN' },
    { id: 'zh-CN-wei', name: 'Wei (Chinese)', language: 'zh-CN' },
    { id: 'zh-CN-zhang', name: 'Zhang (Chinese)', language: 'zh-CN' },
    { id: 'zh-CN-yuxan', name: 'Yuxan (Chinese)', language: 'zh-CN' },
    
    // Hindi voices
    { id: 'hi-IN-kabir', name: 'Kabir (Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-ayushi', name: 'Ayushi (Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-shaan', name: 'Shaan (Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-rahul', name: 'Rahul (Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-shweta', name: 'Shweta (Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-amit', name: 'Amit (Hindi)', language: 'hi-IN' },
    
    // Korean voices
    { id: 'ko-KR-gyeong', name: 'Gyeong (Korean)', language: 'ko-KR' },
    { id: 'ko-KR-hwan', name: 'Hwan (Korean)', language: 'ko-KR' },
    { id: 'ko-KR-jangmi', name: 'Jangmi (Korean)', language: 'ko-KR' },
    { id: 'ko-KR-jong-su', name: 'Jong-su (Korean)', language: 'ko-KR' },
    { id: 'ko-KR-sanghoon', name: 'SangHoon (Korean)', language: 'ko-KR' },
    
    // Croatian voices
    { id: 'hr-HR-marija', name: 'Marija (Croatian)', language: 'hr-HR' },
    
    // Greek voices
    { id: 'el-GR-stavros', name: 'Stavros (Greek)', language: 'el-GR' },
    
    // Slovak voices
    { id: 'sk-SK-tibor', name: 'Tibor (Slovak)', language: 'sk-SK' },
    { id: 'sk-SK-nina', name: 'Nina (Slovak)', language: 'sk-SK' },

    // Dutch voices
    { id: 'nl-NL-dirk', name: 'Dirk (Dutch)', language: 'nl-NL' },
    { id: 'nl-NL-merel', name: 'Merel (Dutch)', language: 'nl-NL' },
    { id: 'nl-NL-famke', name: 'Famke (Dutch)', language: 'nl-NL' },

    // Polish voices
    { id: 'pl-PL-jacek', name: 'Jacek (Polish)', language: 'pl-PL' },
    { id: 'pl-PL-kasia', name: 'Kasia (Polish)', language: 'pl-PL' },
    { id: 'pl-PL-blazej', name: 'Blazej (Polish)', language: 'pl-PL' },


    // Japanese voices
    { id: 'ja-JP-kenji', name: 'Kenji (Japanese)', language: 'ja-JP' },
    { id: 'ja-JP-kimi', name: 'Kimi (Japanese)', language: 'ja-JP' },
    { id: 'ja-JP-denki', name: 'Denki (Japanese)', language: 'ja-JP' }
  ];
  
  if (!MURF_API_KEY) {
    console.log('No Murf API key found, returning fallback voices');
    return fallbackVoices;
  }

  try {
    const response = await fetch('https://api.murf.ai/v1/speech/voices', {
      method: 'GET',
      headers: {
        'api-key': MURF_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
      return fallbackVoices;
    }
    
    const data = await response.json();
    console.log('Murf voices response:', data);
    
    if (data && Array.isArray(data.voices)) {
      return data.voices.map(voice => {
        let voiceId = voice.voice_id;
        if (voiceId && !voiceId.includes('-')) {
          const langCode = voice.language_code;
          const voiceName = voice.name.toLowerCase().replace(/\s+/g, '');
          
          if (langCode && langCode.includes('-')) {
            voiceId = `${langCode}-${voiceName}`;
            console.log(`Converted voice ID from ${voice.voice_id} to ${voiceId}`);
          }
        }
        
        return {
          id: voiceId,
          name: `${voice.name} (${voice.language})`,
          language: voice.language_code
        };
      });
    } else {
      console.warn('Unexpected voices response format');
      return fallbackVoices;
    }
  } catch (error) {
    console.error('Error fetching voices:', error);
    return fallbackVoices;
  }
}

async function handleLanguagesAndVoicesRequest(sendResponse) {
  try {
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'French' },
      { code: 'es', name: 'Spanish' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ko', name: 'Korean' },
      { code: 'hr', name: 'Croatian' },
      { code: 'el', name: 'Greek' },
      { code: 'sk', name: 'Slovak' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'ja', name: 'Japanese' }
    ];
    
    const voices = await getAvailableVoicesLocal();
    
    sendResponse({ 
      languages: languages,
      voices: voices
    });
    
  } catch (error) {
    console.error('Error fetching languages and voices:', error);
    sendResponse({ 
      error: error.message,
      languages: [{ code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' }],
      voices: [
        { id: 'en-US-natalie', name: 'Natalie (English)', language: 'en-US' },
        { id: 'fr-FR-maxime', name: 'Maxime (French)', language: 'fr-FR' },
        { id: 'es-ES-elvira', name: 'Elvira (Spanish)', language: 'es-ES' }
      ]
    });
  }
}

async function downloadAudioFiles(audioChunks) {
  console.log(`Starting download of ${audioChunks.length} audio files`);
  
  const date = new Date();
  const folderName = `podcast_${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;
  
  for (let i = 0; i < audioChunks.length; i++) {
    const chunk = audioChunks[i];
    if (chunk && chunk.audioUrl) {
      try {
        const filename = `${folderName}/chunk_${(i+1).toString().padStart(2, '0')}.mp3`;
        console.log(`Downloading ${chunk.audioUrl} as ${filename}`);
        
        await chrome.downloads.download({
          url: chunk.audioUrl,
          filename: filename,
          conflictAction: 'uniquify'
        });
        
        if (i < audioChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`Error downloading audio file ${i+1}:`, error);
        sendResponse({ status: 'error', error: error.message });
        throw error;
      }
    }
  }
  
  console.log('All audio files downloaded successfully');
  return true;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === state.currentTab) {
    state.isProcessing = false;
    state.audioChunks = [];
    state.currentPlayingIndex = -1;
  }
});

console.log('Web-to-Podcast Translator service worker initialized');