console.log('小红书帖子采集器脚本已加载 - 版本 1.2');

let posts = [];
let isCollecting = false;
let isPaused = false;
let currentTaskId = null;
let searchKeyword = '';

function createFloatingButtons() {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'xhs-collector-buttons';
    buttonContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 2147483647;
    `;
    document.body.appendChild(buttonContainer);

    const createButton = (id, text, color, onClick) => {
        const button = document.createElement('div');
        button.id = id;
        button.innerHTML = text;
        button.style.cssText = `
            padding: 10px;
            background-color: ${color};
            color: white;
            border-radius: 5px;
            cursor: pointer;
            text-align: center;
        `;
        button.addEventListener('click', onClick);
        buttonContainer.appendChild(button);
        return button;
    };

    const progressDisplay = document.createElement('div');
    progressDisplay.id = 'xhs-progress-display';
    progressDisplay.style.cssText = `
        padding: 10px;
        background-color: #333;
        color: white;
        border-radius: 5px;
        text-align: center;
        margin-bottom: 10px;
    `;
    progressDisplay.innerHTML = '已采集: 0';
    buttonContainer.insertBefore(progressDisplay, buttonContainer.firstChild);

    const startButton = createButton('xhs-start-button', '开始采集', '#4CAF50', startCollection);
    const pauseButton = createButton('xhs-pause-button', '暂停任务', '#FFA500', togglePause);
    const stopButton = createButton('xhs-stop-button', '结束任务', '#FF0000', stopCollection);
    const exportButton = createButton('xhs-export-button', '导出上次任务', '#4285f4', exportData);
    const historyButton = createButton('xhs-history-button', '历史数据', '#9C27B0', showHistoryData);

    pauseButton.style.display = 'none';
    stopButton.style.display = 'none';

    return { startButton, pauseButton, stopButton, exportButton, historyButton, progressDisplay };
}

const buttons = createFloatingButtons();

function updateButtonStates() {
    buttons.startButton.style.display = isCollecting ? 'none' : 'block';
    buttons.pauseButton.style.display = isCollecting ? 'block' : 'none';
    buttons.stopButton.style.display = isCollecting ? 'block' : 'none';
    buttons.pauseButton.innerHTML = isPaused ? '继续任务' : '暂停任务';
    buttons.stopButton.innerHTML = `结束任务 (${posts.length})`;
    buttons.progressDisplay.innerHTML = `已采集: ${posts.length}`;
    buttons.progressDisplay.style.display = isCollecting ? 'block' : 'none';
}

function startCollection() {
    isCollecting = true;
    isPaused = false;
    posts = []; // 重置 posts 数组，确保每次任务都从空开始
    currentTaskId = Date.now();
    searchKeyword = getSearchKeyword();
    console.log('当前搜索关键词:', searchKeyword);
    updateButtonStates();
    updateFloatingButton();
    collectPosts();
    startPeriodicCheck();
}

function togglePause() {
    isPaused = !isPaused;
    updateButtonStates();
    updateFloatingButton();
    if (!isPaused) {
        collectPosts();
        startPeriodicCheck();
    } else {
        stopPeriodicCheck();
    }
}

function stopCollection() {
    isCollecting = false;
    isPaused = false;
    stopPeriodicCheck();
    updateButtonStates();
    updateFloatingButton();
    saveCurrentTask();
}

function saveCurrentTask() {
    if (posts.length > 0) {
        const taskData = {
            posts: posts,
            keyword: searchKeyword,
            timestamp: currentTaskId
        };
        chrome.storage.local.set({ [currentTaskId]: taskData }, function() {
            console.log('任务数据已保存，任务ID:', currentTaskId, '关键词:', searchKeyword);
        });
    }
}

function exportData(taskId = null) {
    if (taskId) {
        chrome.storage.local.get(taskId.toString(), function(result) {
            if (result[taskId]) {
                console.log(`开始导出任务 ${taskId} 的数据`);
                chrome.runtime.sendMessage({
                    action: 'exportData', 
                    data: result[taskId], 
                    taskId: taskId,
                    keyword: result[taskId].keyword || '未知关键词'
                }, response => {
                    if (chrome.runtime.lastError) {
                        console.error('发送消息时出错:', chrome.runtime.lastError);
                    } else {
                        console.log('数据导出消息已发送');
                    }
                });
            } else {
                console.log(`未找到任务 ${taskId} 的数据`);
            }
        });
    } else {
        // 导出最后一次任务数据的逻辑
        chrome.storage.local.get(null, function(result) {
            const lastTaskId = Math.max(...Object.keys(result).map(Number));
            if (lastTaskId) {
                const lastTaskData = result[lastTaskId];
                console.log('开始导出上次任务数据，任务ID:', lastTaskId);
                chrome.runtime.sendMessage({
                    action: 'exportData', 
                    data: lastTaskData, 
                    taskId: lastTaskId,
                    keyword: lastTaskData.keyword || '未知关键词'
                }, response => {
                    if (chrome.runtime.lastError) {
                        console.error('发送消息时出错:', chrome.runtime.lastError);
                    } else {
                        console.log('数据导出消息已发送');
                    }
                });
            } else {
                console.log('没有找到可导出的任务数据');
            }
        });
    }
}

function collectPosts() {
    if (!isCollecting || isPaused) return;

    try {
        console.log('开始采集帖子');
        let newPosts = document.querySelectorAll('.note-item, [data-v-note-item], .search-result-item, .explore-feed-card');
        console.log('找到的帖子数量:', newPosts.length);

        newPosts.forEach(post => {
            try {
                const likesElement = post.querySelector('.like-wrapper .count, .likes, .interaction-info span, .count');
                let likes = likesElement ? likesElement.textContent.trim() : '0';
                
                console.log('原始点赞数:', likes);
                likes = parseLikes(likes);
                console.log('解析后的点赞数:', likes);

                const postData = {
                    title: post.querySelector('.title, .content, .desc, .name')?.textContent.trim() || '',
                    author: post.querySelector('.user-nickname, .author, .user-info-name')?.textContent.trim() || '',
                    likes: likes,
                    link: post.querySelector('a')?.href || '',
                    coverImage: post.querySelector('img')?.src || ''
                };

                console.log('采集到的帖子数据:', postData);

                // 修改重复检查逻辑，只在当前任务的 posts 数组中查找
                if (!posts.some(p => p.link === postData.link)) {
                    posts.push(postData);
                    updateFloatingButton();
                }
            } catch (postError) {
                console.error('处理单个帖子时出错:', postError);
            }
        });

        console.log('采集完成，当前总帖子数:', posts.length);
        updateFloatingButton();

        // 如果没有新的帖子被添加，尝试滚动页面
        if (newPosts.length === 0) {
            simulateHumanScroll();
        }

        // 按点赞数排序，确保高点赞数的帖子被保留
        posts.sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
        // 只保留前1000条帖子，避免数据过多
        posts = posts.slice(0, 1000);
    } catch (error) {
        console.error('采集帖子时出错:', error);
    }
}

function parseLikes(likes) {
    if (typeof likes === 'string') {
        likes = likes.toLowerCase().trim();
        if (likes.includes('w')) {
            return Math.round(parseFloat(likes.replace('w', '')) * 10000).toString();
        } else if (likes.includes('k')) {
            return Math.round(parseFloat(likes.replace('k', '')) * 1000).toString();
        } else if (likes.includes('万')) {
            return Math.round(parseFloat(likes.replace('万', '')) * 10000).toString();
        } else if (likes.includes('+')) {
            return likes.replace('+', '');
        }
    }
    return likes.replace(/[^\d]/g, ''); // 移除所有非数字字符
}

function updateFloatingButton() {
    if (isCollecting) {
        buttons.startButton.style.display = 'none';
        buttons.pauseButton.style.display = 'block';
        buttons.stopButton.style.display = 'block';
        buttons.pauseButton.innerHTML = isPaused ? '继续任务' : '暂停任务';
        buttons.stopButton.innerHTML = `结束任务 (${posts.length})`;
        buttons.progressDisplay.innerHTML = `已采集: ${posts.length}`;
        buttons.progressDisplay.style.display = 'block';
    } else {
        buttons.startButton.style.display = 'block';
        buttons.pauseButton.style.display = 'none';
        buttons.stopButton.style.display = 'none';
        buttons.startButton.innerHTML = '开始采集';
        buttons.progressDisplay.style.display = 'none';
    }
}

function startPeriodicCheck() {
    stopPeriodicCheck();
    window.collectionInterval = setInterval(() => {
        if (!isPaused) {
            simulateHumanScroll();
            setTimeout(collectPosts, 2000 + Math.random() * 3000);
        }
    }, 8000 + Math.random() * 7000);
}

function stopPeriodicCheck() {
    clearInterval(window.collectionInterval);
}

function simulateHumanScroll() {
    const scrollAmount = Math.floor(Math.random() * 500) + 300; // 增加滚动距离
    window.scrollBy(0, scrollAmount);
    console.log('页面已滚动', scrollAmount, '像素');
}

function init() {
    try {
        console.log('初始化开始');
        observeDOM();
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化过程中出错:', error);
    }
}

function observeDOM() {
    const targetNode = document.querySelector('.search-result-container') || document.body;
    const config = { childList: true, subtree: true };
    const callback = debounce(function(mutationsList, observer) {
        if (isCollecting && !isPaused) {
            console.log('DOM 发生变化，尝试采集');
            collectPosts();
        }
    }, 1000);

    try {
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
        console.log('DOM 观察器已启动');
    } catch (error) {
        console.error('启动 DOM 观察器时错:', error);
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function getSearchKeyword() {
    // 尝试从 URL 获取关键词
    const urlParams = new URLSearchParams(window.location.search);
    let keyword = urlParams.get('keyword');

    // 如果 URL 中没有关键词，尝试从页面元素中获取
    if (!keyword) {
        // 尝试获取搜索框中的值
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="搜索"]');
        if (searchInput) {
            keyword = searchInput.value;
        }

        // 如果还是没有找到，尝试从页面标题或其他元素中获取
        if (!keyword) {
            const titleElement = document.querySelector('h1, .search-title');
            if (titleElement) {
                keyword = titleElement.textContent.trim();
            }
        }
    }

    // 如果所有方法都失败，返回默认值
    return keyword || '未知关键词';
}

function showHistoryData() {
    chrome.storage.local.get(null, function(result) {
        const taskIds = Object.keys(result).sort((a, b) => b - a); // 按时间降序排列
        if (taskIds.length === 0) {
            alert('没有历史数据');
            return;
        }

        const historyContainer = document.createElement('div');
        historyContainer.id = 'xhs-history-container';
        historyContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 2147483648;
            max-height: 80vh;
            overflow-y: auto;
            width: 600px;
            font-family: Arial, sans-serif;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            background-color: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        `;
        closeButton.onclick = () => historyContainer.remove();
        historyContainer.appendChild(closeButton);

        const title = document.createElement('h2');
        title.textContent = '历史采集任务';
        title.style.cssText = `
            text-align: center;
            margin-bottom: 20px;
            color: #333;
        `;
        historyContainer.appendChild(title);

        const taskList = document.createElement('div');
        taskList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        let currentDate = '';
        taskIds.forEach(taskId => {
            const taskData = result[taskId];
            const taskDate = new Date(parseInt(taskId));
            const dateString = taskDate.toLocaleDateString();

            if (dateString !== currentDate) {
                currentDate = dateString;
                const dateHeader = document.createElement('div');
                dateHeader.textContent = currentDate;
                dateHeader.style.cssText = `
                    font-weight: bold;
                    margin-top: 15px;
                    margin-bottom: 5px;
                    color: #666;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                `;
                taskList.appendChild(dateHeader);
            }

            const taskItem = document.createElement('div');
            taskItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background-color: #f9f9f9;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.2s;
            `;
            taskItem.onmouseover = () => taskItem.style.backgroundColor = '#f0f0f0';
            taskItem.onmouseout = () => taskItem.style.backgroundColor = '#f9f9f9';

            const fileName = `小红书-${taskDate.toLocaleString().replace(/[/:]/g, '-')}`;
            const fileInfo = document.createElement('div');
            fileInfo.innerHTML = `
                <div style="font-weight: bold; color: #333;">${fileName}</div>
                <div style="color: #666; font-size: 0.9em;">${taskData.keyword} (${taskData.posts.length} 条数据)</div>
            `;
            taskItem.appendChild(fileInfo);

            const downloadButton = document.createElement('button');
            downloadButton.textContent = '下载';
            downloadButton.style.cssText = `
                padding: 5px 10px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
            `;
            downloadButton.onclick = (e) => {
                e.stopPropagation();
                exportData(taskId);
            };
            taskItem.appendChild(downloadButton);

            taskList.appendChild(taskItem);
        });

        historyContainer.appendChild(taskList);
        document.body.appendChild(historyContainer);
    });
}

if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}

window.manualExport = exportData;