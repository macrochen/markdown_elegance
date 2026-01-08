
// 等待所有依赖加载完成后再初始化应用
// 加载并执行脚本
// 声明全局变量
let editor, preview;

// 加载脚本函数修改
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        
        // 根据运行环境确定正确的路径
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 插件环境
            if (url.startsWith('http://') || url.startsWith('https://')) {
                // 外部 CDN URL，直接使用
                script.src = url;
            } else {
                // 本地文件，使用 chrome.runtime.getURL
                script.src = chrome.runtime.getURL(url);
            }
        } else {
            // 普通浏览器环境
            if (url.startsWith('http://') || url.startsWith('https://')) {
                script.src = url;
            } else {
                const scripts = document.getElementsByTagName('script');
                const currentScript = scripts[scripts.length - 1];
                const scriptPath = currentScript.src;
                const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/js/'));
                script.src = `${basePath}/${url}`;
            }
        }

        script.onload = () => {
            console.log('脚本加载成功:', script.src);
            setTimeout(resolve, 200);
        };
        script.onerror = (e) => {
            console.error('加载脚本失败:', script.src, e);
            reject(e);
        };
        document.head.appendChild(script);
    });
}

// 初始化应用
async function initApp() {
    try {
        // 先获取 DOM 元素
        editor = document.getElementById('editor');
        preview = document.getElementById('preview');

        // 检查是否在 Chrome 扩展环境中
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 监听来自 content script 的消息
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'setMarkdown' && request.markdown) {
                    editor.value = request.markdown;
                    updatePreview();
                }
            });
        }

        console.log('开始加载依赖库...');
        await loadScript('lib/marked.min.js');
        await loadScript('lib/html2canvas.min.js');
        await loadScript('lib/highlight/highlight.min.js');
        // 加载语言包
        await loadScript('lib/highlight/languages/go.min.js');
        await loadScript('lib/highlight/languages/python.min.js');
        await loadScript('lib/highlight/languages/javascript.min.js');
        await loadScript('lib/highlight/languages/typescript.min.js');
        await loadScript('lib/highlight/languages/bash.min.js');
        await loadScript('lib/highlight/languages/shell.min.js');
        await loadScript('lib/highlight/languages/xml.min.js');
        await loadScript('lib/highlight/languages/css.min.js');
        await loadScript('lib/highlight/languages/json.min.js');
        await loadScript('lib/highlight/languages/yaml.min.js');
        console.log('依赖库加载完成');
        
        // 验证库是否加载成功
        if (typeof window.marked === 'undefined') {
            throw new Error('marked 库加载失败');
        }
        if (typeof window.html2canvas === 'undefined') {
            throw new Error('html2canvas 库加载失败');
        }
        if (typeof window.hljs === 'undefined') {
            throw new Error('highlight.js 库加载失败');
        }

        // 初始化 highlight.js
        hljs.highlightAll();

        // 配置 marked 选项
        marked.setOptions({
            breaks: true,  // 保留换行符
            gfm: true,
            mangle: false,
            headerIds: false,
            headerPrefix: false,
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('代码高亮失败:', err);
                    }
                }
                return code;
            }
        });

        // return code; // 使用默认转义

        // 添加事件监听器，使用 removeEventListener 先移除可能存在的旧监听器
        const copyTextBtn = document.getElementById('copyTextBtn');
        const copyImageBtn = document.getElementById('copyImageBtn');
        const saveImageBtn = document.getElementById('saveImageBtn');
        const fixFormatBtn = document.getElementById('fixFormatBtn');
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        const manageDraftsBtn = document.getElementById('manageDraftsBtn');
        const closeModalBtn = document.querySelector('.close-modal');
        const draftsModal = document.getElementById('draftsModal');
        
        copyTextBtn.removeEventListener('click', window.copyAsText);
        copyImageBtn.removeEventListener('click', window.copyAsImage);
        saveImageBtn.removeEventListener('click', window.saveAsImage);
        if (fixFormatBtn) {
            fixFormatBtn.removeEventListener('click', window.fixAndCopyMarkdown);
            fixFormatBtn.addEventListener('click', window.fixAndCopyMarkdown);
        }
        
        copyTextBtn.addEventListener('click', window.copyAsText);
        copyImageBtn.addEventListener('click', window.copyAsImage);
        saveImageBtn.addEventListener('click', window.saveAsImage);

        // Drafts listeners
        if (saveDraftBtn) {
            saveDraftBtn.removeEventListener('click', window.saveDraft);
            saveDraftBtn.addEventListener('click', window.saveDraft);
        }
        if (manageDraftsBtn) {
            manageDraftsBtn.removeEventListener('click', window.manageDrafts);
            manageDraftsBtn.addEventListener('click', window.manageDrafts);
        }
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', window.closeDraftsModal);
        }
        if (draftsModal) {
            window.addEventListener('click', (event) => {
                if (event.target == draftsModal) {
                    window.closeDraftsModal();
                }
            });
        }

        editor.removeEventListener('input', updatePreview);
        editor.addEventListener('input', updatePreview);
        
        const themeSelect = document.getElementById('themeSelect');
        themeSelect.removeEventListener('change', updateTheme);
        themeSelect.addEventListener('change', updateTheme);

        // 初始化主题
        updateTheme();

        // 尝试自动读取剪贴板内容
        try {
            // 给一点延迟确保页面完全聚焦
            setTimeout(async () => {
                const text = await navigator.clipboard.readText();
                if (text && !editor.value) {
                    editor.value = text;
                    // 自动修复格式（可选，但既然为了方便，可以顺便修复一下）
                    // editor.value = formatMarkdown(text); 
                    updatePreview();
                    console.log('已自动从剪贴板加载内容');
                }
            }, 300);
        } catch (err) {
            console.log('自动读取剪贴板失败(可能需要用户交互):', err);
        }

        // 添加标签页切换功能
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 移除所有活动状态
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                
                // 设置当前标签页为活动状态
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                document.getElementById(`${tabId}-preview`).classList.add('active');
            });
        });

    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 格式化 Markdown 函数
function formatMarkdown(text) {
    const parts = text.split('**');
    let newText = '';
    
    for (let i = 0; i < parts.length; i++) {
        newText += parts[i];
        
        if (i < parts.length - 1) {
            // 偶数索引：后面是开始标记
            if (i % 2 === 0) {
                // 前面非空且非* -> 加空格
                // 显式添加对括号的检查，尽管 \S 已经包含
                if (parts[i].length > 0 && /\S$/.test(parts[i]) && !/\*$/.test(parts[i])) {
                    newText += ' ';
                }
                newText += '**';
            } 
            // 奇数索引：后面是结束标记
            else {
                newText += '**';
                // 后面非空且非* -> 加空格
                // 显式添加对括号的检查，尽管 \S 已经包含
                if (i + 1 < parts.length && parts[i+1].length > 0 && /^\S/.test(parts[i+1]) && !/^\*/.test(parts[i+1])) {
                    newText += ' ';
                }
            }
        }
    }
    return newText;
}

// 更新预览函数
function updatePreview() {
    if (!marked || !editor || !preview) return;
    
    // 处理 think 标签
    let content = editor.value.replace(
        /<think>([\s\S]*?)<\/think>/g, 
        (match, p1) => `<div class="thinking-section">${p1}</div>`
    );
    
    // 应用格式修复以确保正确渲染
    // const formattedContent = formatMarkdown(content);
    
    preview.innerHTML = marked.parse(content);
    
    // 应用代码高亮
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    // 处理纯文本预览
    const previewText = document.getElementById('previewText');
    const plainText = editor.value
        .replace(/<think>([\s\S]*?)<\/think>/g, (match, p1) => {
            return `<div class="thinking-text">${p1}</div>`;
        })
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
        .replace(/^\s*[-=]{3,}\s*$/gm, '')
        .split('\n').join('<br>'); // 保留换行
    previewText.innerHTML = plainText;
}

// 将按钮事件处理函数定义为全局函数
window.copyAsText = async function() {
    if (!editor) return;
    try {
        const includeThinking = document.getElementById('includeThinking').checked;
        const onlyThinking = document.getElementById('onlyThinking').checked;
        
        let text = editor.value;
        
        if (onlyThinking) {
            // 仅提取推理部分
            const matches = text.match(/<think>([\s\S]*?)<\/think>/g);
            if (matches) {
                text = matches.map(match => 
                    match.replace(/<think>([\s\S]*?)<\/think>/g, '$1').trim()
                ).join('\n\n');
            } else {
                text = '';
            }
        } else if (!includeThinking) {
            // 移除所有推理部分
            text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
        
        // 移除 Markdown 格式
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
        alert('纯文本已复制到剪贴板！');
    } catch (err) {
        console.error('复制文本失败:', err);
        alert('复制文本失败');
    }
}

// 添加复选框联动逻辑
document.getElementById('onlyThinking').addEventListener('change', function(e) {
    if (e.target.checked) {
        document.getElementById('includeThinking').checked = true;
        document.getElementById('includeThinking').disabled = true;
    } else {
        document.getElementById('includeThinking').disabled = false;
    }
});
window.copyAsImage = async function() {
    if (!html2canvas) return;
    try {
        const previewContainer = document.querySelector('.preview-container').cloneNode(true);
        const preview = previewContainer.querySelector('#preview');
        
        // 应用推理过程过滤
        const includeThinking = document.getElementById('includeThinking').checked;
        const onlyThinking = document.getElementById('onlyThinking').checked;
        
        if (onlyThinking) {
            // 仅保留推理部分
            const thinkingSections = preview.querySelectorAll('.thinking-section');
            preview.innerHTML = '';
            thinkingSections.forEach(section => preview.appendChild(section));
        } else if (!includeThinking) {
            // 移除所有推理部分
            preview.querySelectorAll('.thinking-section').forEach(el => el.remove());
        }
        
        previewContainer.style.position = 'fixed';
        previewContainer.style.left = '-9999px';
        previewContainer.style.top = '0';
        previewContainer.style.width = '1200px';
        previewContainer.style.height = 'auto';
        
        document.body.appendChild(previewContainer);
        
        // 等待一下确保样式已经应用
        await new Promise(resolve => setTimeout(resolve, 100));
    
        const canvas = await html2canvas(previewContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            windowWidth: 1200,
            height: previewContainer.scrollHeight, // 使用实际滚动高度
            width: 1200
        });
    
        document.body.removeChild(previewContainer);
    
        canvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                alert('图片已复制到剪贴板！');
            } catch (err) {
                console.error('复制到剪贴板失败:', err);
                alert('复制到剪贴板失败，请使用保存为图片功能');
            }
        });
    } catch (err) {
        console.error('生成图片失败:', err);
        alert('生成图片失败');
    }
}

window.saveAsImage = async function() {
    if (!html2canvas) return;
    try {
        const previewContainer = document.querySelector('.preview-container').cloneNode(true);
        const preview = previewContainer.querySelector('#preview');
        
        // 应用推理过程过滤
        const includeThinking = document.getElementById('includeThinking').checked;
        const onlyThinking = document.getElementById('onlyThinking').checked;
        
        if (onlyThinking) {
            // 仅保留推理部分
            const thinkingSections = preview.querySelectorAll('.thinking-section');
            preview.innerHTML = '';
            thinkingSections.forEach(section => preview.appendChild(section));
        } else if (!includeThinking) {
            // 移除所有推理部分
            preview.querySelectorAll('.thinking-section').forEach(el => el.remove());
        }
        
        previewContainer.style.position = 'fixed';
        previewContainer.style.left = '-9999px';
        previewContainer.style.top = '0';
        
        document.body.appendChild(previewContainer);
    
        const canvas = await html2canvas(previewContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });
    
        document.body.removeChild(previewContainer);
    
        // 创建下载链接
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = '吉光片语.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        console.error('保存图片失败:', err);
        alert('保存图片失败');
    }
}

// 主题相关代码
const themes = {
    sunset: {
        background: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
        textColor: '#2c3e50'
    },
    ocean: {
        background: 'linear-gradient(120deg, #209cff 0%, #68e0cf 100%)',
        textColor: '#2c3e50'
    },
    forest: {
        background: 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
        textColor: '#2c3e50'
    },
    lavender: {
        background: 'linear-gradient(120deg, #e6e9f0 0%, #eef1f5 100%)',
        textColor: '#2c3e50'
    },
    peach: {
        background: 'linear-gradient(120deg, #fff1eb 0%, #ace0f9 100%)',
        textColor: '#2c3e50'
    }
};

// 更新主题选择的处理
function updateTheme() {
    const selectedTheme = themes[document.getElementById('themeSelect').value];
    const previewContainer = document.querySelector('.preview-container');
    const preview = document.getElementById('preview');
    
    if (previewContainer && selectedTheme) {
        previewContainer.style.background = selectedTheme.background;
        preview.style.color = selectedTheme.textColor;
    }
}

// 确保在页面加载完成后初始化主题
document.addEventListener('DOMContentLoaded', updateTheme);

// 添加主题选择事件监听
document.getElementById('themeSelect').addEventListener('change', updateTheme);

// 初始化主题
updateTheme();

// 修改 copyAsImage 函数，使用已有的预览容器样式
async function copyAsImage() {
    try {
        const previewContainer = document.querySelector('.preview-container').cloneNode(true);
        previewContainer.style.position = 'fixed';
        previewContainer.style.left = '-9999px';
        previewContainer.style.top = '0';
        
        document.body.appendChild(previewContainer);
    
        const canvas = await html2canvas(previewContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });
    
        document.body.removeChild(previewContainer);
    
        canvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                alert('图片已复制到剪贴板！');
            } catch (err) {
                console.error('复制到剪贴板失败:', err);
                alert('复制到剪贴板失败，请使用保存为图片功能');
            }
        });
    } catch (err) {
        console.error('生成图片失败:', err);
        alert('生成图片失败');
    }
}

// 添加保存图片函数
async function saveAsImage() {
    try {
        const previewContainer = document.querySelector('.preview-container').cloneNode(true);
        previewContainer.style.position = 'fixed';
        previewContainer.style.left = '-9999px';
        previewContainer.style.top = '0';
        
        document.body.appendChild(previewContainer);
    
        const canvas = await html2canvas(previewContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });
    
        document.body.removeChild(previewContainer);
    
        // 创建下载链接
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = '吉光片语.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        console.error('保存图片失败:', err);
        alert('保存图片失败');
    }
}

// 添加修复格式并复制函数
window.fixAndCopyMarkdown = async function() {
    if (!editor) return;
    try {
        const text = editor.value;
        const newText = formatMarkdown(text);
        
        // 更新编辑器内容
        editor.value = newText;
        // 触发预览更新
        updatePreview();
        
        // 复制到剪贴板
        await navigator.clipboard.writeText(newText);
        alert('格式已修复并复制到剪贴板！');
        
    } catch (err) {
        console.error('修复格式失败:', err);
        alert('修复格式失败');
    }
}

// 草稿功能相关函数
window.saveDraft = function() {
    if (!editor) return;
    const text = editor.value.trim();
    if (!text) {
        alert('没有内容可以保存');
        return;
    }

    // 获取第一行作为默认文件名
    const firstLine = text.split('\n')[0].trim();
    let defaultName = firstLine.substring(0, 30); // 截取前30个字符
    if (defaultName.length === 0) defaultName = '未命名草稿';
    
    const name = prompt('请输入草稿名称:', defaultName);
    if (!name) return; // 用户取消

    const draftId = 'md_draft_' + Date.now();
    const draftData = {
        id: draftId,
        name: name,
        content: editor.value, // 保存原始内容，包括空格和换行
        date: new Date().toISOString()
    };

    try {
        localStorage.setItem(draftId, JSON.stringify(draftData));
        alert('草稿已保存！');
    } catch (e) {
        console.error('保存草稿失败:', e);
        alert('保存草稿失败，可能是存储空间不足。');
    }
};

window.manageDrafts = function() {
    const modal = document.getElementById('draftsModal');
    if (modal) {
        window.renderDraftsList();
        modal.style.display = 'block';
    }
};

window.closeDraftsModal = function() {
    const modal = document.getElementById('draftsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.renderDraftsList = function() {
    const listContainer = document.getElementById('draftsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const drafts = [];

    // 遍历 localStorage 查找草稿
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('md_draft_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                drafts.push(data);
            } catch (e) {
                console.warn('无法解析草稿数据:', key);
            }
        }
    }

    // 按时间倒序排序
    drafts.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (drafts.length === 0) {
        listContainer.innerHTML = '<div class="no-drafts">暂无保存的草稿</div>';
        return;
    }

    drafts.forEach(draft => {
        const item = document.createElement('div');
        item.className = 'draft-item';
        
        // 格式化日期
        const dateObj = new Date(draft.date);
        const dateStr = dateObj.toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        // 预览文字
        const previewText = draft.content.substring(0, 50).replace(/\n/g, ' ') + '...';

        item.innerHTML = `
            <div class="draft-info">
                <div class="draft-name">${draft.name} <span class="draft-date">${dateStr}</span></div>
                <div class="draft-preview">${previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            <div class="draft-actions">
                <button class="draft-btn load" onclick="window.loadDraft('${draft.id}')">加载</button>
                <button class="draft-btn delete" onclick="window.deleteDraft('${draft.id}')">删除</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
};

window.loadDraft = function(id) {
    try {
        const dataStr = localStorage.getItem(id);
        if (!dataStr) {
            alert('找不到该草稿');
            return;
        }
        const data = JSON.parse(dataStr);
        if (confirm('加载草稿将覆盖当前编辑器内容，确定要继续吗？')) {
            editor.value = data.content;
            updatePreview();
            window.closeDraftsModal();
        }
    } catch (e) {
        console.error('加载草稿失败:', e);
        alert('加载草稿失败');
    }
};

window.deleteDraft = function(id) {
    if (confirm('确定要删除这个草稿吗？此操作无法撤销。')) {
        localStorage.removeItem(id);
        window.renderDraftsList();
    }
};

// 等待 DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
