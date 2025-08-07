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
    console.log('🔍 接收到的完整参数:', JSON.stringify(event, null, 2));
    
    const { 
      errorQuestion,
      sourceErrors, 
      generateCount = 2, // 减少到2道题
      questionTypes = ['single_choice'], 
      difficulty = 'medium',
      subject = 'math',
      knowledgePoints = [],
      type = 'question_generation', // 新增：请求类型
      question, // 新增：用于答案生成的题目
      options = {} // 新增：选项参数
    } = event;

    console.log('📋 参数解析结果:', {
      hasErrorQuestion: !!errorQuestion,
      hasSourceErrors: !!sourceErrors,
      sourceErrorsLength: sourceErrors ? sourceErrors.length : 0,
      generateCount,
      questionTypes,
      difficulty,
      subject,
      type,
      hasQuestion: !!question
    });

    // 处理答案生成请求
    if (type === 'answer_generation' && question) {
      console.log('🎯 开始生成答案，题目:', question.substring(0, 100) + '...');
      
      const answerResult = await generateAnswerWithDoubao(
        question,
        options,
        DOUBAO_CONFIG
      );
      
      return {
        success: true,
        answer: answerResult.answer,
        analysis: answerResult.analysis,
        provider: '豆包AI',
        processingTime: Date.now() - startTime,
        type: 'answer_generation'
      };
    }

    // 原有的题目生成逻辑
    if (!errorQuestion && (!sourceErrors || sourceErrors.length === 0)) {
      console.error('❌ 错题数据检查失败:', {
        errorQuestion: errorQuestion,
        sourceErrors: sourceErrors,
        sourceErrorsType: typeof sourceErrors,
        sourceErrorsLength: sourceErrors ? sourceErrors.length : 'undefined'
      });
      throw new Error('缺少错题数据');
    }

    // 处理错题数组的情况（generateQuestionsFromMistakes调用）
    if (sourceErrors && sourceErrors.length > 0) {
      console.log(`处理${sourceErrors.length}个错题，生成${generateCount}道练习题`);
      
      // 限制错题数量，只取前2个错题
      const limitedErrors = sourceErrors.slice(0, 2);
      const primaryError = limitedErrors[0];
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
          sourceErrorCount: limitedErrors.length, // 使用限制后的错题数量
          originalErrorCount: sourceErrors.length, // 记录原始错题数量
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
  
  const prompt = `基于错题生成${count}道练习题：

错题：${errorQuestion.content || errorQuestion.question}
答案：${errorQuestion.correctAnswer || errorQuestion.answer}
学科：${subject}

要求：生成${types.join('、')}类型题目，难度${difficulty}，包含题目、选项、答案、解析。

返回JSON格式：
{
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "correctAnswer": "A",
      "explanation": "解析",
      "difficulty": 3,
      "subject": "${subject}"
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
    max_tokens: 800, // 减少到800 tokens
    temperature: 0.7
  };

  console.log('🚀 准备调用豆包AI:', {
    endpoint: config.ENDPOINT,
    model: config.MODEL_ID,
    promptLength: prompt.length,
    hasApiKey: !!config.API_KEY
  });

  // 本地调试：放宽到60秒
  const TIMEOUT = 90000; // 90 秒（适应网络不稳定）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(config.ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

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
    console.log('🔍 AI原始返回内容长度:', content.length);
    console.log('📝 AI返回内容前200字符:', content.substring(0, 200));
    
    try {
      // 尝试提取JSON部分
      let jsonContent = content;
      
      // 如果内容包含额外文本，尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
        console.log('✂️ 提取到JSON内容长度:', jsonContent.length);
      }
      
      // 如果JSON被截断，尝试修复
      if (!jsonContent.endsWith('}')) {
        console.log('⚠️ JSON可能被截断，尝试修复...');
        // 尝试添加缺失的结束括号
        const openBraces = (jsonContent.match(/\{/g) || []).length;
        const closeBraces = (jsonContent.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        if (missingBraces > 0) {
          jsonContent += '}'.repeat(missingBraces);
          console.log('🔧 添加了', missingBraces, '个结束括号');
        }
      }
      
      const parsedResult = JSON.parse(jsonContent);
      console.log('✅ JSON解析成功，题目数量:', parsedResult.questions ? parsedResult.questions.length : 0);
      return parsedResult;
      
    } catch (parseError) {
      console.error('❌ 解析AI返回结果失败:', parseError.message);
      console.error('🔍 原始内容:', content);
      console.error('📍 解析错误位置:', parseError.message);
      throw new Error(`AI返回格式错误: ${parseError.message}`);
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`❌ 豆包AI请求超时 (${TIMEOUT/1000}秒)`);
      throw new Error('豆包AI请求超时');
    }
    throw error;
  }
}

/**
 * 使用豆包AI生成答案和解析
 */
async function generateAnswerWithDoubao(question, options, config) {
  const fetch = require('node-fetch');
  
  const TIMEOUT = 60000; // 60秒超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    console.log('🔍 开始生成答案，题目长度:', question.length);
    
    // 构建豆包AI请求数据
    const requestData = {
      model: config.MODEL_ID,
      messages: [
        {
          role: "system",
          content: "你是一位专业的教师，擅长各科目的题目解答。请根据题目内容，提供准确的答案和详细的解题步骤。"
        },
        {
          role: "user",
          content: `请解答以下题目，并提供详细的解题步骤：

题目：${question}

重要要求：
1. 使用简洁易读的文字描述，不要使用LaTeX、MathML等特殊格式
2. 数学符号请使用常见的文字符号：× ÷ ² ³ √ ≥ ≤ ≠ 等
3. 分数请写成"1/2"、"3/4"这样的形式
4. 解析要分步骤，每步都要清晰说明

请按以下格式回答：
答案：[具体答案]
解析：[详细的解题步骤和思路分析]`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      top_p: 0.9
    };

    console.log('📡 发送请求到豆包AI进行答案生成');

    // 发送请求到豆包AI
    const response = await fetch(config.ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

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
    console.log('🔍 AI原始返回内容长度:', content.length);
    console.log('📝 AI返回内容前200字符:', content.substring(0, 200));
    
    // 解析答案和解析
    const parsedResult = parseAnswerResponse(content);
    
    // 清理LaTeX格式
    const cleanAnswer = cleanLatexFormat(parsedResult.answer || 'AI生成的答案');
    const cleanAnalysis = cleanLatexFormat(parsedResult.analysis || 'AI生成的解析');
    
    console.log('✅ 答案生成成功:', {
      hasAnswer: !!parsedResult.answer,
      hasAnalysis: !!parsedResult.analysis,
      answerLength: cleanAnswer.length,
      analysisLength: cleanAnalysis.length
    });

    return {
      success: true,
      answer: cleanAnswer,
      analysis: cleanAnalysis,
      provider: '豆包AI'
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('⏰ 豆包AI请求超时');
      throw new Error('AI服务请求超时，请稍后重试');
    }
    
    console.error('❌ 豆包AI答案生成失败:', error);
    throw error;
  }
}

/**
 * 清理LaTeX格式，转换为易读文本
 */
function cleanLatexFormat(text) {
  if (!text) return '';
  
  let cleaned = text;
  
  // 移除LaTeX包装符号
  cleaned = cleaned.replace(/\\\(([^)]+)\\\)/g, '$1'); // \(内容\) -> 内容
  cleaned = cleaned.replace(/\\\[([^\]]+)\\\]/g, '$1'); // \[内容\] -> 内容
  cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1'); // $内容$ -> 内容
  
  // 替换常见的LaTeX命令为文字符号
  cleaned = cleaned.replace(/\\times/g, '×');
  cleaned = cleaned.replace(/\\div/g, '÷');
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2'); // \frac{a}{b} -> a/b
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, '√($1)'); // \sqrt{x} -> √(x)
  cleaned = cleaned.replace(/\\geq/g, '≥');
  cleaned = cleaned.replace(/\\leq/g, '≤');
  cleaned = cleaned.replace(/\\neq/g, '≠');
  cleaned = cleaned.replace(/\\pm/g, '±');
  cleaned = cleaned.replace(/\\cdot/g, '·');
  
  // 清理多余的空格和换行
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * 解析AI答案响应
 */
function parseAnswerResponse(content) {
  try {
    console.log('🔍 开始解析AI响应，内容长度:', content.length);
    console.log('📝 AI响应内容:', content);
    
    // 多种格式的答案和解析提取
    let answer = '';
    let analysis = '';
    
    // 格式1: 答案：[内容] 解析：[内容]
    const answerMatch1 = content.match(/答案[：:]\s*(.+?)(?=\n|解析|$)/s);
    const analysisMatch1 = content.match(/解析[：:]\s*(.+?)$/s);
    
    if (answerMatch1) answer = answerMatch1[1].trim();
    if (analysisMatch1) analysis = analysisMatch1[1].trim();
    
    // 格式2: 答案：内容\n解析：内容
    if (!answer || !analysis) {
      const answerMatch2 = content.match(/答案[：:]\s*([^\n]+)/);
      const analysisMatch2 = content.match(/解析[：:]\s*([\s\S]+)/);
      
      if (answerMatch2) answer = answerMatch2[1].trim();
      if (analysisMatch2) analysis = analysisMatch2[1].trim();
    }
    
    // 格式3: 直接分段处理
    if (!answer || !analysis) {
      const lines = content.split('\n').filter(line => line.trim());
      console.log('📋 分段处理，行数:', lines.length);
      
      if (lines.length >= 2) {
        // 第一行作为答案，其余作为解析
        answer = lines[0].trim();
        analysis = lines.slice(1).join('\n').trim();
      } else if (lines.length === 1) {
        // 只有一行，尝试提取等号后的内容作为答案
        const equalMatch = lines[0].match(/=\s*(.+)/);
        if (equalMatch) {
          answer = equalMatch[1].trim();
          analysis = lines[0].trim();
        } else {
          answer = lines[0].trim();
          analysis = 'AI生成的解析';
        }
      }
    }
    
    // 格式4: 数学题特殊处理
    if (!answer && content.includes('=')) {
      const equalMatch = content.match(/=\s*([^\n]+)/);
      if (equalMatch) {
        answer = equalMatch[1].trim();
        analysis = content.trim();
      }
    }
    
    // 如果还是没有找到，使用整个内容
    if (!answer) {
      answer = content.trim();
      analysis = 'AI生成的解析';
    }
    
    console.log('✅ 解析结果:', {
      answer: answer.substring(0, 50) + (answer.length > 50 ? '...' : ''),
      analysis: analysis.substring(0, 100) + (analysis.length > 100 ? '...' : ''),
      answerLength: answer.length,
      analysisLength: analysis.length
    });
    
    return {
      answer: answer || 'AI生成的答案',
      analysis: analysis || 'AI生成的解析'
    };
    
  } catch (error) {
    console.error('❌ 解析AI答案响应失败:', error);
    return {
      answer: 'AI生成的答案',
      analysis: 'AI生成的解析'
    };
  }
}

/**
 * 生成高质量练习题目作为降级方案
 */
function generateMockQuestions(event, startTime) {
  const { generateCount = 3, questionTypes = ['single_choice'], subject = 'math' } = event;
  console.log('⚠️ 使用高质量降级题目方案，学科:', subject);
  
  const mockQuestions = [];
  
  // 高质量题目模板
  const qualityTemplates = {
    math: [
      {
        type: 'single_choice',
        question: '计算：25 + 37 = ?',
        options: ['A. 52', 'B. 62', 'C. 72', 'D. 82'],
        correctAnswer: 'B',
        explanation: '25 + 37 = 62，注意进位计算'
      },
      {
        type: 'single_choice', 
        question: '一个正方形的周长是16厘米，它的边长是多少厘米？',
        options: ['A. 2厘米', 'B. 3厘米', 'C. 4厘米', 'D. 5厘米'],
        correctAnswer: 'C',
        explanation: '正方形周长 = 4 × 边长，所以边长 = 16 ÷ 4 = 4厘米'
      },
      {
        type: 'fill_blank',
        question: '6 × 7 = ___',
        options: [],
        correctAnswer: '42',
        explanation: '6乘以7等于42，这是乘法口诀表中的基础计算'
      }
    ],
    chinese: [
      {
        type: 'single_choice',
        question: '下列词语中，哪个是正确的？',
        options: ['A. 金壁辉煌', 'B. 金碧辉煌', 'C. 金璧辉煌', 'D. 金臂辉煌'],
        correctAnswer: 'B',
        explanation: '"金碧辉煌"指金光闪闪、色彩绚丽，形容建筑物等富丽堂皇'
      },
      {
        type: 'single_choice',
        question: '"春眠不觉晓"的下一句是？',
        options: ['A. 处处闻啼鸟', 'B. 花落知多少', 'C. 夜来风雨声', 'D. 鸟鸣山更幽'],
        correctAnswer: 'A',
        explanation: '这是孟浩然《春晓》中的诗句：春眠不觉晓，处处闻啼鸟'
      }
    ],
    english: [
      {
        type: 'single_choice',
        question: 'What color is the sun?',
        options: ['A. Blue', 'B. Green', 'C. Yellow', 'D. Purple'],
        correctAnswer: 'C',
        explanation: 'The sun appears yellow to us from Earth'
      },
      {
        type: 'single_choice',
        question: 'How do you say "谢谢" in English?',
        options: ['A. Hello', 'B. Thank you', 'C. Goodbye', 'D. Sorry'],
        correctAnswer: 'B',
        explanation: '"Thank you" means "谢谢" in English'
      }
    ]
  };
  
  const templates = qualityTemplates[subject] || qualityTemplates.math;
  
  for (let i = 0; i < generateCount; i++) {
    const template = templates[i % templates.length];
    const type = questionTypes[i % questionTypes.length];
    
    // 根据要求的题型调整模板
    let question = { ...template };
    if (type !== template.type) {
      question.type = type;
      if (type === 'fill_blank' && template.type === 'single_choice') {
        question.question = question.question.replace(/下列.*？/, '请填空：___');
        question.options = [];
      }
    }
    
    mockQuestions.push({
      id: `quality_q${i + 1}`,
      ...question,
      difficulty: 3,
      subject: subject,
      knowledgePoints: ['基础练习'],
      isMock: true,
      source: 'quality_fallback'
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
