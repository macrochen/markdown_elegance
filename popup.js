
// 辅助函数：显示通知
function showNotification(message) {
  // 创建一个临时的提示元素
  const div = document.createElement('div');
  div.textContent = message;
  div.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

// 修复格式并复制
document.getElementById('fixFormat').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    
    // 修复逻辑
    const parts = text.split('**');
    let newText = '';
    
    for (let i = 0; i < parts.length; i++) {
        newText += parts[i];
        
        if (i < parts.length - 1) {
            // 偶数索引：后面是开始标记
            if (i % 2 === 0) {
                // 前面非空且非* -> 加空格
                // \S 匹配包括中文在内的非空白字符
                if (parts[i].length > 0 && /\S$/.test(parts[i]) && !/\*$/.test(parts[i])) {
                    newText += ' ';
                }
                newText += '**';
            } 
            // 奇数索引：后面是结束标记
            else {
                newText += '**';
                // 后面非空且非* -> 加空格
                if (i + 1 < parts.length && parts[i+1].length > 0 && /^\S/.test(parts[i+1]) && !/^\*/.test(parts[i+1])) {
                    newText += ' ';
                }
            }
        }
    }
    
    await navigator.clipboard.writeText(newText);
    showNotification('已修复并复制！');
    
  } catch (err) {
    console.error('操作失败:', err);
    showNotification('操作失败');
  }
});

// 复制为纯文本
document.getElementById('copyText').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    
    // 转换为纯文本逻辑
    const plainText = text
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

    await navigator.clipboard.writeText(plainText);
    showNotification('纯文本已复制！');
  } catch (err) {
    console.error('操作失败:', err);
    showNotification('操作失败');
  }
});

// 复制/保存为图片 (委托给 background -> index.html)
async function handleImageAction(type) {
  try {
    const text = await navigator.clipboard.readText();
    chrome.runtime.sendMessage({ 
      action: 'openIndexHtml', 
      markdown: text 
    });
    window.close(); // 关闭 popup
  } catch (err) {
    console.error('操作失败:', err);
    showNotification('无法读取剪贴板');
  }
}

document.getElementById('copyImage').addEventListener('click', () => handleImageAction('image'));
document.getElementById('saveImage').addEventListener('click', () => handleImageAction('save'));
