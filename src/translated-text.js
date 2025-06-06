document.addEventListener('DOMContentLoaded', function() {
  const translatedContent = document.getElementById('translatedContent');
  const sourceLanguage = document.getElementById('sourceLanguage');
  const targetLanguage = document.getElementById('targetLanguage');
  const copyBtn = document.getElementById('copyBtn');
  const printBtn = document.getElementById('printBtn');
  const closeBtn = document.getElementById('closeBtn');
  const status = document.getElementById('status');

  const params = new URLSearchParams(window.location.search);
  const textId = params.get('id');
  
  if (!textId) {
    translatedContent.textContent = 'Error: No translated text available.';
    setStatus('No text ID provided. Please translate content first.', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({ 
    type: 'GET_STORED_TRANSLATION', 
    id: textId 
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      translatedContent.textContent = 'Error: Could not retrieve translated text.';
      setStatus('Connection error. Please try translating again.', 'error');
      return;
    }
    
    if (response && response.translatedText) {
      translatedContent.textContent = response.translatedText;
      
      if (response.sourceLanguage) {
        sourceLanguage.textContent = getLanguageName(response.sourceLanguage);
      }
      
      if (response.targetLanguage) {
        targetLanguage.textContent = getLanguageName(response.targetLanguage);
      }
      
      setStatus('Translation loaded successfully.');
    } else {
      translatedContent.textContent = 'No translated text available.';
      setStatus('Translation not found. Please translate content first.', 'error');
    }
  });
  
  copyBtn.addEventListener('click', function() {
    const text = translatedContent.textContent;
    
    if (text && text !== 'Loading translated text...' && 
        text !== 'Error: No translated text available.' && 
        text !== 'No translated text available.') {
      
      navigator.clipboard.writeText(text)
        .then(() => {
          setStatus('Text copied to clipboard!', 'success');
          
          copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy to Clipboard';
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          setStatus('Failed to copy text to clipboard.', 'error');
        });
    } else {
      setStatus('No text available to copy.', 'error');
    }
  });
  
  printBtn.addEventListener('click', function() {
    window.print();
  });
  closeBtn.addEventListener('click', function() {
    window.close();
  });

  function setStatus(message, type = 'info') {
    status.textContent = message;
    status.className = 'status ' + type;
  
    if (type === 'success') {
      setTimeout(() => {
        status.textContent = '';
      }, 5000);
    }
  }
  
  function getLanguageName(code) {
    const languageMap = {
      'en': 'English',
      'en-US': 'English',
      'fr': 'French',
      'fr-FR': 'French',
      'es': 'Spanish',
      'es-ES': 'Spanish',
      'de': 'German',
      'de-DE': 'German',
      'it': 'Italian',
      'it-IT': 'Italian',
      'pt': 'Portuguese',
      'pt-PT': 'Portuguese',
      'nl': 'Dutch',
      'nl-NL': 'Dutch',
      'ru': 'Russian',
      'ru-RU': 'Russian',
      'ja': 'Japanese',
      'ja-JP': 'Japanese',
      'zh': 'Chinese',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ar': 'Arabic',
      'ar-SA': 'Arabic',
      'hi': 'Hindi',
      'hi-IN': 'Hindi',
      'ko': 'Korean',
      'ko-KR': 'Korean'
    };
    
    return languageMap[code] || code;
  }
});
