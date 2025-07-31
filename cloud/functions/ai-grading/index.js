/**
 * AI智能批改云函数
 * 支持多种题目类型的智能批改和分析
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 常量定义
const QUESTION_TYPES = {
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  FILL_BLANK: 'fill_blank',
  SOLVE: 'solve',
  JUDGE: 'judge'
};

const ERROR_CODES = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  GRADING_ERROR: 'GRADING_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
};

/**
 * 云函数主入口
 * @param {Object} event - 请求参数
 * @param {Object} event.question - 题目信息
 * @param {string} event.userAnswer - 用户答案
 * @param {string} event.standardAnswer - 标准答案
 * @param {Object} event.gradingOptions - 批改选项
 * @param {Object} context - 云函数运行上下文
 * @returns {Promise<Object>} 批改结果
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  
  console.log('AI智能批改云函数开始执行:', {
    questionType: event.question?.type,
    hasUserAnswer: !!event.userAnswer,
    hasStandardAnswer: !!event.standardAnswer,
    requestId: context.requestId
  });

  try {
    // 参数验证
    const validatedParams = validateParameters(event);
    const { question, userAnswer, standardAnswer, gradingOptions } = validatedParams;

    // 根据题目类型选择批改策略
    let result;
    switch (question.type) {
      case QUESTION_TYPES.SINGLE_CHOICE:
      case QUESTION_TYPES.MULTIPLE_CHOICE:
        result = await gradeChoiceQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      case QUESTION_TYPES.FILL_BLANK:
        result = await gradeFillBlankQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      case QUESTION_TYPES.SOLVE:
        result = await gradeSolveQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      case QUESTION_TYPES.JUDGE:
        result = await gradeJudgeQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      default:
        result = await gradeGeneralQuestion(question, userAnswer, standardAnswer, gradingOptions);
    }

    const response = {
      success: true,
      data: {
        ...result,
        questionType: question.type,
        processingTime: Date.now() - startTime,
        requestId: context.requestId
      },
      timestamp: new Date().toISOString()
    };

    console.log('智能批改完成:', {
      isCorrect: result.isCorrect,
      score: result.score,
      processingTime: response.data.processingTime
    });

    return response;

  } catch (error) {
    console.error('智能批改失败:', error);
    
    return createErrorResponse(error, {
      processingTime: Date.now() - startTime,
      requestId: context.requestId
    });
  }
};

/**
 * 验证输入参数
 * @param {Object} event - 事件参数
 * @returns {Object} 验证后的参数
 * @throws {Error} 参数验证失败时抛出错误
 */
function validateParameters(event) {
  const { question, userAnswer, standardAnswer, gradingOptions = {} } = event;

  // 检查必需参数
  if (!question || typeof question !== 'object') {
    throw createError(ERROR_CODES.INVALID_PARAMS, '题目信息不能为空');
  }

  if (!question.type) {
    throw createError(ERROR_CODES.INVALID_PARAMS, '题目类型不能为空');
  }

  if (userAnswer === undefined || userAnswer === null) {
    throw createError(ERROR_CODES.INVALID_PARAMS, '用户答案不能为空');
  }

  if (!standardAnswer) {
    throw createError(ERROR_CODES.INVALID_PARAMS, '标准答案不能为空');
  }

  // 验证题目类型
  const validTypes = Object.values(QUESTION_TYPES);
  if (!validTypes.includes(question.type)) {
    throw createError(ERROR_CODES.INVALID_PARAMS, `无效的题目类型: ${question.type}`);
  }

  return {
    question: {
      type: question.type,
      content: question.content || '',
      subject: question.subject || '',
      difficulty: Math.max(1, Math.min(5, parseInt(question.difficulty) || 3))
    },
    userAnswer: normalizeAnswer(userAnswer),
    standardAnswer: normalizeAnswer(standardAnswer),
    gradingOptions: {
      strictMode: gradingOptions.strictMode || false,
      enableFuzzyMatch: gradingOptions.enableFuzzyMatch !== false,
      confidenceThreshold: Math.max(0, Math.min(1, parseFloat(gradingOptions.confidenceThreshold) || 0.8))
    }
  };
}

/**
 * 批改选择题
 * @param {Object} question - 题目对象
 * @param {string|Array} userAnswer - 用户答案
 * @param {string|Array} standardAnswer - 标准答案
 * @param {Object} options - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
async function gradeChoiceQuestion(question, userAnswer, standardAnswer, options) {
  try {
    let isCorrect = false;
    let score = 0;
    let feedback = '';
    let partialCredit = 0;

    if (question.type === QUESTION_TYPES.SINGLE_CHOICE) {
      // 单选题批改
      const userChoice = String(userAnswer).toUpperCase().trim();
      const correctChoice = String(standardAnswer).toUpperCase().trim();
      
      isCorrect = userChoice === correctChoice;
      score = isCorrect ? 100 : 0;
      feedback = isCorrect ? '回答正确！' : `正确答案是 ${correctChoice}`;
      
    } else if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
      // 多选题批改
      const userChoices = Array.isArray(userAnswer) ? 
        userAnswer.map(a => String(a).toUpperCase().trim()) : 
        [String(userAnswer).toUpperCase().trim()];
      
      const correctChoices = Array.isArray(standardAnswer) ? 
        standardAnswer.map(a => String(a).toUpperCase().trim()) : 
        [String(standardAnswer).toUpperCase().trim()];
      
      const userSet = new Set(userChoices);
      const correctSet = new Set(correctChoices);
      
      isCorrect = userSet.size === correctSet.size && 
                  [...userSet].every(choice => correctSet.has(choice));
      
      if (isCorrect) {
        score = 100;
        feedback = '回答正确！';
      } else {
        // 部分分数计算
        const intersection = [...userSet].filter(choice => correctSet.has(choice));
        const union = new Set([...userSet, ...correctSet]);
        partialCredit = intersection.length / union.size;
        score = Math.round(partialCredit * 100);
        feedback = `部分正确，正确答案是 ${correctChoices.join(', ')}`;
      }
    }

    const analysis = await generateChoiceAnalysis(question, userAnswer, standardAnswer, isCorrect);

    return {
      isCorrect,
      score,
      feedback,
      analysis,
      partialCredit,
      details: {
        gradingMethod: 'exact_match',
        userChoices: Array.isArray(userAnswer) ? userAnswer : [userAnswer],
        correctChoices: Array.isArray(standardAnswer) ? standardAnswer : [standardAnswer]
      }
    };

  } catch (error) {
    console.error('选择题批改失败:', error);
    throw createError(ERROR_CODES.GRADING_ERROR, '选择题批改失败', error);
  }
}

/**
 * 批改填空题
 * @param {Object} question - 题目对象
 * @param {string} userAnswer - 用户答案
 * @param {string} standardAnswer - 标准答案
 * @param {Object} options - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
async function gradeFillBlankQuestion(question, userAnswer, standardAnswer, options) {
  try {
    const cleanUserAnswer = preprocessAnswer(userAnswer);
    const cleanStandardAnswer = preprocessAnswer(standardAnswer);
    
    // 精确匹配
    let isCorrect = cleanUserAnswer === cleanStandardAnswer;
    let score = isCorrect ? 100 : 0;
    let feedback = '';
    let similarity = 0;
    
    if (!isCorrect && options.enableFuzzyMatch) {
      // 模糊匹配
      similarity = calculateSimilarity(cleanUserAnswer, cleanStandardAnswer);
      
      if (similarity >= options.confidenceThreshold) {
        isCorrect = true;
        score = Math.round(similarity * 100);
        feedback = '答案基本正确';
      } else if (similarity >= 0.5) {
        score = Math.round(similarity * 60); // 最高60分
        feedback = '答案部分正确，请注意细节';
      } else {
        feedback = `答案不正确，正确答案是：${standardAnswer}`;
      }
    } else {
      feedback = isCorrect ? '回答正确！' : `答案不正确，正确答案是：${standardAnswer}`;
    }

    const analysis = await generateFillBlankAnalysis(question, userAnswer, standardAnswer, isCorrect);

    return {
      isCorrect,
      score,
      feedback,
      analysis,
      similarity,
      details: {
        gradingMethod: options.enableFuzzyMatch ? 'fuzzy_match' : 'exact_match',
        cleanUserAnswer,
        cleanStandardAnswer,
        originalUserAnswer: userAnswer,
        originalStandardAnswer: standardAnswer
      }
    };

  } catch (error) {
    console.error('填空题批改失败:', error);
    throw createError(ERROR_CODES.GRADING_ERROR, '填空题批改失败', error);
  }
}

/**
 * 批改判断题
 * @param {Object} question - 题目对象
 * @param {string|boolean} userAnswer - 用户答案
 * @param {string|boolean} standardAnswer - 标准答案
 * @param {Object} options - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
async function gradeJudgeQuestion(question, userAnswer, standardAnswer, options) {
  try {
    const normalizedUserAnswer = normalizeJudgeAnswer(userAnswer);
    const normalizedStandardAnswer = normalizeJudgeAnswer(standardAnswer);
    
    const isCorrect = normalizedUserAnswer === normalizedStandardAnswer;
    const score = isCorrect ? 100 : 0;
    const feedback = isCorrect ? '回答正确！' : `正确答案是：${normalizedStandardAnswer ? '正确' : '错误'}`;

    const analysis = `判断题批改结果：${isCorrect ? '✓' : '✗'}`;

    return {
      isCorrect,
      score,
      feedback,
      analysis,
      details: {
        gradingMethod: 'boolean_match',
        normalizedUserAnswer,
        normalizedStandardAnswer
      }
    };

  } catch (error) {
    console.error('判断题批改失败:', error);
    throw createError(ERROR_CODES.GRADING_ERROR, '判断题批改失败', error);
  }
}

/**
 * 批改解答题
 * @param {Object} question - 题目对象
 * @param {string} userAnswer - 用户答案
 * @param {string} standardAnswer - 标准答案
 * @param {Object} options - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
async function gradeSolveQuestion(question, userAnswer, standardAnswer, options) {
  try {
    // 首先尝试关键词匹配
    const keywordResult = await gradeByKeywords(question, userAnswer, standardAnswer);
    
    // 如果关键词匹配度较高，直接返回结果
    if (keywordResult.matchRate >= 0.7) {
      return keywordResult;
    }
    
    // 否则使用AI分析（如果可用）
    try {
      const aiResult = await analyzeWithAI(question, userAnswer, standardAnswer);
      if (aiResult.success) {
        return {
          isCorrect: aiResult.isCorrect,
          score: aiResult.score,
          feedback: aiResult.feedback,
          analysis: aiResult.detailAnalysis,
          details: {
            gradingMethod: 'ai_analysis',
            keyPoints: aiResult.keyPoints || [],
            confidence: aiResult.confidence || 0.8
          }
        };
      }
    } catch (aiError) {
      console.warn('AI分析失败，使用关键词匹配结果:', aiError);
    }
    
    // 回退到关键词匹配结果
    return keywordResult;

  } catch (error) {
    console.error('解答题批改失败:', error);
    throw createError(ERROR_CODES.GRADING_ERROR, '解答题批改失败', error);
  }
}

/**
 * 通用题目批改
 * @param {Object} question - 题目对象
 * @param {string} userAnswer - 用户答案
 * @param {string} standardAnswer - 标准答案
 * @param {Object} options - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
async function gradeGeneralQuestion(question, userAnswer, standardAnswer, options) {
  const cleanUserAnswer = preprocessAnswer(userAnswer);
  const cleanStandardAnswer = preprocessAnswer(standardAnswer);
  
  const isCorrect = cleanUserAnswer === cleanStandardAnswer;
  const score = isCorrect ? 100 : 0;
  const feedback = isCorrect ? '回答正确！' : '回答不正确';

  return {
    isCorrect,
    score,
    feedback,
    analysis: `你的答案：${userAnswer}\n正确答案：${standardAnswer}`,
    details: {
      gradingMethod: 'simple_match'
    }
  };
}

/**
 * 工具函数：标准化答案
 */
function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) {
    return '';
  }
  return String(answer).trim();
}

/**
 * 工具函数：标准化判断题答案
 */
function normalizeJudgeAnswer(answer) {
  const str = String(answer).toLowerCase().trim();
  const trueValues = ['true', '正确', '对', '是', 'yes', 'y', '1', 'right'];
  const falseValues = ['false', '错误', '错', '否', 'no', 'n', '0', 'wrong'];
  
  if (trueValues.includes(str)) return true;
  if (falseValues.includes(str)) return false;
  
  // 如果是布尔值，直接返回
  if (typeof answer === 'boolean') return answer;
  
  // 默认返回false
  return false;
}

/**
 * 工具函数：预处理答案
 */
function preprocessAnswer(answer) {
  return String(answer)
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ''); // 只保留字母、数字和中文
}

/**
 * 工具函数：计算相似度
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // 使用简单的编辑距离算法
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length);
  return (maxLength - matrix[str2.length][str1.length]) / maxLength;
}

/**
 * 关键词匹配批改
 */
async function gradeByKeywords(question, userAnswer, standardAnswer) {
  const userWords = extractKeywords(userAnswer);
  const standardWords = extractKeywords(standardAnswer);
  
  const matchedWords = userWords.filter(word => standardWords.includes(word));
  const matchRate = standardWords.length > 0 ? matchedWords.length / standardWords.length : 0;
  
  let score = Math.round(matchRate * 100);
  let isCorrect = score >= 80;
  let feedback = '';
  
  if (isCorrect) {
    feedback = '答案正确，解题思路清晰';
  } else if (score >= 60) {
    feedback = '答案基本正确，但有些要点不够完整';
  } else if (score >= 30) {
    feedback = '答案部分正确，请注意关键步骤';
  } else {
    feedback = '答案需要改进，请重新思考解题方法';
  }

  return {
    isCorrect,
    score,
    feedback,
    analysis: `关键词匹配度：${Math.round(matchRate * 100)}%\n匹配的关键词：${matchedWords.join(', ')}`,
    matchRate,
    details: {
      gradingMethod: 'keyword_match',
      matchedKeywords: matchedWords,
      totalKeywords: standardWords.length
    }
  };
}

/**
 * 提取关键词
 */
function extractKeywords(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * 生成选择题分析
 */
async function generateChoiceAnalysis(question, userAnswer, standardAnswer, isCorrect) {
  return isCorrect ? 
    '选择正确！这道题考查的是基础知识的掌握。' :
    '选择错误。建议回顾相关知识点，加强理解。';
}

/**
 * 生成填空题分析
 */
async function generateFillBlankAnalysis(question, userAnswer, standardAnswer, isCorrect) {
  return isCorrect ?
    '填空正确！答案准确。' :
    '填空有误。请注意答案的准确性和完整性。';
}

/**
 * AI智能分析（豆包AI实现）
 */
async function analyzeWithAI(question, userAnswer, standardAnswer) {
  try {
    // 导入豆包AI配置
    const { getDoubaoConfig } = require('./shared/doubao-config');
    const DOUBAO_CONFIG = getDoubaoConfig();

    if (!DOUBAO_CONFIG.isValid) {
      console.warn('豆包AI配置无效，跳过AI分析');
      return {
        success: false,
        message: '豆包AI配置不可用'
      };
    }

    console.log('开始豆包AI智能分析');

    // 构建AI分析提示词
    const prompt = buildGradingPrompt(question, userAnswer, standardAnswer);
    
    // 调用豆包AI进行分析
    const analysisResult = await callDoubaoAPI(DOUBAO_CONFIG, {
      model: DOUBAO_CONFIG.MODEL_ID,
      messages: [
        {
          role: "system",
          content: "你是一位专业的教师，擅长各科目的智能批改。请根据题目、学生答案和标准答案，进行客观准确的评分和分析。"
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.3, // 较低的temperature确保输出稳定
      max_tokens: 500
    });

    if (analysisResult.success && analysisResult.data) {
      const aiResponse = analysisResult.data.choices?.[0]?.message?.content;
      
      if (aiResponse) {
        // 解析AI返回的结果
        const parsedResult = parseAIGradingResponse(aiResponse);
        
        return {
          success: true,
          isCorrect: parsedResult.isCorrect,
          score: parsedResult.score,
          analysis: parsedResult.analysis,
          suggestions: parsedResult.suggestions,
          keyPoints: parsedResult.keyPoints,
          aiProvider: '豆包AI'
        };
      }
    }

    throw new Error('AI分析返回结果无效');

  } catch (error) {
    console.error('豆包AI分析失败:', error);
    return {
      success: false,
      message: `AI分析失败: ${error.message}`
    };
  }
}

/**
 * 构建评分提示词
 */
function buildGradingPrompt(question, userAnswer, standardAnswer) {
  return `请对以下题目进行智能批改：

【题目信息】
类型: ${question.type || '未知'}
学科: ${question.subject || '未知'}
难度: ${question.difficulty || '中等'}
题目内容: ${question.content || question.question || '题目内容缺失'}

【学生答案】
${userAnswer || '学生未作答'}

【标准答案】
${standardAnswer || '标准答案缺失'}

【批改要求】
请按照以下JSON格式返回评分结果：
{
  "isCorrect": true/false,
  "score": 0-100,
  "analysis": "详细分析学生答案的对错和原因",
  "suggestions": "给学生的改进建议",
  "keyPoints": ["关键知识点1", "关键知识点2"]
}

请确保：
1. 评分客观公正，考虑部分正确的情况
2. 分析要具体指出学生答案的优缺点
3. 建议要具有指导性和可操作性
4. 关键知识点要准确概括
`;
}

/**
 * 解析AI评分响应
 */
function parseAIGradingResponse(aiResponse) {
  try {
    // 尝试解析JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: Boolean(parsed.isCorrect),
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        analysis: String(parsed.analysis || ''),
        suggestions: String(parsed.suggestions || ''),
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
      };
    }

    // 如果没有找到JSON，使用规则解析
    const isCorrect = /正确|对|是的|yes|true/i.test(aiResponse);
    const scoreMatch = aiResponse.match(/(\d+)\s*分/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : (isCorrect ? 100 : 0);

    return {
      isCorrect,
      score: Math.max(0, Math.min(100, score)),
      analysis: aiResponse.substring(0, 200),
      suggestions: '请仔细复习相关知识点',
      keyPoints: []
    };

  } catch (error) {
    console.error('解析AI响应失败:', error);
    return {
      isCorrect: false,
      score: 0,
      analysis: 'AI分析结果解析失败',
      suggestions: '请重新答题',
      keyPoints: []
    };
  }
}

/**
 * 调用豆包AI API
 */
async function callDoubaoAPI(config, payload) {
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(config.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      },
      body: JSON.stringify(payload),
      timeout: config.TIMEOUT || 30000
    });

    if (!response.ok) {
      throw new Error(`豆包AI API调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('豆包AI API调用失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 创建错误对象
 */
function createError(code, message, originalError = null) {
  const error = new Error(message);
  error.code = code;
  error.originalError = originalError;
  return error;
}

/**
 * 创建错误响应
 */
function createErrorResponse(error, metadata = {}) {
  return {
    success: false,
    error: {
      code: error.code || ERROR_CODES.GRADING_ERROR,
      message: error.message || '批改失败',
      details: error.originalError ? error.originalError.message : null
    },
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString()
    }
  };
} 