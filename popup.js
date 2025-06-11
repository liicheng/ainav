document.getElementById('scrapeButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "scrapeProduct" });
});

// 监听后台脚本发来的数据更新消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateUI") {
    displayResults(request.data);
  }
});

// 显示爬取结果
function displayResults(data) {
  const productInfo = data.productInfo;
  const resultsDiv = document.getElementById('results');
  
  resultsDiv.innerHTML = `
    <h3>${productInfo.basic.title}</h3>
    <p>ASIN: ${productInfo.basic.asin}</p>
    <p>品牌: ${productInfo.basic.brand}</p>
    <p>价格: $${productInfo.pricing.currentPrice.amount}</p>
    <p>评分: ${productInfo.ratings.averageRating}/5.0 (${productInfo.ratings.totalReviews}条评论)</p>
    <p>库存状态: ${productInfo.inventory.inStock ? '有货' : '无货'}</p>
    <p>配送方式: ${productInfo.inventory.fulfillment}</p>
    <details>
      <summary>商品描述</summary>
      <p>${productInfo.details.description}</p>
    </details>
    <details>
      <summary>规格参数</summary>
      <pre>${JSON.stringify(productInfo.details.specifications, null, 2)}</pre>
    </details>
    <p><small>采集时间: ${new Date(productInfo.metadata.scrapeDate).toLocaleString()}</small></p>
    ${displayReviews(productInfo.reviews.reviews)}
  `;
}

// 页面加载时显示上次爬取的数据
chrome.storage.local.get('lastScrapedProduct', (result) => {
  if (result.lastScrapedProduct) {
    displayResults(result.lastScrapedProduct);
});

function displayReviews(reviews) {
  const reviewsHtml = reviews.map(review => `
    <div class="review-item" style="border-bottom: 1px solid #eee; padding: 10px 0;">
      <div class="review-header">
        <span class="author">${review.author}</span>
        <span class="rating">评分: ${review.rating}星</span>
        <span class="date">${review.date}</span>
        ${review.verified ? '<span class="verified" style="color: green;">✓ 已验证购买</span>' : ''}
      </div>
      <h4>${review.title}</h4>
      <p>${review.content}</p>
      ${review.images.length ? `
        <div class="review-images">
          ${review.images.map(img => `<img src="${img.thumbnail}" style="max-width: 100px; margin: 5px;">`).join('')}
        </div>
      ` : ''}
      <div class="helpful">
        ${review.helpful.votes}人觉得有帮助 (共${review.helpful.total}人投票)
      </div>
    </div>
  `).join('');

  return `
    <div class="reviews-section">
      <h3>商品评论</h3>
      <div class="reviews-container">
        ${reviewsHtml}
      </div>
    </div>
  `;
}

// 添加采集控制按钮
document.getElementById('results').insertAdjacentHTML('beforebegin', `
  <div class="controls" style="margin-bottom: 10px;">
    <button id="scrapeReviews">采集全部评论</button>
    <span id="status" style="margin-left: 10px; color: #666;"></span>
  </div>
`);

// 绑定评论采集事件
document.getElementById('scrapeReviews').addEventListener('click', () => {
  const maxPages = 10; // 设置最大采集页数
  chrome.runtime.sendMessage({ 
    action: "scrapeAllReviews",
    maxPages: maxPages
  });
  
  // 禁用按钮防止重复点击
  document.getElementById('scrapeReviews').disabled = true;
});

// 扩展消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateStatus") {
    // 更新状态显示
    document.getElementById('status').textContent = request.status;
  }
  else if (request.action === "reviewsComplete") {
    // 显示完整的评论数据
    displayAllReviews(request.data);
    // 重新启用按钮
    document.getElementById('scrapeReviews').disabled = false;
    document.getElementById('status').textContent = request.status;
  }
  else if (request.action === "error") {
    document.getElementById('status').textContent = request.error;
    document.getElementById('status').style.color = 'red';
    document.getElementById('scrapeReviews').disabled = false;
  }
});

// 显示所有评论的函数
function displayAllReviews(reviews) {
  const reviewsContainer = document.createElement('div');
  reviewsContainer.className = 'all-reviews';
  reviewsContainer.innerHTML = `
    <h3>评论汇总 (共${reviews.length}条)</h3>
    <div class="reviews-stats">
      <p>评分分布：</p>
      ${generateRatingStats(reviews)}
    </div>
    ${displayReviews(reviews)}
  `;
  
  // 替换或添加到页面
  const existingReviews = document.querySelector('.reviews-section');
  if (existingReviews) {
    existingReviews.replaceWith(reviewsContainer);
  } else {
    document.getElementById('results').appendChild(reviewsContainer);
  }
}

// 生成评分统计
function generateRatingStats(reviews) {
  const stats = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(stats)
    .sort(([a], [b]) => b - a)
    .map(([rating, count]) => `
      <div class="rating-bar">
        <span>${rating}星</span>
        <div class="bar" style="width: ${count / reviews.length * 100}%"></div>
        <span>${count}条</span>
      </div>
    `).join('');
} 