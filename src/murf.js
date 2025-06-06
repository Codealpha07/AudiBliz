let MURF_API_KEY = '';

if (typeof window === 'undefined') {
  // Service worker environment
  self.MURF_API_KEY = MURF_API_KEY;
}

function splitIntoChunks(text, maxLen = 3000) {
  console.log(`Splitting text into chunks (max ${maxLen} chars), total length: ${text.length}`);
  
  if (text.length <= maxLen) {
    return [text];
  }
  
  const chunks = [];
  
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;
    
    if (currentChunk.length + paragraph.length + 2 > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      if (paragraph.length > maxLen) {
        const sentenceChunks = splitBySentences(paragraph, maxLen);
        chunks.push(...sentenceChunks);
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    } else {
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  console.log(`Created ${chunks.length} chunks, average chunk size: ${Math.round(text.length / chunks.length)} chars`);
  
  return chunks;
}

function splitBySentences(paragraph, maxLen) {
  const chunks = [];
  
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      if (sentence.length > maxLen) {
        let sentenceFragment = '';
        const words = sentence.split(' ');
        
        for (const word of words) {
          if (sentenceFragment.length + word.length + 1 > maxLen) {
            chunks.push(sentenceFragment);
            sentenceFragment = word;
          } else {
            if (sentenceFragment) {
              sentenceFragment += ' ' + word;
            } else {
              sentenceFragment = word;
            }
          }
        }
        
        if (sentenceFragment) {
          currentChunk = sentenceFragment;
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = sentence;
      }
    } else {
      if (currentChunk) {
        currentChunk += ' ' + sentence;
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

async function generateAudio(textChunk, voiceId) {
  try {
    console.log(`Generating audio for chunk (${textChunk.length} chars) with voice: ${voiceId}`);
  
    if (!MURF_API_KEY) {
      const result = await chrome.storage.local.get(['murfApiKey']);
      MURF_API_KEY = result.murfApiKey;
      
      if (!MURF_API_KEY) {
        throw new Error('Murf API key not found. Please go to the extension options page and set your Murf API key to generate audio.');
      }
    }
    
    const response = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: "POST",
      headers: {
        "api-key": MURF_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: textChunk,
        voiceId: voiceId,
        style: "Conversational",
        format: "MP3",
        modelVersion: "GEN2"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Murf API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.audioFile) {
      console.log('Audio generation successful');
      return data.audioFile;
    } else {
      throw new Error('Audio file URL not found in Murf API response');
    }
  } catch (error) {
    console.error('Error generating audio:', error);
    throw error;
  }
}

async function getAvailableVoices() {
  try {
    if (!MURF_API_KEY) {
      const result = await chrome.storage.local.get(['murfApiKey']);
      MURF_API_KEY = result.murfApiKey;
      
      if (!MURF_API_KEY) {
        console.warn('Murf API key not found. Using fallback voice data.');
        return [
          { id: 'en-US-natalie', name: 'Natalie', language: 'en-US' },
          { id: 'fr-FR-maxime', name: 'Maxime', language: 'fr-FR' },
          { id: 'es-ES-elvira', name: 'Elvira', language: 'es-ES' }
        ];
      } 
      
      if (typeof window === 'undefined') {
        self.MURF_API_KEY = MURF_API_KEY;
      } 
    } 
      
    const response = await fetch("https://api.murf.ai/v1/voices", {
      method: "GET",
      headers: {
        "api-key": MURF_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
    }
    
    const voices = await response.json();
    console.log('Available voices:', voices);
    
    return voices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [
      { id: 'en-US-natalie', name: 'Natalie (English)', language: 'en-US' },
      { id: 'fr-FR-maxime', name: 'Maxime (French)', language: 'fr-FR' },
      { id: 'es-ES-elvira', name: 'Elvira (Spanish)', language: 'es-ES' }
    ];
  }
}

if (typeof window === 'undefined') {
  self.splitIntoChunks = splitIntoChunks;
  self.splitBySentences = splitBySentences;
  self.generateAudio = generateAudio;
  self.getAvailableVoices = getAvailableVoices;
  console.log('Murf.js: Functions exported to service worker global scope');
}
