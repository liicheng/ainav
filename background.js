// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapeProduct") {
    scrapeProductInfo();
  } else if (request.action === "scrapeAllReviews") {
    scrapeAllReviews(request.maxPages || 5);
  }
});

// 爬取商品信息的主函数
async function scrapeProductInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // 获取ASIN
        const getASIN = () => {
          const asinElement = document.querySelector('[data-asin]');
          return asinElement ? asinElement.getAttribute('data-asin') : '';
        };

        // 获取价格详情
        const getPricing = () => {
          const currentPrice = document.querySelector('.a-price-whole')?.textContent;
          const listPrice = document.querySelector('.a-text-strike')?.textContent;
          return {
            currentPrice: {
              amount: parseFloat(currentPrice?.replace(/[^0-9.]/g, '') || '0'),
              currency: 'USD'
            },
            listPrice: listPrice ? {
              amount: parseFloat(listPrice.replace(/[^0-9.]/g, '')),
              currency: 'USD'
            } : null
          };
        };

        // 获取评分分布
        const getRatingDistribution = () => {
          const distribution = {};
          document.querySelectorAll('table#histogramTable tr').forEach(row => {
            const stars = row.querySelector('.a-text-right')?.textContent.trim();
            const percentage = row.querySelector('.a-text-right ~ td')?.textContent.trim();
            if (stars && percentage) {
              distribution[stars.split(' ')[0]] = parseInt(percentage);
            }
          });
          return distribution;
        };

        // 新增评论采集函数
        const getReviews = () => {
          const reviews = [];
          const reviewElements = document.querySelectorAll('#cm-cr-dp-review-list div[data-hook="review"]');
          
          reviewElements.forEach(review => {
            const reviewData = {
              id: review.getAttribute('id'),
              author: review.querySelector('.a-profile-name')?.textContent.trim(),
              rating: parseInt(review.querySelector('i[data-hook="review-star-rating"]')?.textContent.split('.')[0] || '0'),
              title: review.querySelector('[data-hook="review-title"]')?.textContent.trim(),
              date: review.querySelector('[data-hook="review-date"]')?.textContent.trim(),
              verified: review.querySelector('[data-hook="avp-badge"]') !== null,
              content: review.querySelector('[data-hook="review-body"]')?.textContent.trim(),
              helpful: {
                votes: parseInt(review.querySelector('[data-hook="helpful-vote-statement"]')?.textContent.split(' ')[0] || '0'),
                total: parseInt(review.querySelector('[data-hook="total-vote-statement"]')?.textContent.split(' ')[0] || '0')
              },
              images: Array.from(review.querySelectorAll('img[data-hook="review-image"]')).map(img => ({
                thumbnail: img.src,
                full: img.getAttribute('data-a-dynamic-image') ? Object.keys(JSON.parse(img.getAttribute('data-a-dynamic-image')))[0] : null
              }))
            };
            reviews.push(reviewData);
          });

          return {
            reviews,
            pagination: {
              currentPage: parseInt(document.querySelector('.a-pagination .a-selected')?.textContent || '1'),
              totalPages: parseInt(document.querySelector('.a-pagination li:last-child')?.textContent || '1')
            }
          };
        };

        // 构建完整的商品数据对象
        const productData = {
          productInfo: {
            basic: {
              asin: getASIN(),
              title: document.querySelector('#productTitle')?.textContent.trim(),
              brand: document.querySelector('#bylineInfo')?.textContent.trim(),
              seller: document.querySelector('#sellerProfileTriggerId')?.textContent.trim(),
              category: Array.from(document.querySelectorAll('#wayfinding-breadcrumbs_container li')).map(li => li.textContent.trim())
            },
            pricing: getPricing(),
            ratings: {
              averageRating: parseFloat(document.querySelector('#acrPopover')?.title?.split(' ')[0] || '0'),
              totalReviews: parseInt(document.querySelector('#acrCustomerReviewText')?.textContent.split(' ')[0].replace(/,/g, '') || '0'),
              ratingDistribution: getRatingDistribution()
            },
            details: {
              description: document.querySelector('#feature-bullets')?.textContent.trim(),
              features: Array.from(document.querySelectorAll('#feature-bullets li')).map(li => li.textContent.trim()),
              specifications: (() => {
                const specs = {};
                document.querySelectorAll('#productDetails_techSpec_section_1 tr').forEach(row => {
                  const key = row.querySelector('th')?.textContent.trim();
                  const value = row.querySelector('td')?.textContent.trim();
                  if (key && value) specs[key] = value;
                });
                return specs;
              })()
            },
            images: {
              main: document.querySelector('#landingImage')?.src,
              gallery: Array.from(document.querySelectorAll('#altImages img')).map(img => img.src)
            },
            inventory: {
              inStock: document.querySelector('#availability')?.textContent.includes('In Stock'),
              fulfillment: document.querySelector('#merchant-info')?.textContent.includes('Amazon') ? 'FBA' : 'FBM'
            },
            metadata: {
              scrapeDate: new Date().toISOString(),
              marketplace: window.location.hostname,
              url: window.location.href
            },
            reviews: getReviews(),
            reviewAnalysis: {
              sentimentAnalysis: {
                positive: document.querySelectorAll('.cr-lighthouse-term:not(.cr-lighthouse-term-negative)').length,
                negative: document.querySelectorAll('.cr-lighthouse-term-negative').length
              },
              topMentionedTopics: Array.from(document.querySelectorAll('.cr-lighthouse-terms')).map(term => ({
                topic: term.querySelector('.cr-lighthouse-term')?.textContent.trim(),
                count: parseInt(term.querySelector('.cr-lighthouse-term-count')?.textContent || '0')
              }))
            }
          }
        };
        
        return productData;
      }
    });

    // 保存数据到存储
    const scrapedData = result[0].result;
    chrome.storage.local.set({ 'lastScrapedProduct': scrapedData });
    
    // 通知popup数据已更新
    chrome.runtime.sendMessage({
      action: "updateUI",
      data: scrapedData
    });

  } catch (error) {
    console.error('爬取失败:', error);
  }
}

// 添加随机延迟函数
function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// 修改评论翻页功能
async function scrapeNextReviewPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    
    // 点击下一页按钮
    const hasNextPage = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // 检查是否在评论页面
        const isReviewPage = window.location.href.includes('/product-reviews/');
        if (!isReviewPage) {
          // 如果不在评论页面，先跳转到评论页面
          const reviewsLink = document.querySelector('a[data-hook="see-all-reviews-link-foot"]');
          if (reviewsLink) {
            reviewsLink.click();
            return 'redirect';
          }
          return false;
        }

        const nextButton = document.querySelector('.a-pagination .a-last a');
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      }
    });

    const result = hasNextPage[0].result;
    
    if (result === 'redirect') {
      // 如果是重定向到评论页面，等待页面加载
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(3000, 6000)));
      return true;
    }

    if (!result) return false;

    // 等待页面加载，使用随机延迟
    await new Promise(resolve => setTimeout(resolve, getRandomDelay(2500, 4000)));

    return true;
  } catch (error) {
    console.error('翻页失败:', error);
    return false;
  }
}

// 修改批量采集评论的功能
async function scrapeAllReviews(maxPages = 5) {
  try {
    const allReviews = [];
    let currentPage = 1;
    let consecutiveErrors = 0;
    const MAX_ERRORS = 3;

    // 发送开始采集的消息
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: `开始采集评论 (0/${maxPages}页)`
    });

    while (currentPage <= maxPages && consecutiveErrors < MAX_ERRORS) {
      // 添加随机延迟
      await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

      try {
        const pageData = await scrapeProductInfo();
        if (!pageData?.productInfo?.reviews?.reviews.length) {
          consecutiveErrors++;
          continue;
        }

        allReviews.push(...pageData.productInfo.reviews.reviews);
        
        // 更新采集状态
        chrome.runtime.sendMessage({
          action: "updateStatus",
          status: `已采集 ${currentPage}/${maxPages}页 (共${allReviews.length}条评论)`
        });

        const hasNextPage = await scrapeNextReviewPage();
        if (!hasNextPage) break;
        
        currentPage++;
        consecutiveErrors = 0;

      } catch (error) {
        console.error(`第${currentPage}页采集失败:`, error);
        consecutiveErrors++;
        
        // 出错后增加延迟
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(5000, 8000)));
      }
    }

    // 保存完整的评论数据
    chrome.storage.local.set({
      'allReviews': allReviews,
      'lastUpdated': new Date().toISOString()
    });

    // 发送采集完成的消息
    chrome.runtime.sendMessage({
      action: "reviewsComplete",
      data: allReviews,
      status: `采集完成，共获取${allReviews.length}条评论`
    });

    return allReviews;

  } catch (error) {
    console.error('批量采集失败:', error);
    chrome.runtime.sendMessage({
      action: "error",
      error: '采集过程中出现错误'
    });
    return [];
  }
}