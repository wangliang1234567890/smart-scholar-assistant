/**
 * AI智能批改云函数
 * 支持多种题目类型的智能批改和分析
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 云函数主入口
 * @param {Object} event - 请求参数
 * @param {Object} event.question - 题目信息
 * @param {string} event.userAnswer - 用户答案
 * @param {string} event.standardAnswer - 标准答案
 * @param {Object} event.gradingOptions - 批改选项
 * @returns {Promise<Object>} 批改结果
 */
exports.main = async (event, context) => {
  console.log('AI智能批改云函数开始执行:', {
    questionType: event.question?.type,
    hasUserAnswer: !!event.userAnswer,
    hasStandardAnswer: !!event.standardAnswer
  });

  try {
    // 参数验证
    if (!event.question || !event.userAnswer || !event.standardAnswer) {
      throw new Error('批改参数不完整');
    }

    const { question, userAnswer, standardAnswer, gradingOptions = {} } = event;

    // 根据题目类型选择批改策略
    let result;
    switch (question.type) {
      case 'single_choice':
      case 'multiple_choice':
        result = await gradeChoiceQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      case 'fill_blank':
        result = await gradeFillBlankQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      case 'solve':
        result = await gradeSolveQuestion(question, userAnswer, standardAnswer, gradingOptions);
        break;
      default:
        result = await gradeGeneralQuestion(question, userAnswer, standardAnswer, gradingOptions);
    }

    console.log('智能批改完成:', {
      isCorrect: result.isCorrect,
      score: result.score,
      hasAnalysis: !!result.analysis
    });

    return {
      success: true,
      ...result,
      processingTime: Date.now() - context.startTime || 0
    };

  } catch (error) {
    console.error('智能批改失败:', error);
    
    return {
      success: false,
      error: {
        code: error.code || 'GRADING_ERROR',
        message: error.message || '批改失败',
        details: error.details || null
      }
    };
  }
};

/**
 * 批改选择题
 */
async function gradeChoiceQuestion(question, userAnswer, standardAnswer, options) {
  try {
    let isCorrect = false;
    let score = 0;
    let feedback = '';

    if (question.type === 'single_choice') {
      // 单选题批改
      isCorrect = String(userAnswer).toUpperCase() === String(standardAnswer).toUpperCase();
      score = isCorrect ? 100 : 0;
      feedback = isCorrect ? '回答正确！' : `正确答案是 ${standardAnswer}`;
      
    } else if (question.type === 'multiple_choice') {
      // 多选题批改
      const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      const standardAnswers = Array.isArray(standardAnswer) ? standardAnswer : [standardAnswer];
      
      const userSorted = userAnswers.map(a => String(a).toUpperCase()).sort();
      const standardSorted = standardAnswers.map(a => String(a).toUpperCase()).sort();
      
      isCorrect = JSON.stringify(userSorted) === JSON.stringify(standardSorted);
      
      if (isCorrect) {
        score = 100;
        feedback = '回答正确！';
      } else {
        // 部分分数计算
        const intersection = userSorted.filter(x => standardSorted.includes(x));
        const union = [...new Set([...userSorted, ...standardSorted])];
        score = Math.round((intersection.length / union.length) * 100);
        feedback = `部分正确，正确答案是 ${standardAnswers.join(', ')}`;
      }
    }

    const analysis = await generateChoiceAnalysis(question, userAnswer, standardAnswer, isCorrect);

    return {
      isCorrect,
      score,
      feedback,
      analysis,
      details: {
        questionType: question.type,
        gradingMethod: 'exact_match'
      }
    };

  } catch (error) {
    console.error('选择题批改失败:', error);
    throw error;
  }
}

/**
 * 批改填空题
 */
async function gradeFillBlankQuestion(question, userAnswer, standardAnswer, options) {
  try {
    const cleanUserAnswer = preprocessAnswer(userAnswer);
    const cleanStandardAnswer = preprocessAnswer(standardAnswer);
    
    // 精确匹配
    let isCorrect = cleanUserAnswer === cleanStandardAnswer;
    let score = isCorrect ? 100 : 0;
    let feedback = '';
    
    if (!isCorrect && options.FUZZY_MATCH_ENABLED) {
      // 模糊匹配
      const similarity = calculateSimilarity(cleanUserAnswer, cleanStandardAnswer);
      
      if (similarity >= 0.8) {
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
      details: {
        questionType: question.type,
        similarity: calculateSimilarity(cleanUserAnswer, cleanStandardAnswer),
        gradingMethod: options.FUZZY_MATCH_ENABLED ? 'fuzzy_match' : 'exact_match'
      }
    };

  } catch (error) {
    console.error('填空题批改失败:', error);
    throw error;
  }
}

/**
 * 批改解答题
 */
async function gradeSolveQuestion(question, userAnswer, standardAnswer, options) {
  try {
    // 解答题需要更复杂的分析
    const analysis = await analyzeWithAI(question, userAnswer, standardAnswer);
    
    if (analysis.success) {
      return {
        isCorrect: analysis.isCorrect,
        score: analysis.score,
        feedback: analysis.feedback,
        analysis: analysis.detailAnalysis,
        details: {
          questionType: question.type,
          gradingMethod: 'ai_analysis',
          keyPoints: analysis.keyPoints || []
        }
      };
    } else {
      // AI分析失败，使用简单的关键词匹配
      return await gradeByKeywords(question, userAnswer, standardAnswer);
    }

  } catch (error) {
    console.error('解答题批改失败:', error);
    // 降级处理
    return await gradeByKeywords(question, userAnswer, standardAnswer);
  }
}

/**
 * 通用题目批改
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
      questionType: question.type || 'general',
      gradingMethod: 'simple_match'
    }
  };
}

/**
 * 使用AI分析解答题
 */
async function analyzeWithAI(question, userAnswer, standardAnswer) {
  try {
    // 构建AI分析提示词
    const prompt = `请分析以下学生答案的正确性：

题目：${question.content}
学科：${question.subject || '数学'}
标准答案：${standardAnswer}
学生答案：${userAnswer}

请从以下几个方面分析：
1. 答案的正确性（完全正确/部分正确/完全错误）
2. 解题思路是否正确
3. 计算过程是否有误
4. 关键知识点的掌握情况
5. 给出具体的改进建议

请以JSON格式返回分析结果：
{
  "isCorrect": true/false,
  "score": 0-100,
  "feedback": "简短反馈",
  "detailAnalysis": "详细分析",
  "keyPoints": ["关键点1", "关键点2"]
}`;

    // 这里应该调用AI服务，简化处理返回模拟结果
    // 实际部署时可以集成到ai-question-generator云函数中
    
    return {
      success: false,
      message: 'AI分析服务暂未集成'
    };

  } catch (error) {
    console.error('AI分析失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
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
    details: {
      questionType: question.type,
      gradingMethod: 'keyword_match',
      matchRate: matchRate,
      matchedKeywords: matchedWords
    }
  };
}

/**
 * 生成选择题分析
 */
async function generateChoiceAnalysis(question, userAnswer, standardAnswer, isCorrect) {
  if (isCorrect) {
    return `回答正确！正确答案确实是 ${standardAnswer}。`;
  } else {
    return `你选择了 ${userAnswer}，但正确答案是 ${standardAnswer}。
建议：请重新理解题目要求，仔细分析各个选项的含义。`;
  }
}

/**
 * 生成填空题分析
 */
async function generateFillBlankAnalysis(question, userAnswer, standardAnswer, isCorrect) {
  if (isCorrect) {
    return `回答正确！答案就是：${standardAnswer}`;
  } else {
    return `你的答案是"${userAnswer}"，标准答案是"${standardAnswer}"。
建议：注意答案的准确性和完整性，检查是否有遗漏或错误的地方。`;
  }
}

/**
 * 预处理答案
 */
function preprocessAnswer(answer) {
  if (!answer) return '';
  
  return answer
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // 标准化空格
    .replace(/[，。！？；：]/g, match => {
      // 中文标点转英文
      const map = { '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':' };
      return map[match] || match;
    })
    .replace(/[^\w\u4e00-\u9fa5\s.,!?;:()]/g, ''); // 移除特殊字符
}

/**
 * 计算相似度
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // 使用编辑距离计算相似度
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * 计算编辑距离
 */
function levenshteinDistance(str1, str2) {
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
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 提取关键词
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // 简单的关键词提取
  const words = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1)
    .filter(word => !isStopWord(word));

  // 去重
  return [...new Set(words)];
}

/**
 * 判断是否为停用词
 */
function isStopWord(word) {
  const stopWords = [
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这样',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ];
  
  return stopWords.includes(word.toLowerCase());
} 