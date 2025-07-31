const cloud = require('wx-server-sdk');

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV 
});

/**
 * 豆包AI题目生成云函数
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  
  console.log('豆包AI题目生成云函数开始执行:', {
    hasErrorQuestion: !!event.errorQuestion,
    generateCount: event.generateCount,
    requestId: event.requestId,
    isTest: !!event.test
  });
  
  // 如果是测试调用，直接返回成功
  if (event.test) {
    return {
      success: true,
      message: '豆包AI题目生成服务连接正常',
      questions: [],
      provider: '豆包AI',
      processingTime: Date.now() - startTime,
      testMode: true
    };
  }
  
  // 导入并获取豆包AI配置
  const { getDoubaoConfig } = require('./shared/doubao-config');
  const DOUBAO_CONFIG = getDoubaoConfig({ enableKeyRotation: false });

  // 验证豆包AI配置
  if (!DOUBAO_CONFIG.isValid) {
    console.error('❌ 豆包AI配置无效:', DOUBAO_CONFIG.errors, '- 使用模拟数据');
    return generateMockQuestions(event, startTime);
  }

  try {
    const { 
      errorQuestion,
      sourceErrors, 
      generateCount = 3, 
      questionTypes = ['single_choice'], 
      difficulty = 'medium',
      subject = 'math',
      knowledgePoints = []
    } = event;

    if (!errorQuestion && (!sourceErrors || sourceErrors.length === 0)) {
      throw new Error('缺少错题数据');
    }

    // 处理错题数组的情况（generateQuestionsFromMistakes调用）
    if (sourceErrors && sourceErrors.length > 0) {
      console.log(`处理${sourceErrors.length}个错题，生成${generateCount}道练习题`);
      
      // 选择第一个错题作为主要参考，或者根据难度/科目筛选
      const primaryError = sourceErrors[0];
      const result = await generateQuestionsWithDoubao(
        primaryError,
        generateCount,
        questionTypes,
        difficulty === 'auto' ? primaryError.difficulty : difficulty,
        primaryError.subject || subject,
        knowledgePoints,
        DOUBAO_CONFIG
      );
      
      return {
        success: true,
        questions: result.questions || [],
        provider: result.provider || '豆包AI',
        metadata: {
          generatedFrom: 'multiple_errors',
          sourceErrorCount: sourceErrors.length,
          requestId: event.requestId,
          ...result.metadata
        }
      };
    }

    // 调用豆包AI生成题目
    const result = await generateQuestionsWithDoubao(
      errorQuestion, 
      generateCount, 
      questionTypes, 
      difficulty,
      subject,
      knowledgePoints,
      DOUBAO_CONFIG
    );

    return {
      success: true,
      questions: result.questions,
      metadata: {
        originalQuestion: errorQuestion,
        generateCount: generateCount,
        actualCount: result.questions.length,
        difficulty: difficulty,
        subject: subject,
        processingTime: Date.now() - startTime
      },
      provider: '豆包AI'
    };

  } catch (error) {
    console.error('题目生成失败:', error);
    
    // 返回模拟数据作为降级方案
    return generateMockQuestions(event, startTime);
  }
};

/**
 * 使用豆包AI生成题目
 */
async function generateQuestionsWithDoubao(errorQuestion, count, types, difficulty, subject, knowledgePoints, config) {
  const fetch = require('node-fetch');
  
  const prompt = `基于以下错题，生成${count}道相关的${difficulty}难度练习题：

错题内容：${errorQuestion.content || errorQuestion.question}
错题答案：${errorQuestion.correctAnswer || errorQuestion.answer}
学科：${subject}
知识点：${knowledgePoints.join(', ') || '相关知识点'}

要求：
1. 生成${types.join('、')}类型的题目
2. 难度等级：${difficulty}
3. 每道题包含：题目内容、选项(如适用)、正确答案、解析
4. 返回JSON格式，包含questions数组

请严格按照以下JSON格式返回：
{
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "correctAnswer": "A",
      "explanation": "解析内容",
      "difficulty": 3,
      "subject": "${subject}",
      "knowledgePoints": ["知识点1", "知识点2"]
    }
  ]
}`;

  const requestData = {
    model: config.MODEL_ID,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.7
  };

  console.log('🚀 准备调用豆包AI:', {
    endpoint: config.ENDPOINT,
    model: config.MODEL_ID,
    promptLength: prompt.length,
    hasApiKey: !!config.API_KEY
  });

  const response = await fetch(config.ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData),
    timeout: 60000 // 增加到60秒超时
  });

  console.log('📡 豆包AI响应状态:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 豆包AI API错误:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`豆包AI API错误: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ 豆包AI调用成功:', {
    hasChoices: !!(result.choices && result.choices.length > 0),
    choicesCount: result.choices ? result.choices.length : 0,
    usage: result.usage
  });

  // 解析豆包AI响应
  const content = result.choices[0].message.content;
  
  try {
    const result = JSON.parse(content);
    return result;
  } catch (parseError) {
    console.error('解析AI返回结果失败:', parseError);
    throw new Error('AI返回格式错误');
  }
}

/**
 * 生成模拟题目作为降级方案
 */
function generateMockQuestions(event, startTime) {
  const { generateCount = 3, questionTypes = ['single_choice'], subject = 'math' } = event;
  
  const mockQuestions = [];
  
  for (let i = 0; i < generateCount; i++) {
    const type = questionTypes[i % questionTypes.length];
    
    mockQuestions.push({
      id: `mock_q${i + 1}`,
      type: type,
      question: `这是一道${subject}练习题 ${i + 1}`,
      options: type.includes('choice') ? [
        'A. 选项1',
        'B. 选项2', 
        'C. 选项3',
        'D. 选项4'
      ] : undefined,
      correctAnswer: type.includes('choice') ? 'A' : '答案示例',
      explanation: '这是题目解析',
      difficulty: 3,
      subject: subject,
      knowledgePoints: ['基础知识点'],
      isMock: true
    });
  }
  
  return {
    success: true,
    questions: mockQuestions,
    metadata: {
      generateCount: generateCount,
      actualCount: mockQuestions.length,
      processingTime: Date.now() - startTime,
      isMockData: true
    },
    provider: '模拟数据'
  };
}
