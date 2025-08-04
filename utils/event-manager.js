/**
 * 简单的事件管理器
 * 用于页面间的数据同步，避免粗暴的页面重新加载
 */
class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * 注册事件监听器
   * @param {string} eventType 事件类型
   * @param {Function} callback 回调函数
   * @param {Object} context 上下文对象（通常是页面实例）
   */
  on(eventType, callback, context = null) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType).push({
      callback,
      context
    });
    
    console.log(`事件监听器已注册: ${eventType}`);
  }

  /**
   * 移除事件监听器
   * @param {string} eventType 事件类型
   * @param {Object} context 上下文对象
   */
  off(eventType, context = null) {
    if (!this.listeners.has(eventType)) return;
    
    const listeners = this.listeners.get(eventType);
    const filtered = listeners.filter(listener => listener.context !== context);
    
    if (filtered.length === 0) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.set(eventType, filtered);
    }
    
    console.log(`事件监听器已移除: ${eventType}`);
  }

  /**
   * 触发事件
   * @param {string} eventType 事件类型
   * @param {Object} data 事件数据
   */
  emit(eventType, data = {}) {
    if (!this.listeners.has(eventType)) {
      console.log(`没有找到事件监听器: ${eventType}`);
      return;
    }
    
    const listeners = this.listeners.get(eventType);
    console.log(`触发事件: ${eventType}, 监听器数量: ${listeners.length}`);
    
    // 异步执行回调，避免阻塞
    setTimeout(() => {
      listeners.forEach(({ callback, context }) => {
        try {
          if (context && typeof callback === 'string') {
            // 如果callback是字符串，则调用context上的方法
            if (typeof context[callback] === 'function') {
              context[callback](data);
            }
          } else if (typeof callback === 'function') {
            callback.call(context, data);
          }
        } catch (error) {
          console.error(`事件回调执行失败: ${eventType}`, error);
        }
      });
    }, 0);
  }

  /**
   * 清空所有监听器
   */
  clear() {
    this.listeners.clear();
    console.log('所有事件监听器已清空');
  }

  /**
   * 获取当前注册的事件类型
   */
  getEventTypes() {
    return Array.from(this.listeners.keys());
  }
}

// 创建全局单例
const eventManager = new EventManager();

// 定义常用事件类型
export const EVENT_TYPES = {
  // 错题相关事件
  MISTAKE_ADDED: 'mistake:added',
  MISTAKE_UPDATED: 'mistake:updated',
  MISTAKE_DELETED: 'mistake:deleted',
  MISTAKE_REVIEWED: 'mistake:reviewed',
  
  // 练习相关事件
  PRACTICE_COMPLETED: 'practice:completed',
  PRACTICE_STARTED: 'practice:started',
  
  // 课程相关事件
  SCHEDULE_ADDED: 'schedule:added',
  SCHEDULE_UPDATED: 'schedule:updated',
  SCHEDULE_DELETED: 'schedule:deleted',
  
  // 用户相关事件
  USER_INFO_UPDATED: 'user:info_updated',
  USER_STATS_UPDATED: 'user:stats_updated'
};

export default eventManager; 