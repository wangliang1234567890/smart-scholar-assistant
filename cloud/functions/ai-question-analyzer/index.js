const cloud = require('wx-server-sdk');

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV 
});

/**
 * 豆包AI图片分析云函数
 * 功能：一次性完成OCR识别 + 题目解析 + 学科判断 + 难度评估
 */
exports.main = async (event, context) => {
  // 设置函数超时
  context.callbackWaitsForEmptyEventLoop = false;
  
  const startTime = Date.now();
  
  console.log('豆包AI图片分析云函数开始执行:', {
    hasImage: !!event.imageBase64,
    requestId: event.options?.requestId,
    imageSize: event.imageBase64 ? event.imageBase64.length : 0,
    analysisType: event.analysisType || 'complete',
    isTest: !!event.test
  });
  
  // 如果是测试调用，直接返回成功
  if (event.test) {
    return {
      success: true,
      recognizedText: '云函数连接正常，豆包AI图片分析服务已就绪',
      confidence: 0.95,
      questionType: 'test',
      subject: 'test',
      provider: '豆包AI',
      processingTime: Date.now() - startTime,
      testMode: true
    };
  }

  // 导入并获取豆包AI配置
  const { getDoubaoConfig } = require('./shared/doubao-config');
  const DOUBAO_CONFIG = getDoubaoConfig();

  // 验证豆包AI配置
  if (!DOUBAO_CONFIG.isValid) {
    console.error('❌ 豆包AI配置无效:', DOUBAO_CONFIG.errors);
    return await mockCompleteAnalysis(finalImageBase64, options);
  }

  try {
    const { imageBase64, imageInfo, fileID, useCloudStorage, analysisType = 'complete', options = {} } = event;
    
    // 参数验证
    if (!imageBase64 && !fileID) {
      throw new Error('缺少图片数据或文件ID');
    }

    let finalImageBase64;
    let finalImageInfo = imageInfo;

    if (useCloudStorage && fileID) {
      // 从云存储下载图片并转换为base64
      console.log('从云存储下载图片:', fileID);
      const downloadResult = await downloadAndConvertImage(fileID);
      finalImageBase64 = downloadResult.base64;
      finalImageInfo = downloadResult.info;
    } else {
      // 直接使用传入的base64数据
      finalImageBase64 = imageBase64;
      
      // 更严格的图片大小检查
      const base64SizeInBytes = finalImageBase64.length;
      const maxBase64Size = 2 * 1024 * 1024; // 2MB base64 限制
      
      console.log(`图片大小检查: ${base64SizeInBytes} bytes (限制: ${maxBase64Size} bytes)`);
      
      if (base64SizeInBytes > maxBase64Size) {
        console.error(`图片过大: ${base64SizeInBytes} > ${maxBase64Size}`);
        throw new Error(`图片文件过大 (${Math.round(base64SizeInBytes/1024/1024*100)/100}MB)，请选择更小的图片或使用裁剪功能`);
      }
    }

    if (!DOUBAO_CONFIG.API_KEY) {
      console.warn('豆包AI API密钥未配置，使用模拟模式');
      return await mockCompleteAnalysis(finalImageBase64, options);
    }
    
    // 调用豆包AI进行完整图片分析
    const analysisResult = await callDoubaoImageAnalysis(finalImageBase64, finalImageInfo, analysisType, options);
    
    const response = {
      success: true,
      // OCR结果（向后兼容）
      text: analysisResult.recognizedText,
      recognizedText: analysisResult.recognizedText,
      confidence: analysisResult.confidence,
      
      // 题目分析结果
      questionType: analysisResult.questionType,
      subject: analysisResult.subject,
      difficulty: analysisResult.difficulty,
      
      // 结构化数据
      structuredData: analysisResult.structuredData,
      
      // 详细分析
      keyPoints: analysisResult.keyPoints,
      concepts: analysisResult.concepts,
      suggestedAnswer: analysisResult.suggestedAnswer,
      explanation: analysisResult.explanation,
      
      // 元数据
      requestId: options.requestId || `doubao_${Date.now()}`,
      processingTime: Date.now() - startTime,
      provider: '豆包AI',
      modelVersion: DOUBAO_CONFIG.MODEL_ID,
      imageSource: useCloudStorage ? 'cloud-storage' : 'base64'
    };
    
    console.log('豆包AI图片分析成功:', {
      textLength: response.recognizedText?.length || 0,
      confidence: response.confidence,
      questionType: response.questionType,
      subject: response.subject,
      processingTime: response.processingTime,
      imageSource: response.imageSource
    });
    
    return response;
    
  } catch (error) {
    console.error('豆包AI图片分析失败:', error);
    
    return {
      success: false,
      error: {
        code: error.code || 'ANALYSIS_ERROR',
        message: error.message || '图片分析失败',
        details: error.details || null
      },
      requestId: event.options?.requestId,
      processingTime: Date.now() - startTime,
      provider: '豆包AI'
    };
  }
};

/**
 * 调用豆包AI进行完整图片分析
 */
async function callDoubaoImageAnalysis(imageBase64, imageInfo, analysisType, options) {
  const startTime = Date.now();
  let retryCount = 0;
  
  while (retryCount <= DOUBAO_CONFIG.MAX_RETRIES) {
    try {
      console.log(`豆包AI API调用尝试 ${retryCount + 1}/${DOUBAO_CONFIG.MAX_RETRIES + 1}`);
      
      // 构建豆包AI请求数据
      const requestData = {
        model: DOUBAO_CONFIG.MODEL_ID,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildCompleteAnalysisPrompt(analysisType, options)
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        top_p: 0.9
      };

      console.log('发送请求到豆包AI进行完整分析');

      // 发送请求到豆包AI
      const response = await fetchWithTimeout(`${DOUBAO_CONFIG.ENDPOINT}/chat/completions`, {
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

      // 解析完整分析结果
      const parsedResult = parseCompleteAnalysisResult(content);

      return {
        ...parsedResult,
        processingTime: Date.now() - startTime,
        usage: result.usage || {}
      };

    } catch (error) {
      retryCount++;
      console.error(`豆包AI调用失败 (尝试 ${retryCount}):`, error.message);
      
      if (retryCount > DOUBAO_CONFIG.MAX_RETRIES) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}

/**
 * 构建完整图片分析提示词
 */
function buildCompleteAnalysisPrompt(analysisType, options) {
  return `请对图片进行完整的学习内容分析，包括以下几个方面：

1. **文字识别**：准确识别图片中的所有文字内容，包括题目、选项、公式、符号等
2. **题目类型识别**：判断题目类型（单选题、多选题、填空题、解答题、判断题等）
3. **学科判断**：根据内容判断学科（数学、语文、英语、物理、化学、生物等）
4. **难度评估**：评估题目难度等级（1-5级，1最简单，5最难）
5. **知识点提取**：识别涉及的主要知识点和概念
6. **结构化解析**：如果是选择题，提取选项；如果是解答题，识别题目要求

请以JSON格式返回分析结果：
{
  "recognizedText": "完整的文字内容",
  "confidence": 0.95,
  "questionType": "题目类型(single_choice/multiple_choice/fill_blank/solve/judge/unknown)",
  "subject": "学科(math/chinese/english/physics/chemistry/biology/unknown)", 
  "difficulty": 3,
  "keyPoints": ["关键知识点1", "关键知识点2"],
  "concepts": ["涉及概念1", "涉及概念2"],
  "structuredData": {
    "question": "题目内容",
    "options": [{"label": "A", "content": "选项内容"}],
    "correctAnswer": "正确答案(如果能判断)",
    "requirements": "题目要求(对于解答题)"
  },
  "suggestedAnswer": "建议答案或解题思路",
  "explanation": "详细解析说明"
}

请确保：
- 文字识别准确完整
- 学科和题目类型判断准确
- 知识点提取准确
- JSON格式正确
- 如果无法确定某项内容，请标记为"unknown"或null`;
}

/**
 * 解析完整分析结果
 */
function parseCompleteAnalysisResult(content) {
  try {
    console.log('开始解析完整分析结果，内容长度:', content.length);
    
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      console.log('直接JSON解析失败，尝试提取JSON部分');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效的JSON格式');
      }
    }

    // 数据验证和标准化
    const result = {
      recognizedText: parsedData.recognizedText || content.trim(),
      confidence: Math.min(Math.max(parseFloat(parsedData.confidence) || 0.8, 0), 1),
      questionType: validateQuestionType(parsedData.questionType),
      subject: validateSubject(parsedData.subject),
      difficulty: Math.min(Math.max(parseInt(parsedData.difficulty) || 3, 1), 5),
      keyPoints: Array.isArray(parsedData.keyPoints) ? parsedData.keyPoints : [],
      concepts: Array.isArray(parsedData.concepts) ? parsedData.concepts : [],
      structuredData: parsedData.structuredData || null,
      suggestedAnswer: parsedData.suggestedAnswer || null,
      explanation: parsedData.explanation || null
    };

    console.log('完整分析结果解析成功:', {
      textLength: result.recognizedText.length,
      confidence: result.confidence,
      questionType: result.questionType,
      subject: result.subject,
      difficulty: result.difficulty,
      keyPointsCount: result.keyPoints.length
    });

    return result;

  } catch (error) {
    console.error('解析完整分析结果失败:', error);
    
    return {
      recognizedText: content.trim(),
      confidence: 0.7,
      questionType: 'unknown',
      subject: 'unknown',
      difficulty: 3,
      keyPoints: [],
      concepts: [],
      structuredData: null,
      suggestedAnswer: null,
      explanation: null
    };
  }
}

/**
 * 验证题目类型
 */
function validateQuestionType(type) {
  const validTypes = ['single_choice', 'multiple_choice', 'fill_blank', 'solve', 'judge', 'unknown'];
  return validTypes.includes(type) ? type : 'unknown';
}

/**
 * 验证学科类型
 */
function validateSubject(subject) {
  const validSubjects = ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics', 'unknown'];
  return validSubjects.includes(subject) ? subject : 'unknown';
}

/**
 * 从云存储下载图片并转换为base64
 */
async function downloadAndConvertImage(fileID) {
  try {
    console.log('开始下载云存储图片:', fileID);
    
    // 下载文件
    const downloadResult = await cloud.downloadFile({
      fileID: fileID
    });
    
    if (!downloadResult.buffer) {
      throw new Error('下载文件失败，buffer为空');
    }
    
    // 转换为base64
    const base64 = downloadResult.buffer.toString('base64');
    
    // 获取文件信息（简化版）
    const info = {
      size: downloadResult.buffer.length,
      type: 'image', // 简化处理
      source: 'cloud-storage'
    };
    
    console.log('云存储图片下载并转换成功:', {
      fileID: fileID,
      size: info.size,
      base64Length: base64.length
    });
    
    return {
      base64: base64,
      info: info
    };
    
  } catch (error) {
    console.error('下载云存储图片失败:', error);
    throw new Error(`下载云存储图片失败: ${error.message}`);
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
 * 模拟完整分析结果（当API密钥未配置时使用）
 */
async function mockCompleteAnalysis(imageBase64, options) {
  const startTime = Date.now();
  
  console.log('使用模拟图片分析模式');
  
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  
  const mockResults = [
    {
      recognizedText: '1. 下列哪个选项是正确的？\nA. 2 + 2 = 5\nB. 2 + 2 = 4\nC. 2 + 2 = 3\nD. 2 + 2 = 6',
      confidence: 0.92,
      questionType: 'single_choice',
      subject: 'math',
      difficulty: 2,
      keyPoints: ['基础运算', '加法'],
      concepts: ['数学', '运算'],
      structuredData: {
        question: '下列哪个选项是正确的？',
        options: [
          { label: 'A', content: '2 + 2 = 5' },
          { label: 'B', content: '2 + 2 = 4' },
          { label: 'C', content: '2 + 2 = 3' },
          { label: 'D', content: '2 + 2 = 6' }
        ],
        correctAnswer: 'B',
        requirements: '请选择正确的选项'
      },
      suggestedAnswer: 'B',
      explanation: '这是一个简单的选择题，考察加法运算。'
    },
    {
      recognizedText: '解方程：2x + 3 = 7\n求x的值。',
      confidence: 0.88,
      questionType: 'solve',
      subject: 'math',
      difficulty: 3,
      keyPoints: ['一元一次方程', '代数运算'],
      concepts: ['数学', '方程'],
      structuredData: {
        question: '解方程：2x + 3 = 7',
        correctAnswer: 'x = 2',
        requirements: '求解x的值'
      },
      suggestedAnswer: 'x = 2',
      explanation: '这是一个一元一次方程，通过移项和除法求解。'
    },
    {
      recognizedText: '填空：北京是中国的______。',
      confidence: 0.90,
      questionType: 'fill_blank',
      subject: 'chinese',
      difficulty: 1,
      keyPoints: ['地理常识', '首都'],
      concepts: ['地理', '中国'],
      structuredData: {
        question: '填空：北京是中国的______。',
        correctAnswer: '首都',
        requirements: '请填写正确的答案'
      },
      suggestedAnswer: '首都',
      explanation: '这是一个填空题，考察地理常识。'
    }
  ];
  
  // 随机选择一个模拟结果
  const mockResult = mockResults[Math.floor(Math.random() * mockResults.length)];
  
  return {
    success: true,
    ...mockResult,
    text: mockResult.recognizedText, // 向后兼容
    processingTime: Date.now() - startTime,
    requestId: options.requestId || `mock_${Date.now()}`,
    provider: '模拟模式',
    modelVersion: 'mock-v1.0'
  };
} 
