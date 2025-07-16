/**
 * AI题目生成云函数
 * 支持OpenAI GPT和百度文心一言
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 云函数主入口
 * @param {Object} event - 请求参数
 * @param {string} event.prompt - AI提示词
 * @param {string} event.model - 使用的AI模型
 * @param {Object} event.options - 生成选项
 * @returns {Promise<Object>} 生成的题目
 */
exports.main = async (event, context) => {
  console.log('AI题目生成云函数开始执行:', {
    promptLength: event.prompt ? event.prompt.length : 0,
    model: event.model,
    options: event.options
  });

  try {
    // 参数验证
    if (!event.prompt) {
      throw new Error('AI提示词不能为空');
    }

    // 选择AI服务提供商
    const provider = process.env.AI_PROVIDER || 'wenxin'; // 默认使用文心一言
    
    let result;
    if (provider === 'openai') {
      result = await generateWithOpenAI(event);
    } else if (provider === 'wenxin') {
      result = await generateWithWenxin(event);
    } else {
      throw new Error('不支持的AI服务提供商');
    }

    console.log('题目生成成功:', {
      questionsCount: result.questions ? result.questions.length : 0,
      totalTokens: result.usage ? result.usage.total_tokens : 0
    });

    return {
      success: true,
      ...result,
      processingTime: Date.now() - context.startTime || 0
    };

  } catch (error) {
    console.error('AI题目生成失败:', error);
    
    return {
      success: false,
      error: {
        code: error.code || 'AI_GENERATE_ERROR',
        message: error.message || '题目生成失败',
        details: error.details || null
      }
    };
  }
};

/**
 * 使用OpenAI GPT生成题目
 */
async function generateWithOpenAI(event) {
  const { prompt, model = 'gpt-3.5-turbo', maxTokens = 2000, temperature = 0.7, options = {} } = event;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API密钥未配置');
  }

  try {
    const requestData = {
      model: model,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(options)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature,
      response_format: { type: 'json_object' }
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API调用失败: ${errorData.error?.message || response.status}`);
    }

    const result = await response.json();
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('OpenAI未返回有效结果');
    }

    const content = result.choices[0].message.content;
    const questions = parseAIResponse(content);

    return {
      questions: questions,
      usage: result.usage,
      model: model,
      provider: 'openai'
    };

  } catch (error) {
    console.error('OpenAI调用失败:', error);
    throw new Error('OpenAI服务异常: ' + error.message);
  }
}

/**
 * 使用百度文心一言生成题目
 */
async function generateWithWenxin(event) {
  const { prompt, options = {} } = event;
  
  try {
    // 获取访问令牌
    const accessToken = await getWenxinAccessToken();
    
    // 构建请求数据
    const requestData = {
      messages: [
        {
          role: 'user',
          content: buildWenxinPrompt(prompt, options)
        }
      ],
      stream: false,
      temperature: 0.7,
      top_p: 0.8
    };

    // 调用文心一言API
    const response = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`文心一言API调用失败: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error_code) {
      throw new Error(`文心一言调用失败: ${result.error_msg}`);
    }

    if (!result.result) {
      throw new Error('文心一言未返回有效结果');
    }

    const questions = parseAIResponse(result.result);

    return {
      questions: questions,
      usage: result.usage || {},
      model: 'wenxin',
      provider: 'wenxin'
    };

  } catch (error) {
    console.error('文心一言调用失败:', error);
    throw new Error('文心一言服务异常: ' + error.message);
  }
}

/**
 * 获取文心一言访问令牌
 */
async function getWenxinAccessToken() {
  const API_KEY = process.env.WENXIN_API_KEY;
  const SECRET_KEY = process.env.WENXIN_SECRET_KEY;
  
  if (!API_KEY || !SECRET_KEY) {
    throw new Error('文心一言配置不完整');
  }

  // 检查缓存的token
  const cachedToken = await getFromCache('wenxin_access_token');
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
    throw new Error(`获取文心一言访问令牌失败: ${response.status}`);
  }

  const tokenData = await response.json();
  
  if (tokenData.error) {
    throw new Error(`获取文心一言访问令牌失败: ${tokenData.error_description}`);
  }

  // 缓存token（提前5分钟过期）
  const tokenInfo = {
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in - 300) * 1000
  };
  
  await setCache('wenxin_access_token', tokenInfo);
  
  return tokenData.access_token;
}

/**
 * 构建系统提示词（OpenAI专用）
 */
function buildSystemPrompt(options) {
  return `你是一个专业的教育题目生成助手。请根据用户要求生成高质量的教育题目。

要求：
1. 生成的题目必须符合指定的学科、年级和难度要求
2. 题目内容要准确、清晰、有教育价值
3. 选择题的选项要合理，有一定的迷惑性但不能误导学生
4. 必须提供详细的解析和答案
5. 返回格式必须是有效的JSON

返回格式示例：
{
  "questions": [
    {
      "type": "single_choice",
      "content": "题目内容",
      "options": [
        {"label": "选项A", "value": "A"},
        {"label": "选项B", "value": "B"}
      ],
      "correctAnswer": "A",
      "explanation": "详细解析",
      "knowledgePoints": ["知识点1", "知识点2"],
      "difficulty": 3
    }
  ]
}`;
}

/**
 * 构建文心一言专用提示词
 */
function buildWenxinPrompt(userPrompt, options) {
  const systemInfo = `你是一个专业的教育题目生成助手。请根据要求生成高质量的教育题目，并以JSON格式返回。`;
  
  const formatInfo = `
返回格式要求：
{
  "questions": [
    {
      "type": "题目类型",
      "content": "题目内容", 
      "options": [{"label": "选项文本", "value": "选项值"}],
      "correctAnswer": "正确答案",
      "explanation": "详细解析",
      "knowledgePoints": ["知识点列表"],
      "difficulty": 难度等级
    }
  ]
}`;

  return `${systemInfo}\n\n用户要求：${userPrompt}\n\n${formatInfo}`;
}

/**
 * 解析AI返回的内容
 */
function parseAIResponse(content) {
  try {
    // 尝试直接解析JSON
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法找到有效的JSON格式');
      }
    }

    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      throw new Error('返回数据格式错误：缺少questions数组');
    }

    // 验证并标准化题目格式
    const questions = parsedData.questions.map((q, index) => {
      if (!q.content) {
        throw new Error(`题目${index + 1}缺少content字段`);
      }

      return {
        id: q.id || `ai_${Date.now()}_${index}`,
        type: q.type || 'single_choice',
        content: q.content,
        stem: q.stem || '',
        options: q.options || [],
        correctAnswer: q.correctAnswer || q.correct_answer || '',
        explanation: q.explanation || '暂无解析',
        knowledgePoints: q.knowledgePoints || q.knowledge_points || [],
        difficulty: q.difficulty || 3
      };
    });

    return questions;

  } catch (error) {
    console.error('解析AI返回内容失败:', error);
    console.error('原始内容:', content);
    
    // 返回一个默认题目，避免完全失败
    return [{
      id: `fallback_${Date.now()}`,
      type: 'single_choice',
      content: '解析AI返回内容时出现错误，这是一个示例题目：1 + 1 = ?',
      options: [
        { label: '1', value: 'A' },
        { label: '2', value: 'B' },
        { label: '3', value: 'C' }
      ],
      correctAnswer: 'B',
      explanation: '1 + 1 = 2，这是基础的加法运算。',
      knowledgePoints: ['加法运算'],
      difficulty: 1
    }];
  }
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