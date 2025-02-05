document.getElementById('copyText').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const text = await navigator.clipboard.readText();
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  chrome.tabs.sendMessage(tab.id, { 
    action: 'convert', 
    type: 'text', 
    content: text 
  });
});

document.getElementById('copyImage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const text = await navigator.clipboard.readText();
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  chrome.tabs.sendMessage(tab.id, { 
    action: 'convert', 
    type: 'image', 
    content: text 
  });
});

document.getElementById('saveImage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const text = await navigator.clipboard.readText();
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  chrome.tabs.sendMessage(tab.id, { 
    action: 'convert', 
    type: 'save', 
    content: text 
  });
});