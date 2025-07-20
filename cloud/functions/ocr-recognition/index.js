const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 优化豆包AI配置，提高响应速度
const DOUBAO_CONFIG = {
  API_KEY: '908e2e4e-8625-4a88-b2dc-81b2acf0f5a7',
  ENDPOINT: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  MODEL_ID: 'doubao-seed-1-6-250615',
  TIMEOUT: 25000, // 减少到25秒
  MAX_RETRIES: 0   // 真机环境不重试
};

exports.main = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const startTime = Date.now();
  
  console.log('豆包AI图片分析云函数开始执行:', {
    hasImage: !!event.imageBase64,
    hasFileID: !!event.fileID,
    requestId: event.options?.requestId,
    imageSize: event.imageBase64 ? event.imageBase64.length : 0,
    analysisType: event.analysisType || 'complete',
    isTest: !!event.test
  });
  
  // 测试调用 - 确保返回正确格式
  if (event.test) {
    const testResult = {
      success: true,
      recognizedText: '云函数连接正常，豆包AI图片分析服务已就绪',
      text: '云函数连接正常，豆包AI图片分析服务已就绪',
      confidence: 0.95,
      questionType: 'test',
      subject: 'test',
      provider: '豆包AI',
      processingTime: Date.now() - startTime,
      testMode: true
    };
    console.log('测试模式返回结果:', testResult);
    return testResult;
  }

  try {
    // 主要逻辑...
    const result = await processImageAnalysis(event);
    
    // 确保返回正确格式
    const finalResult = {
      success: true,
      text: result.recognizedText || result.text || '',
      recognizedText: result.recognizedText || result.text || '',
      confidence: result.confidence || 0.8,
      questionType: result.questionType || 'unknown',
      subject: result.subject || 'unknown',
      difficulty: result.difficulty || 1,
      provider: '豆包AI',
      processingTime: Date.now() - startTime
    };
    
    console.log('云函数执行成功，返回结果:', finalResult);
    return finalResult;
    
  } catch (error) {
    console.error('云函数执行失败:', error);
    
    // 返回错误结果而不是undefined
    return {
      success: false,
      error: error.message,
      text: '',
      recognizedText: '',
      confidence: 0,
      questionType: 'error',
      subject: 'unknown',
      processingTime: Date.now() - startTime
    };
  }
};

function buildRequestData(config, imageUrl, analysisType) {
  return {
    model: config.MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请快速识别图片中的文字内容，直接返回识别结果，无需详细分析。"
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0,
    stream: false
  };
}

async function processImageAnalysis(event) {
  const { imageBase64, imageInfo, fileID, useCloudStorage, analysisType = 'complete', options = {} } = event;
  
  // 参数验证
  if (!imageBase64 && !fileID) {
    throw new Error('缺少图片数据或文件ID');
  }

  let finalImageBase64;
  let finalImageInfo = imageInfo;

  if (useCloudStorage && fileID) {
    console.log('从云存储下载图片:', fileID);
    const downloadResult = await downloadAndConvertImage(fileID);
    finalImageBase64 = downloadResult.base64;
    finalImageInfo = downloadResult.info;
  } else {
    finalImageBase64 = imageBase64;
  }

  // 调用豆包AI
  if (!DOUBAO_CONFIG.API_KEY) {
    console.warn('豆包AI API密钥未配置，使用模拟模式');
    return await mockCompleteAnalysis(finalImageBase64, options);
  }
  
  return await callDoubaoImageAnalysis(finalImageBase64, finalImageInfo, analysisType, options);
}

/**
 * 从云存储下载图片并转换为base64
 */
async function downloadAndConvertImage(fileID) {
  const cloud = require('wx-server-sdk');
  try {
    const res = await cloud.downloadFile({ fileID });
    if (!res.fileContent || res.fileContent.length === 0) {
      throw new Error('下载文件为空');
    }
    return {
      base64: res.fileContent.toString('base64'),
      info: { size: res.fileContent.length, fileID }
    };
  } catch (err) {
    console.error('云存储下载失败', err);
    throw err; // 让外层捕获降级
  }
}

/**
 * 调用豆包AI进行图片分析
 */
async function callDoubaoImageAnalysis(imageBase64, imageInfo, analysisType, options) {
  const startTime = Date.now();
  
  try {
    console.log('开始调用豆包AI进行图片分析');
    
    // 构建请求数据
    const requestData = {
      model: DOUBAO_CONFIG.MODEL_ID,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请识别图片中的文字内容，包括题目、选项、公式等所有文字。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    };

    // 发送请求
    const response = await fetchWithTimeout(DOUBAO_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    }, DOUBAO_CONFIG.TIMEOUT);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆包AI API调用失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('豆包AI未返回有效结果');
    }

    const content = result.choices[0].message.content;
    if (!content) {
      throw new Error('豆包AI返回内容为空');
    }

    return {
      recognizedText: content.trim(),
      confidence: 0.9,
      questionType: 'unknown',
      subject: 'unknown',
      difficulty: 3,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('豆包AI调用失败:', error);
    throw error;
  }
}

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(url, options, timeout) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('请求超时')), timeout);
  });

  const fetchPromise = require('node-fetch')(url, options);
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * 模拟分析结果（当API密钥未配置时使用）
 */
async function mockCompleteAnalysis(imageBase64, options) {
  console.log('使用模拟图片分析模式');
  
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    recognizedText: '模拟识别的文字内容',
    confidence: 0.8,
    questionType: 'unknown',
    subject: 'unknown',
    difficulty: 3
  };
}








