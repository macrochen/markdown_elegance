
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
        console.log('依赖库加载完成');
        
        // 验证库是否加载成功
        if (typeof window.marked === 'undefined') {
            throw new Error('marked 库加载失败');
        }
        if (typeof window.html2canvas === 'undefined') {
            throw new Error('html2canvas 库加载失败');
        }

        // 配置 marked 选项
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // 添加事件监听器，使用 removeEventListener 先移除可能存在的旧监听器
        const copyTextBtn = document.getElementById('copyTextBtn');
        const copyImageBtn = document.getElementById('copyImageBtn');
        const saveImageBtn = document.getElementById('saveImageBtn');
        
        copyTextBtn.removeEventListener('click', window.copyAsText);
        copyImageBtn.removeEventListener('click', window.copyAsImage);
        saveImageBtn.removeEventListener('click', window.saveAsImage);
        
        copyTextBtn.addEventListener('click', window.copyAsText);
        copyImageBtn.addEventListener('click', window.copyAsImage);
        saveImageBtn.addEventListener('click', window.saveAsImage);

        editor.removeEventListener('input', updatePreview);
        editor.addEventListener('input', updatePreview);
        
        const themeSelect = document.getElementById('themeSelect');
        themeSelect.removeEventListener('change', updateTheme);
        themeSelect.addEventListener('change', updateTheme);

        // 初始化主题
        updateTheme();

    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 更新预览函数
function updatePreview() {
    if (!marked || !editor || !preview) return;
    preview.innerHTML = marked.parse(editor.value);
    const plainText = editor.value
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
    document.getElementById('previewText').textContent = plainText;
}

// 将按钮事件处理函数定义为全局函数
window.copyAsText = async function() {
    if (!editor) return;
    try {
        // 移除 Markdown 格式
        const plainText = editor.value
            .replace(/#{1,6}\s/g, '') // 移除标题符号
            .replace(/\*\*/g, '') // 移除加粗符号
            .replace(/\*/g, '') // 移除斜体符号
            .replace(/`{1,3}/g, '') // 移除代码块符号
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 将链接转换为纯文本
            .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // 移除图片标记
            .replace(/^>\s/gm, '') // 移除引用符号
            .replace(/^[-+*]\s/gm, '') // 移除无序列表符号
            .replace(/^(\d+)\.\s/gm, '$1. ') // 保留有序列表数字
            .replace(/~~([^~]+)~~/g, '$1') // 移除删除线
            .replace(/\|/g, ' ') // 移除表格分隔符
            .replace(/^\s*[-=]{3,}\s*$/gm, ''); // 移除分隔线
    
        await navigator.clipboard.writeText(plainText);
        alert('纯文本已复制到剪贴板！');
    } catch (err) {
        console.error('复制文本失败:', err);
        alert('复制文本失败');
    }
}

window.copyAsImage = async function() {
    if (!html2canvas) return;
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

window.saveAsImage = async function() {
    if (!html2canvas) return;
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

// 等待 DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
