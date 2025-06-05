/**
 * Web-to-Podcast Translator - Murf Integration Module
 * Handles text chunking and speech synthesis using Murf API
 */

// This would normally be stored securely and loaded from chrome.storage.local
// For development, we'll need to set this in the options page
let MURF_API_KEY = '';

// Make sure MURF_API_KEY is globally available
if (typeof window === 'undefined') {
  // Service worker environment
  self.MURF_API_KEY = MURF_API_KEY;
}

/**
 * Split text into manageable chunks for TTS processing
 * @param {string} text - Full text to split
 * @param {number} maxLen - Maximum length of each chunk (default: 3000 characters)
 * @returns {Array<string>} - Array of text chunks
 */
function splitIntoChunks(text, maxLen = 3000) {
  console.log(`Splitting text into chunks (max ${maxLen} chars), total length: ${text.length}`);
  
  // If text is already small enough, return as a single chunk
  if (text.length <= maxLen) {
    return [text];
  }
  
  const chunks = [];
  
  // Split text by paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Skip empty paragraphs
    if (!paragraph.trim()) continue;
    
    // If adding this paragraph would exceed maxLen, 
    // save the current chunk and start a new one
    if (currentChunk.length + paragraph.length + 2 > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If a single paragraph is longer than maxLen, split it by sentences
      if (paragraph.length > maxLen) {
        const sentenceChunks = splitBySentences(paragraph, maxLen);
        chunks.push(...sentenceChunks);
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  console.log(`Created ${chunks.length} chunks, average chunk size: ${Math.round(text.length / chunks.length)} chars`);
  
  return chunks;
}

/**
 * Split a long paragraph into sentences respecting the maximum length
 * @param {string} paragraph - Long paragraph to split
 * @param {number} maxLen - Maximum length of each chunk
 * @returns {Array<string>} - Array of text chunks split by sentences
 */
function splitBySentences(paragraph, maxLen) {
  const chunks = [];
  
  // Split by sentences (basic implementation - doesn't handle all cases)
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed maxLen, 
    // save the current chunk and start a new one
    if (currentChunk.length + sentence.length > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If a single sentence is longer than maxLen, split it by words
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
      // Add sentence to current chunk
      if (currentChunk) {
        currentChunk += ' ' + sentence;
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Generate audio from text using Murf API
 * @param {string} textChunk - Text to convert to speech
 * @param {string} voiceId - Voice ID to use for synthesis
 * @returns {Promise<string>} - URL to the generated audio file
 */
async function generateAudio(textChunk, voiceId) {
  try {
    console.log(`Generating audio for chunk (${textChunk.length} chars) with voice: ${voiceId}`);
    
    // Load API key from storage
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
      return data.audioFile; // URL to the generated audio file
    } else {
      throw new Error('Audio file URL not found in Murf API response');
    }
  } catch (error) {
    console.error('Error generating audio:', error);
    throw error;
  }
}

/**
 * Get available voices from Murf API
 * @returns {Promise<Array>} - Array of available voices
 */
async function getAvailableVoices() {
  try {
    // Try to load API key if not already loaded
    if (!MURF_API_KEY) {
      const result = await chrome.storage.local.get(['murfApiKey']);
      MURF_API_KEY = result.murfApiKey;
      
      if (!MURF_API_KEY) {
        console.warn('Murf API key not found. Using fallback voice data.');
        // Return fallback voices when API key isn't set yet
        return [
          { id: 'en-US-natalie', name: 'Natalie', language: 'en-US' },
          { id: 'fr-FR-maxime', name: 'Maxime', language: 'fr-FR' },
          { id: 'es-ES-elvira', name: 'Elvira', language: 'es-ES' }
        ];
      }
      
      // Update the global MURF_API_KEY for service worker environment
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
    // Return a default set of voices
    return [
      { id: 'en-US-natalie', name: 'Natalie (English)', language: 'en-US' },
      { id: 'fr-FR-maxime', name: 'Maxime (French)', language: 'fr-FR' },
      { id: 'es-ES-elvira', name: 'Elvira (Spanish)', language: 'es-ES' }
    ];
  }
}

// Make functions globally available for service worker
if (typeof window === 'undefined') {
  // We're in a service worker environment
  self.splitIntoChunks = splitIntoChunks;
  self.splitBySentences = splitBySentences;
  self.generateAudio = generateAudio;
  self.getAvailableVoices = getAvailableVoices;
  console.log('Murf.js: Functions exported to service worker global scope');
}
