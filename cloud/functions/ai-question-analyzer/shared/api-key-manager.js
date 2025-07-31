/**
 * API密钥轮换管理器
 * 支持多密钥配置、自动轮换、健康检查和故障恢复
 */

class APIKeyManager {
  constructor(options = {}) {
    // 从环境变量获取密钥列表
    this.keys = this.parseApiKeys();
    this.currentKeyIndex = 0;
    this.keyStatus = new Map(); // 记录每个密钥的状态
    this.rotationCount = 0;
    this.lastRotationTime = 0;
    
    // 配置选项
    this.options = {
      maxRetryPerKey: 2, // 每个密钥最大重试次数
      rotationCooldown: 60000, // 轮换冷却时间 (1分钟)
      healthCheckInterval: 300000, // 健康检查间隔 (5分钟)
      ...options
    };
    
    // 初始化密钥状态
    this.initializeKeyStatus();
    
    console.log('🔑 API密钥管理器初始化:', {
      totalKeys: this.keys.length,
      currentIndex: this.currentKeyIndex,
      rotationEnabled: this.keys.length > 1
    });
  }
  
  /**
   * 解析环境变量中的API密钥
   * 支持单密钥和多密钥配置
   */
  parseApiKeys() {
    const keys = [];
    
    // 主密钥
    if (process.env.DOUBAO_API_KEY) {
      keys.push({
        id: 'primary',
        key: process.env.DOUBAO_API_KEY,
        priority: 1
      });
    }
    
    // 备用密钥
    if (process.env.DOUBAO_API_KEY_SECONDARY) {
      keys.push({
        id: 'secondary',
        key: process.env.DOUBAO_API_KEY_SECONDARY,
        priority: 2
      });
    }
    
    // 第三密钥
    if (process.env.DOUBAO_API_KEY_TERTIARY) {
      keys.push({
        id: 'tertiary',
        key: process.env.DOUBAO_API_KEY_TERTIARY,
        priority: 3
      });
    }
    
    // 如果配置了多密钥字符串（逗号分隔）
    if (process.env.DOUBAO_API_KEYS) {
      const multiKeys = process.env.DOUBAO_API_KEYS.split(',');
      multiKeys.forEach((key, index) => {
        if (key.trim()) {
          keys.push({
            id: `multi_${index + 1}`,
            key: key.trim(),
            priority: index + 1
          });
        }
      });
    }
    
    // 按优先级排序
    return keys.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * 初始化所有密钥状态
   */
  initializeKeyStatus() {
    this.keys.forEach(keyInfo => {
      this.keyStatus.set(keyInfo.id, {
        isHealthy: true,
        lastUsed: 0,
        errorCount: 0,
        lastError: null,
        responseTime: 0,
        totalRequests: 0,
        successRequests: 0
      });
    });
  }
  
  /**
   * 获取当前活跃的API密钥
   * @returns {string|null} 当前API密钥
   */
  getCurrentKey() {
    if (this.keys.length === 0) {
      return null;
    }
    
    const currentKeyInfo = this.keys[this.currentKeyIndex];
    const status = this.keyStatus.get(currentKeyInfo.id);
    
    // 记录使用
    status.lastUsed = Date.now();
    status.totalRequests++;
    
    return currentKeyInfo.key;
  }
  
  /**
   * 获取当前密钥信息
   * @returns {Object} 密钥信息
   */
  getCurrentKeyInfo() {
    if (this.keys.length === 0) {
      return null;
    }
    
    const keyInfo = this.keys[this.currentKeyIndex];
    const status = this.keyStatus.get(keyInfo.id);
    
    return {
      id: keyInfo.id,
      priority: keyInfo.priority,
      status: status,
      index: this.currentKeyIndex
    };
  }
  
  /**
   * 轮换到下一个密钥
   * @param {string} reason - 轮换原因
   * @returns {boolean} 是否成功轮换
   */
  rotateKey(reason = 'manual') {
    if (this.keys.length <= 1) {
      console.warn('⚠️ 只有一个API密钥，无法轮换');
      return false;
    }
    
    const now = Date.now();
    
    // 检查冷却时间
    if (now - this.lastRotationTime < this.options.rotationCooldown) {
      console.warn('⚠️ 密钥轮换冷却中，请稍后再试');
      return false;
    }
    
    const oldKeyInfo = this.keys[this.currentKeyIndex];
    
    // 轮换到下一个密钥
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
    this.rotationCount++;
    this.lastRotationTime = now;
    
    const newKeyInfo = this.keys[this.currentKeyIndex];
    
    console.log('🔄 API密钥轮换:', {
      reason,
      from: `${oldKeyInfo.id} (index: ${this.currentKeyIndex === 0 ? this.keys.length - 1 : this.currentKeyIndex - 1})`,
      to: `${newKeyInfo.id} (index: ${this.currentKeyIndex})`,
      totalRotations: this.rotationCount
    });
    
    return true;
  }
  
  /**
   * 标记当前密钥出现错误
   * @param {Error} error - 错误对象
   * @param {number} responseTime - 响应时间
   */
  reportError(error, responseTime = 0) {
    if (this.keys.length === 0) return;
    
    const currentKeyInfo = this.keys[this.currentKeyIndex];
    const status = this.keyStatus.get(currentKeyInfo.id);
    
    status.errorCount++;
    status.lastError = {
      message: error.message,
      time: Date.now(),
      responseTime
    };
    status.responseTime = responseTime;
    
    console.error('❌ API密钥错误报告:', {
      keyId: currentKeyInfo.id,
      error: error.message,
      errorCount: status.errorCount,
      responseTime
    });
    
    // 如果错误次数超过阈值，标记为不健康并尝试轮换
    if (status.errorCount >= this.options.maxRetryPerKey) {
      status.isHealthy = false;
      console.warn(`⚠️ 密钥 ${currentKeyInfo.id} 标记为不健康`);
      
      // 尝试轮换到健康的密钥
      this.rotateToHealthyKey();
    }
  }
  
  /**
   * 标记当前密钥请求成功
   * @param {number} responseTime - 响应时间
   */
  reportSuccess(responseTime = 0) {
    if (this.keys.length === 0) return;
    
    const currentKeyInfo = this.keys[this.currentKeyIndex];
    const status = this.keyStatus.get(currentKeyInfo.id);
    
    status.successRequests++;
    status.responseTime = responseTime;
    status.errorCount = 0; // 重置错误计数
    
    // 如果之前标记为不健康，现在恢复
    if (!status.isHealthy) {
      status.isHealthy = true;
      console.log(`✅ 密钥 ${currentKeyInfo.id} 恢复健康状态`);
    }
  }
  
  /**
   * 轮换到健康的密钥
   * @returns {boolean} 是否找到健康的密钥
   */
  rotateToHealthyKey() {
    const originalIndex = this.currentKeyIndex;
    let attempts = 0;
    
    while (attempts < this.keys.length) {
      this.rotateKey(`health_check_${attempts + 1}`);
      
      const currentKeyInfo = this.keys[this.currentKeyIndex];
      const status = this.keyStatus.get(currentKeyInfo.id);
      
      if (status.isHealthy) {
        console.log(`✅ 找到健康密钥: ${currentKeyInfo.id}`);
        return true;
      }
      
      attempts++;
    }
    
    // 如果所有密钥都不健康，回到原始密钥
    this.currentKeyIndex = originalIndex;
    console.error('❌ 所有密钥都不健康，回退到原始密钥');
    return false;
  }
  
  /**
   * 获取所有密钥状态报告
   * @returns {Object} 状态报告
   */
  getStatusReport() {
    const report = {
      totalKeys: this.keys.length,
      currentKeyId: this.keys[this.currentKeyIndex]?.id || 'none',
      currentKeyIndex: this.currentKeyIndex,
      rotationCount: this.rotationCount,
      lastRotationTime: this.lastRotationTime,
      keys: []
    };
    
    this.keys.forEach((keyInfo, index) => {
      const status = this.keyStatus.get(keyInfo.id);
      report.keys.push({
        id: keyInfo.id,
        priority: keyInfo.priority,
        isCurrent: index === this.currentKeyIndex,
        isHealthy: status.isHealthy,
        errorCount: status.errorCount,
        successRate: status.totalRequests > 0 ? 
          (status.successRequests / status.totalRequests * 100).toFixed(1) + '%' : 'N/A',
        avgResponseTime: status.responseTime,
        lastUsed: status.lastUsed,
        lastError: status.lastError?.message || 'None'
      });
    });
    
    return report;
  }
  
  /**
   * 执行密钥健康检查
   * @param {Function} testFunction - 测试函数
   * @returns {Promise<Object>} 健康检查结果
   */
  async performHealthCheck(testFunction) {
    const results = {
      totalKeys: this.keys.length,
      healthyKeys: 0,
      unhealthyKeys: 0,
      details: []
    };
    
    console.log('🔍 开始API密钥健康检查...');
    
    for (let i = 0; i < this.keys.length; i++) {
      const keyInfo = this.keys[i];
      const startTime = Date.now();
      
      try {
        // 测试密钥
        const testResult = await testFunction(keyInfo.key);
        const responseTime = Date.now() - startTime;
        
        const status = this.keyStatus.get(keyInfo.id);
        status.isHealthy = testResult.success;
        status.responseTime = responseTime;
        
        if (testResult.success) {
          status.errorCount = 0;
          results.healthyKeys++;
        } else {
          status.errorCount++;
          results.unhealthyKeys++;
        }
        
        results.details.push({
          id: keyInfo.id,
          priority: keyInfo.priority,
          healthy: testResult.success,
          responseTime,
          message: testResult.message || 'OK'
        });
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const status = this.keyStatus.get(keyInfo.id);
        status.isHealthy = false;
        status.errorCount++;
        status.lastError = {
          message: error.message,
          time: Date.now(),
          responseTime
        };
        
        results.unhealthyKeys++;
        results.details.push({
          id: keyInfo.id,
          priority: keyInfo.priority,
          healthy: false,
          responseTime,
          error: error.message
        });
      }
    }
    
    console.log('🔍 健康检查完成:', {
      健康密钥: results.healthyKeys,
      异常密钥: results.unhealthyKeys,
      总密钥数: results.totalKeys
    });
    
    return results;
  }
}

module.exports = APIKeyManager; 