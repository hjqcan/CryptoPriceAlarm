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

// 当前价格缓存
let currentPrices = {};

// 已触发的提醒记录
let triggeredAlerts = new Set();

// 定时器ID
let priceUpdateTimer = null;

// 更新间隔（毫秒）
const UPDATE_INTERVAL = {
  ACTIVE: 8000,  // popup打开时：8秒
  INACTIVE: 30000 // popup关闭时：30秒
};

// 当前是否有活动连接
let hasActiveConnection = false;

// 获取价格
async function fetchPrices() {
  try {
    const symbols = Object.values(CRYPTO_PAIRS).map(p => p.symbol).join(',');
    const response = await fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbols}&tsyms=USD`);
    const data = await response.json();
    
    // 更新价格缓存
    Object.entries(CRYPTO_PAIRS).forEach(([id, info]) => {
      if (data.RAW && data.RAW[info.symbol] && data.RAW[info.symbol].USD) {
        const priceData = data.RAW[info.symbol].USD;
        currentPrices[id] = {
          price: priceData.PRICE,
          change24h: priceData.CHANGEPCT24HOUR
        };
      }
    });
    
    console.log('Prices updated:', currentPrices);
    checkAlerts();
    return true;
  } catch (error) {
    console.error('获取价格失败:', error);
    return false;
  }
}

// 开始定时获取价格
function startPriceUpdates(interval) {
  // 清除现有定时器
  if (priceUpdateTimer) {
    clearInterval(priceUpdateTimer);
  }
  
  // 立即获取一次价格
  fetchPrices();
  
  // 设置新的定时器
  priceUpdateTimer = setInterval(fetchPrices, interval);
}

// 监听popup连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    console.log("Popup opened - switching to active update interval");
    hasActiveConnection = true;
    startPriceUpdates(UPDATE_INTERVAL.ACTIVE);
    
    // 监听连接断开
    port.onDisconnect.addListener(() => {
      console.log("Popup closed - switching to inactive update interval");
      hasActiveConnection = false;
      startPriceUpdates(UPDATE_INTERVAL.INACTIVE);
    });
  }
});

// 初始化时启动价格更新（使用较慢的更新频率）
chrome.runtime.onInstalled.addListener(() => {
  startPriceUpdates(UPDATE_INTERVAL.INACTIVE);
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_ALERTS') {
    // 清除已触发的提醒记录，这样更新后的提醒可以重新触发
    triggeredAlerts.clear();
    checkAlerts();
  } else if (message.type === 'GET_PRICE') {
    const price = currentPrices[message.crypto];
    console.log(`Requested price for ${message.crypto}: ${price}`);
    sendResponse({ price });
  }
  return true;
});

// 监听通知点击事件
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('price-alert-')) {
    const alertId = parseInt(notificationId.replace('price-alert-', ''));
    
    // 获取当前提醒列表
    const { alerts } = await chrome.storage.local.get(['alerts']);
    if (!alerts) return;

    // 移除被忽略的提醒
    const newAlerts = alerts.filter(alert => alert.id !== alertId);
    
    // 更新存储
    await chrome.storage.local.set({ alerts: newAlerts });
    
    // 关闭通知
    chrome.notifications.clear(notificationId);
    
    // 通知popup更新显示
    chrome.runtime.sendMessage({ type: 'ALERTS_UPDATED' });
  }
});

// 检查提醒
async function checkAlerts() {
  try {
    const { alerts } = await chrome.storage.local.get(['alerts']);
    if (!alerts || alerts.length === 0) return;

    alerts.forEach(alert => {
      const currentPrice = currentPrices[alert.crypto];
      
      if (currentPrice === undefined) return;

      // 创建唯一的提醒标识符
      const alertKey = `${alert.id}-${alert.condition}-${alert.targetPrice}`;

      let shouldNotify = false;
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldNotify = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldNotify = true;
      }

      // 只有当条件满足且该提醒之前没有触发过时才发送通知
      if (shouldNotify && !triggeredAlerts.has(alertKey)) {
        // 发送通知
        chrome.notifications.create(`price-alert-${alert.id}`, {
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: '价格提醒',
          message: `${CRYPTO_PAIRS[alert.crypto].name} (${CRYPTO_PAIRS[alert.crypto].symbol}) 当前价格: $${currentPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}\n${alert.condition === 'above' ? '已超过' : '已低于'}目标价格: $${alert.targetPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`,
          requireInteraction: true,
          buttons: [{
            title: '忽略'
          }],
          priority: 2
        });

        // 记录该提醒已经触发
        triggeredAlerts.add(alertKey);
      }
    });
  } catch (error) {
    console.error('检查提醒时出错:', error);
  }
}

// 当扩展从休眠状态恢复时，重新启动价格更新
chrome.runtime.onStartup.addListener(() => {
  // 清除已触发的提醒记录
  triggeredAlerts.clear();
  // 重新开始价格更新（使用较慢的更新频率）
  startPriceUpdates(UPDATE_INTERVAL.INACTIVE);
}); 