document.addEventListener('DOMContentLoaded', function() {
  // 建立与background的连接
  const port = chrome.runtime.connect({ name: "popup" });
  
  loadAlerts();
  
  // 币种映射表
  const CRYPTO_PAIRS = {
    bitcoin: { symbol: 'BTC', name: '比特币' },
    ethereum: { symbol: 'ETH', name: '以太坊' },
    binancecoin: { symbol: 'BNB', name: '币安币' },
    ripple: { symbol: 'XRP', name: '瑞波币' },
    cardano: { symbol: 'ADA', name: '卡尔达诺' },
    solana: { symbol: 'SOL', name: '索拉纳' },
    polkadot: { symbol: 'DOT', name: '波卡币' },
    dogecoin: { symbol: 'DOGE', name: '狗狗币' },
    'avalanche-2': { symbol: 'AVAX', name: '雪崩' },
    chainlink: { symbol: 'LINK', name: '链接' },
    uniswap: { symbol: 'UNI', name: '优尼币' },
    litecoin: { symbol: 'LTC', name: '莱特币' },
    'matic-network': { symbol: 'MATIC', name: 'Polygon' },
    tron: { symbol: 'TRX', name: '波场币' }
  };
  
  let priceUpdateTimer = null; // 保存定时器ID
  let lastPrice = null; // 保存上次的价格
  let currentCrypto = null; // 当前选中的加密货币
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ALERTS_UPDATED') {
      loadAlerts(); // 重新加载提醒列表
    }
  });
  
  // 获取当前选中加密货币的价格
  function getCurrentPrice(cryptoId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_PRICE', crypto: cryptoId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('获取价格时出错:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response?.price || null);
          }
        }
      );
    });
  }

  // 更新价格显示
  async function updatePriceDisplay(cryptoId) {
    // 清除之前的定时器
    if (priceUpdateTimer) {
      clearTimeout(priceUpdateTimer);
    }

    const priceDisplay = document.getElementById('currentPrice');

    try {
      // 只在第一次加载时显示加载状态
      if (lastPrice === null) {
        priceDisplay.innerHTML = '<div class="loading">正在获取价格...</div>';
      }

      const priceData = await getCurrentPrice(cryptoId);
      
      if (priceData !== null) {
        // 只有当价格真的变化时才更新显示
        if (!lastPrice || priceData.price !== lastPrice.price) {
          const priceValueElement = priceDisplay.querySelector('.price-value');
          if (priceValueElement) {
            // 如果元素已存在，只更新价格值和涨跌幅
            priceValueElement.innerHTML = `
              $${priceData.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
              <span class="${priceData.change24h >= 0 ? 'price-up' : 'price-down'}">
                (${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%)
              </span>`;
            
            // 添加价格变化的视觉反馈
            if (lastPrice !== null) {
              const changeClass = priceData.price > lastPrice.price ? 'price-up' : priceData.price < lastPrice.price ? 'price-down' : '';
              if (changeClass) {
                priceValueElement.classList.remove('price-up', 'price-down');
                priceValueElement.classList.add(changeClass);
                setTimeout(() => {
                  priceValueElement.classList.remove(changeClass);
                }, 1000);
              }
            }
          } else {
            // 如果元素不存在，创建完整的价格显示
            priceDisplay.innerHTML = `
              <div>${CRYPTO_PAIRS[cryptoId].name} (${CRYPTO_PAIRS[cryptoId].symbol}) 当前价格:</div>
              <div class="price-value">
                $${priceData.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                <span class="${priceData.change24h >= 0 ? 'price-up' : 'price-down'}">
                  (${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%)
                </span>
              </div>
            `;
          }
          lastPrice = priceData;
        }
      } else if (lastPrice === null) {
        // 只在没有历史价格时显示等待消息
        priceDisplay.innerHTML = '<div class="loading">等待价格数据...</div>';
      }
    } catch (error) {
      console.error('更新价格显示时出错:', error);
      if (lastPrice === null) {
        priceDisplay.innerHTML = '<div class="loading">获取价格失败，请重试</div>';
      }
    }

    // 设置新的定时器，每3秒更新一次价格
    priceUpdateTimer = setTimeout(() => {
      if (currentCrypto === cryptoId) { // 只有当选中的加密货币没有改变时才更新
        updatePriceDisplay(cryptoId);
      }
    }, 3000);
  }

  // 监加密货币选择变化
  document.getElementById('crypto').addEventListener('change', function() {
    const selectedCrypto = this.value;
    currentCrypto = selectedCrypto;
    lastPrice = null; // 重置上次价格
    updatePriceDisplay(selectedCrypto);
  });

  // 初始加载时获取默认选中的加密货币价格
  const initialCrypto = document.getElementById('crypto').value;
  currentCrypto = initialCrypto;
  updatePriceDisplay(initialCrypto);
  
  document.getElementById('addAlert').addEventListener('click', function() {
    const crypto = document.getElementById('crypto').value;
    const targetPrice = parseFloat(document.getElementById('targetPrice').value);
    const condition = document.getElementById('condition').value;
    
    if (!targetPrice || isNaN(targetPrice)) {
      alert('请输入有效的价格');
      return;
    }
    
    const alert = {
      id: Date.now(),
      crypto,
      targetPrice,
      condition,
      active: true
    };
    
    chrome.storage.local.get(['alerts'], function(result) {
      const alerts = result.alerts || [];
      alerts.push(alert);
      chrome.storage.local.set({ alerts }, function() {
        loadAlerts();
        // 通知background.js更新监控
        chrome.runtime.sendMessage({ type: 'UPDATE_ALERTS' });
      });
    });
    
    document.getElementById('targetPrice').value = '';
  });
});

function loadAlerts() {
  chrome.storage.local.get(['alerts'], function(result) {
    const alerts = result.alerts || [];
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = '';
    
    const CRYPTO_PAIRS = {
      bitcoin: { symbol: 'BTC', name: '比特币' },
      ethereum: { symbol: 'ETH', name: '以太坊' },
      binancecoin: { symbol: 'BNB', name: '币安币' },
      ripple: { symbol: 'XRP', name: '瑞波币' },
      cardano: { symbol: 'ADA', name: '卡尔达诺' },
      solana: { symbol: 'SOL', name: '索拉纳' },
      polkadot: { symbol: 'DOT', name: '波卡币' },
      dogecoin: { symbol: 'DOGE', name: '狗狗币' },
      'avalanche-2': { symbol: 'AVAX', name: '雪崩' },
      chainlink: { symbol: 'LINK', name: '链接' },
      uniswap: { symbol: 'UNI', name: '优尼币' },
      litecoin: { symbol: 'LTC', name: '莱特币' },
      'matic-network': { symbol: 'MATIC', name: 'Polygon' },
      tron: { symbol: 'TRX', name: '波场币' }
    };
    
    alerts.forEach(alert => {
      const alertElement = document.createElement('div');
      alertElement.className = 'alert-item';
      
      const cryptoInfo = CRYPTO_PAIRS[alert.crypto];
      
      alertElement.innerHTML = `
        <span>${cryptoInfo.name} (${cryptoInfo.symbol}) ${alert.condition === 'above' ? '高于' : '低于'} $${alert.targetPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}</span>
        <button class="delete-btn" data-id="${alert.id}">删除</button>
      `;
      
      const deleteBtn = alertElement.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', function() {
        const alertId = parseInt(this.getAttribute('data-id'));
        removeAlert(alertId);
      });
      
      alertsList.appendChild(alertElement);
    });
  });
}

function removeAlert(alertId) {
  chrome.storage.local.get(['alerts'], function(result) {
    const alerts = result.alerts || [];
    const newAlerts = alerts.filter(alert => alert.id !== alertId);
    chrome.storage.local.set({ alerts: newAlerts }, function() {
      loadAlerts();
      // 通知background.js更新监控
      chrome.runtime.sendMessage({ type: 'UPDATE_ALERTS' });
    });
  });
} 