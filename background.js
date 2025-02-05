// 处理来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'copyText':
      console.log('收到复制请求，文本内容:', request.text);
      
      // 在当前标签页中执行剪贴板操作
      chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        if (tab) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: text => {
              // 创建临时文本区域
              const textarea = document.createElement('textarea');
              textarea.value = text;
              textarea.style.position = 'fixed';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              
              try {
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
              } catch (err) {
                console.error('复制失败:', err);
                document.body.removeChild(textarea);
                return false;
              }
            },
            args: [request.text]
          }).then(results => {
            const success = results[0].result;
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'image.png',
              title: 'Markdown 转换工具',
              message: success ? '文本已复制到剪贴板' : '复制失败'
            });
            sendResponse({ success });
          });
        }
      });
      return true;
      
    case 'download':
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      chrome.downloads.download({
        url: request.url,
        filename: `markdown-${timestamp}.png`
      });
      break;
  }
  return true;
});

// 处理扩展安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('Markdown 格式转换工具已安装');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openIndexHtml') {
    chrome.tabs.create({ url: 'index.html' }, (tab) => {
      // 等待页面加载完成后发送 markdown 内容
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(tabId, {
            action: 'setMarkdown',
            markdown: request.markdown
          });
        }
      });
    });
  }
  // ... 其他消息处理 ...
});
