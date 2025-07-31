/**
 * 通用工具函数
 */

// 防抖函数
export function debounce(func, wait, immediate) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

// 节流函数
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 获取系统信息（兼容新旧API）
 * 替换弃用的wx.getSystemInfoSync
 */
export function getSystemInfo() {
  try {
    // 尝试使用新的API
    const windowInfo = wx.getWindowInfo?.() || {};
    const deviceInfo = wx.getDeviceInfo?.() || {};
    const appBaseInfo = wx.getAppBaseInfo?.() || {};
    const systemSetting = wx.getSystemSetting?.() || {};
    
    // 如果新API可用，合并结果
    if (windowInfo.windowWidth || deviceInfo.system || appBaseInfo.version) {
      return {
        ...windowInfo,
        ...deviceInfo, 
        ...appBaseInfo,
        ...systemSetting,
        // 保持向后兼容
        windowWidth: windowInfo.windowWidth,
        windowHeight: windowInfo.windowHeight,
        pixelRatio: windowInfo.pixelRatio || deviceInfo.pixelRatio,
        system: deviceInfo.system,
        platform: deviceInfo.platform,
        version: appBaseInfo.version,
        SDKVersion: appBaseInfo.SDKVersion
      };
    }
  } catch (error) {
    console.warn('新系统信息API不可用，回退到旧API:', error);
  }
  
  // 回退到旧API
  try {
    return wx.getSystemInfoSync();
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return {
      windowWidth: 375,
      windowHeight: 667,
      pixelRatio: 2,
      system: 'unknown',
      platform: 'unknown',
      version: 'unknown',
      SDKVersion: 'unknown'
    };
  }
}

/**
 * 异步获取系统信息
 */
export function getSystemInfoAsync() {
  return new Promise((resolve, reject) => {
    try {
      // 优先使用新API的异步版本
      if (wx.getSystemInfo) {
        wx.getSystemInfo({
          success: resolve,
          fail: () => {
            // 失败时使用同步版本
            try {
              resolve(getSystemInfo());
            } catch (error) {
              reject(error);
            }
          }
        });
      } else {
        resolve(getSystemInfo());
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成UUID
 * @returns {string} UUID字符串
 */
export function generateUUID() {
  // 使用crypto API（如果可用）或回退到时间戳+随机数
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // 回退方案：时间戳 + 随机字符串
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${randomStr}`;
}

/**
 * 生成短ID（用于练习会话等）
 * @returns {string} 短ID字符串
 */
export function generateShortId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomStr}`;
}

// 格式化时间
export function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// 生成唯一ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深拷贝
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// 简单的对象合并
export function merge(target, ...sources) {
  if (!target) target = {};
  sources.forEach(source => {
    if (source) {
      Object.keys(source).forEach(key => {
        target[key] = source[key];
      });
    }
  });
  return target;
} 
