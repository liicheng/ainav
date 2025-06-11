chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);
    if (request.action === 'exportData') {
        console.log('开始导出数据，收到的帖子数量:', request.data.posts.length);
        exportToExcel(request.data.posts, request.taskId, request.keyword);
    }
});

function exportToExcel(data, taskId, keyword) {
    console.log('开始生成 CSV 内容');
    let csvContent = "data:text/csv;charset=utf-8,\ufeff";
    csvContent += "标题,作者,点赞数,链接,封面图\n";

    data.forEach(post => {
        const row = [post.title, post.author, post.likes, post.link, post.coverImage]
            .map(field => `"${field.replace(/"/g, '""')}"`).join(',');
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const timestamp = new Date(parseInt(taskId)).toLocaleString().replace(/[/:]/g, '-');
    const fileName = `小红书-${timestamp}.csv`;
    chrome.downloads.download({
        url: encodedUri,
        filename: fileName,
        saveAs: true
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('下载时出错:', chrome.runtime.lastError);
        } else {
            console.log('文件下载已开始，下载 ID:', downloadId);
        }
    });
}