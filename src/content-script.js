(function() {
  class Readability {
    constructor(document) {
      this.document = document;
      this.articleContent = null;
    }
    
    parse() {
      const article = this.getArticleContent();
      
      return {
        title: this.getArticleTitle(),
        content: article,
        textContent: this.getTextContent(article),
        length: article.length
      };
    }
    
    getArticleTitle() {
      const metaTitleElements = [
        document.querySelector('meta[property="og:title"]'),
        document.querySelector('meta[name="twitter:title"]'),
        document.querySelector('meta[name="title"]')
      ];
      
      for (const element of metaTitleElements) {
        if (element && element.getAttribute('content')) {
          return element.getAttribute('content').trim();
        }
      }
      return document.title.trim();
    }
    
    getArticleContent() {
      const contentElements = [
        document.querySelector('article'),
        document.querySelector('[role="main"]'),
        document.querySelector('main'),
        document.querySelector('.main-content'),
        document.querySelector('#content'),
        document.querySelector('.content'),
        document.querySelector('.post-content'),
        document.querySelector('.entry-content')
      ];
      
      for (const element of contentElements) {
        if (element && element.textContent.length > 500) {
          console.log('Found content in element:', element.tagName, element.className || 'no-class');
          return element.innerHTML;
        }
      }
      
      const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, article, section, .article, .post');
      if (paragraphs.length > 5) {
        const contentContainer = document.createElement('div');
        paragraphs.forEach(p => {
          if (p.textContent.trim().length > 25) {
            contentContainer.appendChild(p.cloneNode(true));
          }
        });
        
        if (contentContainer.textContent.length > 500) {
          console.log('Built content from paragraphs:', paragraphs.length, 'total length:', contentContainer.textContent.length);
          return contentContainer.innerHTML;
        }
      }
      
      console.log('Using body content fallback method');
      const body = document.body.cloneNode(true);
      
      const elementsToRemove = [
        'header', 'footer', 'nav', 'aside',
        '.nav', '.navigation', '.menu', '.header', '.footer',
        '.sidebar', '.comments', '.advertisement', '.ads',
        'script', 'style', 'iframe', 'noscript', 'svg',
        '.social-share', '.share-buttons', '.related-posts',
        '.cookie-banner', '.popup', '.modal', '.overlay'
      ];
      
      for (const selector of elementsToRemove) {
        const elements = body.querySelectorAll(selector);
        console.log(`Removing ${elements.length} ${selector} elements`);
        for (const element of elements) {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }
      }
      
      return body.innerHTML;
    }
    
    getTextContent(html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const scripts = tempDiv.querySelectorAll('script, style, noscript, iframe');
      for (const script of scripts) {
        script.remove();
      }
      
      return tempDiv.textContent.trim()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n\n');
    }
  }
  
  window.Readability = Readability;
})();

function extractContent() {
  console.log('Extracting content from webpage');
  
  try {
    const reader = new window.Readability(document.cloneNode(true));
    const article = reader.parse();
    
    if (!article || !article.textContent || article.textContent.length < 100) {
      console.warn('Extracted content is too short or empty');
      return null;
    }
    
    console.log('Content extracted successfully:', {
      title: article.title,
      length: article.textContent.length
    });
    
    return {
      title: article.title,
      content: article.textContent
    };
  } catch (error) {
    console.error('Error extracting content:', error);
    return null;
  }
}

async function detectPageLanguage(text) {
  const htmlLang = document.documentElement.lang || document.body.lang;
  if (htmlLang) {
    console.log('Language detected from HTML lang attribute:', htmlLang);
    return htmlLang.split('-')[0];
  }
  
  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang && metaLang.content) {
    console.log('Language detected from meta tag:', metaLang.content);
    return metaLang.content.split('-')[0];
  }
  
  try {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'DETECT_LANGUAGE', text: text.substring(0, 1000) },
        (response) => {
          if (response && response.language) {
            console.log('Language detected via API:', response.language);
            resolve(response.language);
          } else {
            console.log('Language detection failed, defaulting to English');
            resolve('en');
          }
        }
      );
    });
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en';
  }
}

async function processPage() {
  const extractedContent = extractContent();
  
  if (!extractedContent) {
    console.error('Failed to extract content from the page');
    return;
  }
  
  const detectedLang = await detectPageLanguage(extractedContent.content);
  
  chrome.runtime.sendMessage({
    type: 'WEBPAGE_TEXT',
    title: extractedContent.title,
    content: extractedContent.content,
    detectedLang: detectedLang
  }, (response) => {
    console.log('Background script response:', response);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    console.log('Received extract content message');
    processPage();
    sendResponse({ status: 'extracting' });
  }
  
  return true;
});

console.log('Setting up auto-extract with delay');
setTimeout(processPage, 2000);
