/**
 * Web-to-Podcast Translator - Content Script
 * Extracts webpage content using Readability.js
 */

// Include Readability.js via mozilla/readability
// For a real extension, you would bundle this or include it as a separate file
// This is a simplified version of Readability for demo purposes
(function() {
  // Simplified Readability implementation
  class Readability {
    constructor(document) {
      this.document = document;
      this.articleContent = null;
    }
    
    /**
     * Extract the main content from the page
     */
    parse() {
      // Get the article content
      const article = this.getArticleContent();
      
      // Create a result object similar to Mozilla's Readability
      return {
        title: this.getArticleTitle(),
        content: article,
        textContent: this.getTextContent(article),
        length: article.length
      };
    }
    
    /**
     * Get the article title
     */
    getArticleTitle() {
      // Try to get the article title from various meta tags and elements
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
      
      // Fallback to the document title
      return document.title.trim();
    }
    
    /**
     * Get the main article content
     */
    getArticleContent() {
      // Priority elements to check for content
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
      
      // Try to get content from major container elements first
      for (const element of contentElements) {
        if (element && element.textContent.length > 500) {
          console.log('Found content in element:', element.tagName, element.className || 'no-class');
          return element.innerHTML;
        }
      }
      
      // Second attempt: Try to grab all paragraphs and headings
      const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, article, section, .article, .post');
      if (paragraphs.length > 5) {
        const contentContainer = document.createElement('div');
        paragraphs.forEach(p => {
          // Only add paragraphs with meaningful content (avoid menu items, etc.)
          if (p.textContent.trim().length > 25) {
            contentContainer.appendChild(p.cloneNode(true));
          }
        });
        
        if (contentContainer.textContent.length > 500) {
          console.log('Built content from paragraphs:', paragraphs.length, 'total length:', contentContainer.textContent.length);
          return contentContainer.innerHTML;
        }
      }
      
      // Fallback: Use the body content but try to remove navigation, header, footer, etc.
      console.log('Using body content fallback method');
      const body = document.body.cloneNode(true);
      
      // Remove common non-content elements
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
    
    /**
     * Extract plain text from HTML content
     */
    getTextContent(html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Remove scripts, styles, and other non-content elements
      const scripts = tempDiv.querySelectorAll('script, style, noscript, iframe');
      for (const script of scripts) {
        script.remove();
      }
      
      // Get the text content
      return tempDiv.textContent.trim()
        .replace(/\s+/g, ' ') // Replace multiple whitespace with a single space
        .replace(/\n+/g, '\n\n'); // Replace multiple newlines with double newlines
    }
  }
  
  // Export to global scope for use in our content script
  window.Readability = Readability;
})();

/**
 * Extract content from the current webpage
 */
function extractContent() {
  console.log('Extracting content from webpage');
  
  try {
    // Create a new Readability object
    const reader = new window.Readability(document.cloneNode(true));
    
    // Parse the document
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

/**
 * Detect the language of the current page
 */
async function detectPageLanguage(text) {
  // First try to use the lang attribute on html or body
  const htmlLang = document.documentElement.lang || document.body.lang;
  if (htmlLang) {
    console.log('Language detected from HTML lang attribute:', htmlLang);
    return htmlLang.split('-')[0]; // Convert 'en-US' to 'en'
  }
  
  // Use the meta tag if available
  const metaLang = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLang && metaLang.content) {
    console.log('Language detected from meta tag:', metaLang.content);
    return metaLang.content.split('-')[0];
  }
  
  // If we couldn't detect from the page, use the LibreTranslate API
  try {
    // Send message to background script to detect language
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
    return 'en'; // Default to English
  }
}

/**
 * Process the current page and send to background script
 */
async function processPage() {
  // Extract the content
  const extractedContent = extractContent();
  
  if (!extractedContent) {
    console.error('Failed to extract content from the page');
    return;
  }
  
  // Detect the language
  const detectedLang = await detectPageLanguage(extractedContent.content);
  
  // Send message to background script
  chrome.runtime.sendMessage({
    type: 'WEBPAGE_TEXT',
    title: extractedContent.title,
    content: extractedContent.content,
    detectedLang: detectedLang
  }, (response) => {
    console.log('Background script response:', response);
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    console.log('Received extract content message');
    processPage();
    sendResponse({ status: 'extracting' });
  }
  
  return true; // Return true to indicate we'll respond asynchronously
});

// Auto-extract when the script loads
// Wait a bit for the page to fully render before extraction
console.log('Setting up auto-extract with delay');
setTimeout(processPage, 2000);
