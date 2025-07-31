/**
 * 密钥管理测试云函数
 * 用于测试豆包AI密钥轮换和健康检查功能
 */

const cloud = require('wx-server-sdk');
const { 
  getDoubaoConfig, 
  getKeyManagerReport, 
  rotateAPIKey, 
  performKeyHealthCheck,
  reportAPIError,
  reportAPISuccess
} = require('./shared/doubao-config');

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV 
});

exports.main = async (event, context) => {
  const startTime = Date.now();
  
  console.log('密钥管理测试云函数开始执行:', {
    action: event.action,
    requestId: context.requestId
  });
  
  try {
    const { action = 'status' } = event;
    
    switch (action) {
      case 'status':
        return await getStatus();
        
      case 'health-check':
        return await performHealthCheck();
        
      case 'rotate':
        return await testRotation(event.reason);
        
      case 'simulate-error':
        return await simulateError();
        
      case 'simulate-success':
        return await simulateSuccess();
        
      case 'test-config':
        return await testConfig();
        
      default:
        throw new Error(`未知操作: ${action}`);
    }
    
  } catch (error) {
    console.error('密钥管理测试失败:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
};

/**
 * 获取密钥管理器状态
 */
async function getStatus() {
  const config = getDoubaoConfig({ enableKeyRotation: true });
  const report = getKeyManagerReport();
  
  return {
    success: true,
    action: 'status',
    config: {
      isValid: config.isValid,
      keyRotationEnabled: !!config.keyManager,
      currentKeyId: config.keyManager?.getCurrentKeyInfo()?.id || 'single',
      errors: config.errors
    },
    keyManagerReport: report,
    timestamp: new Date().toISOString()
  };
}

/**
 * 执行健康检查
 */
async function performHealthCheck() {
  console.log('开始密钥健康检查...');
  
  const healthResult = await performKeyHealthCheck();
  
  return {
    success: true,
    action: 'health-check',
    healthResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * 测试密钥轮换
 */
async function testRotation(reason = 'test') {
  console.log('测试密钥轮换...');
  
  const beforeReport = getKeyManagerReport();
  const rotationResult = rotateAPIKey(reason);
  const afterReport = getKeyManagerReport();
  
  return {
    success: true,
    action: 'rotate',
    rotationResult,
    before: beforeReport,
    after: afterReport,
    timestamp: new Date().toISOString()
  };
}

/**
 * 模拟API错误
 */
async function simulateError() {
  console.log('模拟API错误...');
  
  const beforeReport = getKeyManagerReport();
  
  // 模拟多次错误
  for (let i = 0; i < 3; i++) {
    const error = new Error(`模拟错误 ${i + 1}`);
    reportAPIError(error, 1000 + i * 100);
  }
  
  const afterReport = getKeyManagerReport();
  
  return {
    success: true,
    action: 'simulate-error',
    before: beforeReport,
    after: afterReport,
    message: '已模拟3次API错误',
    timestamp: new Date().toISOString()
  };
}

/**
 * 模拟API成功
 */
async function simulateSuccess() {
  console.log('模拟API成功...');
  
  const beforeReport = getKeyManagerReport();
  
  // 模拟多次成功
  for (let i = 0; i < 5; i++) {
    reportAPISuccess(800 + i * 50);
  }
  
  const afterReport = getKeyManagerReport();
  
  return {
    success: true,
    action: 'simulate-success',
    before: beforeReport,
    after: afterReport,
    message: '已模拟5次API成功',
    timestamp: new Date().toISOString()
  };
}

/**
 * 测试配置
 */
async function testConfig() {
  console.log('测试豆包AI配置...');
  
  // 测试不同配置选项
  const configs = {
    default: getDoubaoConfig(),
    noRotation: getDoubaoConfig({ enableKeyRotation: false }),
    strict: getDoubaoConfig({ strict: true, enableKeyRotation: true }),
    customDefaults: getDoubaoConfig({ 
      defaults: { TIMEOUT: 20000 },
      enableKeyRotation: true 
    })
  };
  
  return {
    success: true,
    action: 'test-config',
    configs: {
      default: {
        isValid: configs.default.isValid,
        hasKeyManager: !!configs.default.keyManager,
        timeout: configs.default.TIMEOUT
      },
      noRotation: {
        isValid: configs.noRotation.isValid,
        hasKeyManager: !!configs.noRotation.keyManager,
        timeout: configs.noRotation.TIMEOUT
      },
      strict: {
        isValid: configs.strict.isValid,
        hasKeyManager: !!configs.strict.keyManager,
        errors: configs.strict.errors
      },
      customDefaults: {
        isValid: configs.customDefaults.isValid,
        hasKeyManager: !!configs.customDefaults.keyManager,
        timeout: configs.customDefaults.TIMEOUT
      }
    },
    timestamp: new Date().toISOString()
  };
} 