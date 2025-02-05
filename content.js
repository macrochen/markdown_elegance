// 全局变量，用于跟踪库的加载状态
let librariesLoaded = false;

// 检查是否已经加载过脚本
if (!window.markdownConverterInitialized) {
  window.markdownConverterInitialized = true;


  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'convert') {

      switch (request.type) {
        case 'text':
          await convertToPlainText(request.content);
          break;
        case 'image':
          await convertToImage(request.content, true);
          break;
        case 'save':
          await convertToImage(request.content, false);
          break;
      }
    }
  });
}

// 转换为纯文本
async function convertToPlainText(markdown) {
  const plainText = markdown
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
    .replace(/^>\s/gm, '')
    .replace(/^[-+*]\s/gm, '')
    .replace(/^(\d+)\.\s/gm, '$1. ')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/^\s*[-=]{3,}\s*$/gm, '');

  // 发送到 background 处理
  chrome.runtime.sendMessage({
    action: 'copyText',
    text: plainText
  });
}

// 转换为图片
async function convertToImage(markdown, copyToClipboard) {
  // 在新标签页中打开 index.html，并传递 markdown 内容
  chrome.runtime.sendMessage({
    action: 'openIndexHtml',
    markdown: markdown
  });
}