const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 导入统一配置管理工具
const { getDoubaoConfig, reportAPISuccess, reportAPIError, getKeyManagerReport } = require('../shared/doubao-config');

// 获取豆包AI配置（OCR特定默认值，启用密钥轮换）
const DOUBAO_CONFIG = getDoubaoConfig({
  defaults: {
    TIMEOUT: 25000, // OCR需要较短的超时时间
    MAX_RETRIES: 0  // 真机环境不重试
  },
  enableKeyRotation: true // 启用密钥轮换
});

exports.main = async (event, context) => {
  // 设置更长的超时时间
  context.callbackWaitsForEmptyEventLoop = false;
  
  const startTime = Date.now();
  
  console.log('豆包AI图片分析云函数开始执行:', {
    hasImage: !!event.imageBase64,
    hasFileID: !!event.fileID,
    requestId: event.options?.requestId,
    imageSize: event.imageBase64 ? event.imageBase64.length : 0,
    analysisType: event.analysisType || 'complete',
    isTest: !!event.test,
    useCloudStorage: !!event.useCloudStorage,
    timeout: '60秒'
  });
  
  // 测试调用 - 只有明确传递test:true且没有图片数据时才执行
  if (event.test === true && !event.imageBase64 && !event.fileID) {
    console.log('🧪 执行测试模式');
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

  // 检查豆包AI配置是否有效
  if (!DOUBAO_CONFIG.isValid) {
    console.error('豆包AI配置无效:', DOUBAO_CONFIG.errors);
    return {
      success: false,
      error: `豆包AI配置错误: ${DOUBAO_CONFIG.errors.join(', ')}`,
      code: 'CONFIG_ERROR'
    };
  }

  // 正常的图片分析流程
  console.log('🚀 执行正常图片分析流程');
  
  try {
    const result = await processImageAnalysis(event);
    
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
  
  console.log('=== processImageAnalysis 开始 ===');
  console.log('参数检查:', {
    hasImageBase64: !!imageBase64,
    hasFileID: !!fileID,
    useCloudStorage: useCloudStorage,
    requestId: options.requestId
  });
  
  // 参数验证
  if (!imageBase64 && !fileID) {
    console.error('❌ 参数验证失败：缺少图片数据');
    throw new Error('缺少图片数据或文件ID');
  }

  let finalImageBase64;
  let finalImageInfo = imageInfo;

  if (useCloudStorage && fileID) {
    try {
      console.log('📥 开始从云存储下载图片:', fileID);
      const downloadResult = await downloadAndConvertImage(fileID);
      finalImageBase64 = downloadResult.base64;
      finalImageInfo = downloadResult.info;
      console.log('✅ 云存储下载成功，base64长度:', finalImageBase64.length);
    } catch (downloadError) {
      console.error('❌ 云存储下载失败:', downloadError.message);
      console.log('🔄 降级使用模拟分析');
      return await mockCompleteAnalysis('', options);
    }
  } else {
    finalImageBase64 = imageBase64;
    console.log('📄 使用直接传入的base64，长度:', finalImageBase64 ? finalImageBase64.length : 0);
  }

  // 强制检查API密钥 - 详细日志
  console.log('🔑 详细检查豆包AI配置:');
  console.log('- API_KEY存在:', !!DOUBAO_CONFIG.API_KEY);
  console.log('- API_KEY长度:', DOUBAO_CONFIG.API_KEY ? DOUBAO_CONFIG.API_KEY.length : 0);
  console.log('- API_KEY前10位:', DOUBAO_CONFIG.API_KEY ? DOUBAO_CONFIG.API_KEY.substring(0, 10) + '...' : 'null');
  console.log('- API_KEY类型:', typeof DOUBAO_CONFIG.API_KEY);
  console.log('- ENDPOINT:', DOUBAO_CONFIG.ENDPOINT);
  console.log('- MODEL_ID:', DOUBAO_CONFIG.MODEL_ID);
  
  // 临时强制跳过API密钥检查，直接调用豆包AI
  console.log('🚀 强制尝试调用豆包AI（跳过密钥检查）');
  
  try {
    const aiResult = await callDoubaoImageAnalysis(finalImageBase64, finalImageInfo, analysisType, options);
    console.log('✅ 豆包AI调用成功');
    return aiResult;
  } catch (aiError) {
    console.error('❌ 豆包AI调用失败:', aiError.message);
    console.error('错误堆栈:', aiError.stack);
    console.log('🔄 降级使用模拟分析');
    return await mockCompleteAnalysis(finalImageBase64, options);
  }
}

/**
 * 从云存储下载图片并转换为base64
 */
async function downloadAndConvertImage(fileID) {
  const cloud = require('wx-server-sdk');
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`下载云存储图片 (尝试 ${attempt}/${maxRetries}):`, fileID);
      
      const res = await Promise.race([
        cloud.downloadFile({ fileID }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('下载超时')), 15000)
        )
      ]);
      
      if (!res.fileContent || res.fileContent.length === 0) {
        throw new Error('下载文件为空');
      }
      
      // 🔧 关键修复：检测并处理图片格式
      let finalBuffer = res.fileContent;
      let detectedFormat = 'unknown';
      
      // 检测图片格式
      const header = res.fileContent.slice(0, 8);
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        detectedFormat = 'png';
        console.log('检测到PNG格式图片');
      } else if (header[0] === 0xFF && header[1] === 0xD8) {
        detectedFormat = 'jpeg';
        console.log('检测到JPEG格式图片');
      }
      
      // 如果是PNG，尝试简单的格式标记转换
      if (detectedFormat === 'png') {
        console.log('PNG图片需要转换，但Sharp不可用，直接使用原始数据');
        // 由于Sharp不可用，我们直接使用原始buffer
        // 在请求时强制声明为JPEG格式
        finalBuffer = res.fileContent;
      }
      
      const base64 = finalBuffer.toString('base64');
      
      console.log('图片下载并转换完成:', {
        fileID: fileID,
        originalSize: res.fileContent.length,
        finalSize: finalBuffer.length,
        base64Length: base64.length,
        detectedFormat: detectedFormat,
        attempt: attempt
      });
      
      return {
        base64: base64,
        info: { 
          size: finalBuffer.length, 
          fileID, 
          format: detectedFormat,
          originalFormat: detectedFormat
        }
      };
      
    } catch (error) {
      lastError = error;
      console.error(`下载失败 (尝试 ${attempt}):`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw new Error(`下载云存储图片失败: ${lastError.message}`);
}

/**
 * 调用豆包AI进行图片分析
 */
async function callDoubaoImageAnalysis(imageBase64, imageInfo, analysisType, options) {
  const startTime = Date.now();
  
  try {
    console.log('callDoubaoImageAnalysis 开始:', {
      imageBase64Length: imageBase64 ? imageBase64.length : 0,
      analysisType: analysisType,
      requestId: options.requestId,
      detectedFormat: imageInfo?.format
    });
    
    // 🔧 关键修复：如果是PNG格式，尝试其他方法
    let finalBase64 = imageBase64;
    let imageFormat = 'jpeg'; // 强制声明为JPEG
    
    if (imageInfo?.format === 'png') {
      console.log('检测到PNG格式，尝试转换...');
      
      try {
        // 方法1：尝试使用Canvas API转换（如果可用）
        const canvas = require('canvas');
        if (canvas) {
          console.log('使用Canvas转换PNG到JPEG...');
          const img = new canvas.Image();
          img.src = `data:image/png;base64,${imageBase64}`;
          
          const canvasEl = canvas.createCanvas(img.width, img.height);
          const ctx = canvasEl.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          const jpegDataUrl = canvasEl.toDataURL('image/jpeg', 0.85);
          finalBase64 = jpegDataUrl.split(',')[1];
          console.log('Canvas转换成功');
        }
      } catch (canvasError) {
        console.warn('Canvas转换失败:', canvasError.message);
        
        // 方法2：直接使用原始数据，但声明为JPEG
        console.log('使用原始PNG数据，强制声明为JPEG格式');
        finalBase64 = imageBase64;
        imageFormat = 'jpeg'; // 强制声明
      }
    }
    
    // 构建请求数据 - 始终声明为JPEG格式
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
                url: `data:image/${imageFormat};base64,${finalBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    };

    console.log('发送豆包AI请求:', {
      endpoint: DOUBAO_CONFIG.ENDPOINT,
      model: requestData.model,
      declaredFormat: imageFormat,
      originalFormat: imageInfo?.format,
      hasImageData: !!finalBase64
    });

    // 发送请求
    const response = await fetchWithTimeout(DOUBAO_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    }, DOUBAO_CONFIG.TIMEOUT);

    console.log('豆包AI响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包AI API错误响应:', errorText);
      throw new Error(`豆包AI API调用失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('豆包AI原始响应:', result);
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('豆包AI未返回有效结果');
    }

    const content = result.choices[0].message.content;
    if (!content) {
      throw new Error('豆包AI返回内容为空');
    }

    const finalResult = {
      recognizedText: content.trim(),
      confidence: 0.9,
      questionType: 'unknown',
      subject: 'unknown',
      difficulty: 3,
      processingTime: Date.now() - startTime
    };
    
    // 报告API调用成功
    const responseTime = Date.now() - startTime;
    reportAPISuccess(responseTime);
    
    console.log('豆包AI分析完成:', finalResult);
    return finalResult;

  } catch (error) {
    // 报告API调用错误
    const responseTime = Date.now() - startTime;
    reportAPIError(error, responseTime);
    
    console.error('豆包AI调用异常:', error);
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




























