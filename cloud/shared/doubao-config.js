/**
 * 豆包AI统一配置管理
 * 提供配置验证、错误处理、降级机制和API密钥轮换
 */

const APIKeyManager = require('./api-key-manager');

// 全局密钥管理器实例
let keyManager = null;

/**
 * 获取豆包AI配置
 * @param {Object} options - 配置选项
 * @param {boolean} options.strict - 严格模式，配置错误时抛出异常
 * @param {Object} options.defaults - 默认配置覆盖
 * @returns {Object} 豆包AI配置对象
 */
function getDoubaoConfig(options = {}) {
  const { strict = false, defaults = {}, enableKeyRotation = true } = options;
  
  // 初始化密钥管理器
  if (enableKeyRotation && !keyManager) {
    keyManager = new APIKeyManager();
  }
  
  const config = {
    API_KEY: enableKeyRotation && keyManager ? keyManager.getCurrentKey() : process.env.DOUBAO_API_KEY,
    ENDPOINT: process.env.DOUBAO_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    MODEL_ID: process.env.DOUBAO_MODEL_ID || 'doubao-seed-1-6-250615',
    TIMEOUT: parseInt(process.env.DOUBAO_TIMEOUT) || 30000,
    MAX_RETRIES: parseInt(process.env.DOUBAO_MAX_RETRIES) || 2,
    ...defaults
  };
  
  // 配置验证
  const validation = validateConfig(config);
  
  if (!validation.valid) {
    const message = `豆包AI配置错误: ${validation.errors.join(', ')}`;
    console.error('❌', message);
    
    if (strict) {
      throw new Error(message);
    }
    
    // 非严格模式返回空配置，由调用方决定降级策略
    return {
      ...config,
      isValid: false,
      errors: validation.errors,
      keyManager: enableKeyRotation ? keyManager : null
    };
  }
  
  console.log('✅ 豆包AI配置验证通过:', {
    hasApiKey: !!config.API_KEY,
    endpoint: config.ENDPOINT,
    modelId: config.MODEL_ID,
    timeout: config.TIMEOUT,
    maxRetries: config.MAX_RETRIES,
    keyRotationEnabled: enableKeyRotation && !!keyManager,
    currentKeyId: keyManager?.getCurrentKeyInfo()?.id || 'single'
  });
  
  return {
    ...config,
    isValid: true,
    errors: [],
    keyManager: enableKeyRotation ? keyManager : null
  };
}

/**
 * 验证配置完整性
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果
 */
function validateConfig(config) {
  const errors = [];
  
  if (!config.API_KEY) {
    errors.push('API密钥未配置 (DOUBAO_API_KEY)');
  }
  
  if (!config.ENDPOINT) {
    errors.push('服务端点未配置 (DOUBAO_ENDPOINT)');
  }
  
  if (!config.MODEL_ID) {
    errors.push('模型ID未配置 (DOUBAO_MODEL_ID)');
  }
  
  if (config.TIMEOUT && (config.TIMEOUT < 5000 || config.TIMEOUT > 120000)) {
    errors.push('超时时间配置错误 (应在5秒-120秒之间)');
  }
  
  if (config.MAX_RETRIES && (config.MAX_RETRIES < 0 || config.MAX_RETRIES > 5)) {
    errors.push('重试次数配置错误 (应在0-5次之间)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 测试豆包AI连通性
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 测试结果
 */
async function testConnection(config) {
  const startTime = Date.now();
  
  try {
    const fetch = require('node-fetch');
    
    // 发送测试请求
    const response = await fetch(config.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      },
      body: JSON.stringify({
        model: config.MODEL_ID,
        messages: [
          {
            role: 'user',
            content: '测试连接'
          }
        ],
        max_tokens: 10
      }),
      timeout: Math.min(config.TIMEOUT, 10000) // 测试时使用较短超时
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        success: true,
        responseTime,
        message: '豆包AI连接正常'
      };
    } else {
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
        message: '豆包AI连接失败'
      };
    }
    
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message,
      message: '豆包AI连接测试异常'
    };
  }
}

/**
 * 获取配置摘要信息（安全的，不暴露敏感信息）
 * @param {Object} config - 配置对象
 * @returns {Object} 配置摘要
 */
function getConfigSummary(config) {
  return {
    hasApiKey: !!config.API_KEY,
    apiKeyLength: config.API_KEY ? config.API_KEY.length : 0,
    endpoint: config.ENDPOINT,
    modelId: config.MODEL_ID,
    timeout: config.TIMEOUT,
    maxRetries: config.MAX_RETRIES,
    isValid: config.isValid,
    errorCount: config.errors ? config.errors.length : 0
  };
}

/**
 * 报告API调用成功
 * @param {number} responseTime - 响应时间
 */
function reportAPISuccess(responseTime = 0) {
  if (keyManager) {
    keyManager.reportSuccess(responseTime);
  }
}

/**
 * 报告API调用错误
 * @param {Error} error - 错误对象
 * @param {number} responseTime - 响应时间
 */
function reportAPIError(error, responseTime = 0) {
  if (keyManager) {
    keyManager.reportError(error, responseTime);
  }
}

/**
 * 获取密钥管理器状态报告
 * @returns {Object|null} 状态报告
 */
function getKeyManagerReport() {
  return keyManager ? keyManager.getStatusReport() : null;
}

/**
 * 手动轮换API密钥
 * @param {string} reason - 轮换原因
 * @returns {boolean} 是否成功轮换
 */
function rotateAPIKey(reason = 'manual') {
  return keyManager ? keyManager.rotateKey(reason) : false;
}

/**
 * 执行密钥健康检查
 * @returns {Promise<Object|null>} 健康检查结果
 */
async function performKeyHealthCheck() {
  if (!keyManager) return null;
  
  // 使用豆包AI测试连接的函数
  const testFunction = async (apiKey) => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(process.env.DOUBAO_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.DOUBAO_MODEL_ID || 'doubao-seed-1-6-250615',
          messages: [{ role: 'user', content: '测试' }],
          max_tokens: 5
        }),
        timeout: 10000
      });
      
      return {
        success: response.ok,
        message: response.ok ? 'OK' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };
  
  return await keyManager.performHealthCheck(testFunction);
}

module.exports = {
  getDoubaoConfig,
  validateConfig,
  testConnection,
  getConfigSummary,
  reportAPISuccess,
  reportAPIError,
  getKeyManagerReport,
  rotateAPIKey,
  performKeyHealthCheck
}; 