/**
 * OCR识别云函数
 * 支持腾讯云OCR和百度OCR服务
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 云函数主入口
 * @param {Object} event - 请求参数
 * @param {string} event.imageBase64 - 图片base64编码
 * @param {string} event.imageFormat - 图片格式 (jpeg/png/bmp)
 * @param {Object} event.options - 识别选项
 * @returns {Promise<Object>} 识别结果
 */
exports.main = async (event, context) => {
  console.log('OCR识别云函数开始执行:', {
    imageFormat: event.imageFormat,
    imageSize: event.imageBase64 ? event.imageBase64.length : 0,
    options: event.options
  });

  try {
    // 参数验证
    if (!event.imageBase64) {
      throw new Error('图片数据不能为空');
    }

    if (!event.imageFormat) {
      throw new Error('图片格式不能为空');
    }

    // 选择OCR服务提供商
    const provider = process.env.OCR_PROVIDER || 'baidu'; // 默认使用百度OCR
    
    let result;
    if (provider === 'tencent') {
      result = await recognizeWithTencent(event);
    } else if (provider === 'baidu') {
      result = await recognizeWithBaidu(event);
    } else {
      throw new Error('不支持的OCR服务提供商');
    }

    console.log('OCR识别成功:', {
      textLength: result.text ? result.text.length : 0,
      confidence: result.confidence,
      regionsCount: result.regions ? result.regions.length : 0
    });

    return {
      success: true,
      ...result,
      processingTime: Date.now() - context.startTime || 0
    };

  } catch (error) {
    console.error('OCR识别失败:', error);
    
    return {
      success: false,
      error: {
        code: error.code || 'OCR_ERROR',
        message: error.message || '识别失败',
        details: error.details || null
      }
    };
  }
};

/**
 * 使用腾讯云OCR进行识别
 */
async function recognizeWithTencent(event) {
  const { imageBase64, imageFormat, options = {} } = event;
  
  // 腾讯云OCR配置
  const config = {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
    Region: process.env.TENCENT_REGION || 'ap-beijing',
    Endpoint: 'ocr.tencentcloudapi.com',
    Version: '2018-11-19'
  };

  if (!config.SecretId || !config.SecretKey) {
    throw new Error('腾讯云OCR配置不完整');
  }

  try {
    // 这里应该调用腾讯云OCR SDK
    // 由于小程序云函数环境限制，这里使用HTTP请求方式
    const result = await callTencentOCRAPI(config, {
      ImageBase64: imageBase64,
      ImageUrl: '', // 如果有图片URL可以使用
      SceneType: options.scene || 'general', // general, handwriting, math
      LanguageType: options.language || 'zh-cn'
    });

    return formatTencentResult(result);

  } catch (error) {
    console.error('腾讯云OCR调用失败:', error);
    throw new Error('腾讯云OCR服务异常: ' + error.message);
  }
}

/**
 * 使用百度OCR进行识别
 */
async function recognizeWithBaidu(event) {
  const { imageBase64, imageFormat, options = {} } = event;
  
  try {
    // 获取访问令牌
    const accessToken = await getBaiduAccessToken();
    
    // 调用百度OCR API
    const result = await callBaiduOCRAPI(accessToken, {
      image: imageBase64,
      language_type: options.language || 'CHN_ENG', // CHN_ENG, JAP, KOR
      detect_direction: true,
      detect_language: true,
      probability: true
    });

    return formatBaiduResult(result);

  } catch (error) {
    console.error('百度OCR调用失败:', error);
    throw new Error('百度OCR服务异常: ' + error.message);
  }
}

/**
 * 获取百度OCR访问令牌
 */
async function getBaiduAccessToken() {
  const API_KEY = process.env.BAIDU_API_KEY;
  const SECRET_KEY = process.env.BAIDU_SECRET_KEY;
  
  if (!API_KEY || !SECRET_KEY) {
    throw new Error('百度OCR配置不完整');
  }

  // 检查缓存的token
  const cachedToken = await getFromCache('baidu_access_token');
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  // 获取新token
  const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: API_KEY,
    client_secret: SECRET_KEY
  });

  const response = await fetch(`${tokenUrl}?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.ok) {
    throw new Error(`获取访问令牌失败: ${response.status}`);
  }

  const tokenData = await response.json();
  
  if (tokenData.error) {
    throw new Error(`获取访问令牌失败: ${tokenData.error_description}`);
  }

  // 缓存token（提前5分钟过期）
  const tokenInfo = {
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in - 300) * 1000
  };
  
  await setCache('baidu_access_token', tokenInfo);
  
  return tokenData.access_token;
}

/**
 * 调用百度OCR API
 */
async function callBaiduOCRAPI(accessToken, params) {
  const apiUrl = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
  
  const formData = new URLSearchParams();
  Object.keys(params).forEach(key => {
    formData.append(key, params[key]);
  });

  const response = await fetch(`${apiUrl}?access_token=${accessToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OCR API调用失败: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.error_code) {
    throw new Error(`OCR识别失败: ${result.error_msg}`);
  }

  return result;
}

/**
 * 调用腾讯云OCR API
 */
async function callTencentOCRAPI(config, params) {
  // 腾讯云API调用需要签名，这里简化处理
  // 实际部署时需要完整的腾讯云SDK集成
  
  // 模拟腾讯云OCR响应
  return {
    TextDetections: [
      {
        DetectedText: '模拟识别结果，请配置真实的腾讯云OCR',
        Confidence: 95,
        Polygon: [
          { X: 0, Y: 0 },
          { X: 100, Y: 0 },
          { X: 100, Y: 20 },
          { X: 0, Y: 20 }
        ]
      }
    ]
  };
}

/**
 * 格式化百度OCR结果
 */
function formatBaiduResult(result) {
  if (!result.words_result || result.words_result.length === 0) {
    return {
      text: '',
      confidence: 0,
      regions: []
    };
  }

  // 提取所有文字
  const textLines = result.words_result.map(item => item.words);
  const fullText = textLines.join('\n');
  
  // 计算平均置信度
  const confidences = result.words_result
    .filter(item => item.probability && item.probability.average)
    .map(item => item.probability.average);
  const avgConfidence = confidences.length > 0 ? 
    confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0.9;

  // 格式化区域信息
  const regions = result.words_result.map((item, index) => ({
    text: item.words,
    confidence: item.probability ? item.probability.average : 0.9,
    position: item.location ? {
      x: item.location.left,
      y: item.location.top,
      width: item.location.width,
      height: item.location.height
    } : { x: 0, y: index * 20, width: 100, height: 20 }
  }));

  return {
    text: fullText,
    confidence: avgConfidence,
    regions: regions
  };
}

/**
 * 格式化腾讯云OCR结果
 */
function formatTencentResult(result) {
  if (!result.TextDetections || result.TextDetections.length === 0) {
    return {
      text: '',
      confidence: 0,
      regions: []
    };
  }

  // 提取所有文字
  const textLines = result.TextDetections.map(item => item.DetectedText);
  const fullText = textLines.join('\n');
  
  // 计算平均置信度
  const confidences = result.TextDetections
    .filter(item => item.Confidence)
    .map(item => item.Confidence / 100); // 腾讯云置信度是百分比
  const avgConfidence = confidences.length > 0 ? 
    confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0.9;

  // 格式化区域信息
  const regions = result.TextDetections.map((item, index) => ({
    text: item.DetectedText,
    confidence: item.Confidence ? item.Confidence / 100 : 0.9,
    position: item.Polygon ? convertPolygonToRect(item.Polygon) : 
      { x: 0, y: index * 20, width: 100, height: 20 }
  }));

  return {
    text: fullText,
    confidence: avgConfidence,
    regions: regions
  };
}

/**
 * 将多边形坐标转换为矩形
 */
function convertPolygonToRect(polygon) {
  if (!polygon || polygon.length < 4) {
    return { x: 0, y: 0, width: 100, height: 20 };
  }

  const xs = polygon.map(p => p.X);
  const ys = polygon.map(p => p.Y);
  
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

/**
 * 简单的内存缓存实现
 */
const cache = new Map();

async function getFromCache(key) {
  return cache.get(key);
}

async function setCache(key, value) {
  cache.set(key, value);
  
  // 清理过期缓存
  setTimeout(() => {
    if (value.expires_at && value.expires_at < Date.now()) {
      cache.delete(key);
    }
  }, 300000); // 5分钟后检查
} 