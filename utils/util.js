// utils/util.js
// 通用工具函数集合

/**
 * 格式化日期
 * @param {Date|number|string} date 任意可被 Date 解析的对象
 * @param {string} fmt 格式模板，默认 yyyy-MM-dd HH:mm:ss
 * @returns {string}
 */
function formatTime(date, fmt = 'yyyy-MM-dd HH:mm:ss') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  if (isNaN(date.getTime())) return '';

  const map = {
    'yyyy': date.getFullYear(),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'dd': String(date.getDate()).padStart(2, '0'),
    'HH': String(date.getHours()).padStart(2, '0'),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'ss': String(date.getSeconds()).padStart(2, '0')
  };

  return Object.keys(map).reduce((str, key) => str.replace(key, map[key]), fmt);
}

/**
 * 将数字格式化为带千分位的字符串
 * @param {number} num 数值
 * @returns {string}
 */
function formatNumber(num) {
  if (typeof num !== 'number') num = Number(num) || 0;
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 防抖函数
 * @param {Function} func 要防抖的函数
 * @param {number} delay 延迟时间（毫秒）
 * @returns {Function}
 */
function debounce(func, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} func 要节流的函数
 * @param {number} delay 间隔时间（毫秒）
 * @returns {Function}
 */
function throttle(func, delay = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      func.apply(this, args);
      lastTime = now;
    }
  };
}

module.exports = {
  formatTime,
  formatNumber,
  debounce,
  throttle
}; 