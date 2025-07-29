// 智能学霸小助手 - 常量定义

// 学科列表
export const SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];

// 年级列表
export const GRADES = [
  { value: 1, label: '一年级' },
  { value: 2, label: '二年级' },
  { value: 3, label: '三年级' },
  { value: 4, label: '四年级' },
  { value: 5, label: '五年级' },
  { value: 6, label: '六年级' },
  { value: 7, label: '初一' },
  { value: 8, label: '初二' },
  { value: 9, label: '初三' },
  { value: 10, label: '高一' },
  { value: 11, label: '高二' },
  { value: 12, label: '高三' }
];

// 难度等级
export const DIFFICULTY_LEVELS = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5
};

export const DIFFICULTY_LABELS = {
  [DIFFICULTY_LEVELS.VERY_EASY]: '很简单',
  [DIFFICULTY_LEVELS.EASY]: '简单',
  [DIFFICULTY_LEVELS.MEDIUM]: '中等',
  [DIFFICULTY_LEVELS.HARD]: '困难',
  [DIFFICULTY_LEVELS.VERY_HARD]: '很困难'
};

// 错题状态
export const MISTAKE_STATUS = {
  UNKNOWN: 'unknown',      // 未掌握
  LEARNING: 'learning',    // 学习中
  MASTERED: 'mastered'     // 已掌握
};

export const MISTAKE_STATUS_LABELS = {
  [MISTAKE_STATUS.UNKNOWN]: '未掌握',
  [MISTAKE_STATUS.LEARNING]: '学习中',
  [MISTAKE_STATUS.MASTERED]: '已掌握'
};

// 题目类型
export const QUESTION_TYPES = {
  CHOICE: 'choice',        // 选择题
  FILL: 'fill',           // 填空题
  SOLVE: 'solve',         // 解答题
  JUDGE: 'judge'          // 判断题
};

export const QUESTION_TYPE_LABELS = {
  [QUESTION_TYPES.CHOICE]: '选择题',
  [QUESTION_TYPES.FILL]: '填空题',
  [QUESTION_TYPES.SOLVE]: '解答题',
  [QUESTION_TYPES.JUDGE]: '判断题'
};

// AI服务配置（简化版 - 已去掉独立OCR配置）
export const AI_CONFIG = {
  // AI题目生成配置
  QUESTION_GENERATION: {
    // GPT配置
    OPENAI: {
      API_KEY: '', // 在云函数中配置
      BASE_URL: 'https://api.openai.com/v1',
      MODEL: 'gpt-3.5-turbo',
      MAX_TOKENS: 2000,
      TEMPERATURE: 0.7
    },
    // 百度文心一言配置
    WENXIN: {
      API_KEY: '', // 在云函数中配置
      SECRET_KEY: '', // 在云函数中配置
      ACCESS_TOKEN_URL: 'https://aip.baidubce.com/oauth/2.0/token',
      CHAT_URL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions'
    },
    // 配置选项
    OPTIONS: {
      MAX_QUESTIONS: 20,
      TIMEOUT: 30000,
      RETRY_COUNT: 3,
      RESPONSE_FORMAT: 'json'
    }
  },
  
  // AI智能批改配置
  AUTO_GRADING: {
    ACCURACY_THRESHOLD: 0.85,
    FUZZY_MATCH_ENABLED: true,
    CHINESE_MATCH_ENABLED: true,
    MATH_FORMULA_ENABLED: true
  }
};

// 用户等级配置
export const USER_LEVELS = {
  1: { name: '学习新手', exp: 0, color: '#909399' },
  2: { name: '勤奋学徒', exp: 100, color: '#67C23A' },
  3: { name: '进步达人', exp: 300, color: '#E6A23C' },
  4: { name: '学霸初成', exp: 600, color: '#F56C6C' },
  5: { name: '知识大师', exp: 1000, color: '#409EFF' },
  6: { name: '学霸精英', exp: 1500, color: '#8E44AD' },
  7: { name: '学术专家', exp: 2100, color: '#E74C3C' },
  8: { name: '智慧导师', exp: 2800, color: '#2ECC71' },
  9: { name: '知识巨匠', exp: 3600, color: '#F39C12' },
  10: { name: '学霸传奇', exp: 4500, color: '#9B59B6' }
};

// 成就类型
export const ACHIEVEMENT_TYPES = {
  MISTAKE_COUNT: 'mistake_count',       // 错题收集
  PRACTICE_COUNT: 'practice_count',     // 练习次数
  MASTERY_RATE: 'mastery_rate',        // 掌握率
  CONTINUOUS_DAYS: 'continuous_days',   // 连续学习天数
  SUBJECT_MASTER: 'subject_master'      // 学科专精
};

// 成就配置
export const ACHIEVEMENTS = {
  // 错题收集成就
  FIRST_MISTAKE: {
    id: 'first_mistake',
    type: ACHIEVEMENT_TYPES.MISTAKE_COUNT,
    name: '初出茅庐',
    description: '收录第一道错题',
    target: 1,
    reward: 10,
    icon: '🌱'
  },
  MISTAKE_10: {
    id: 'mistake_10',
    type: ACHIEVEMENT_TYPES.MISTAKE_COUNT,
    name: '错题小能手',
    description: '收录10道错题',
    target: 10,
    reward: 50,
    icon: '📝'
  },
  MISTAKE_50: {
    id: 'mistake_50',
    type: ACHIEVEMENT_TYPES.MISTAKE_COUNT,
    name: '错题收集家',
    description: '收录50道错题',
    target: 50,
    reward: 100,
    icon: '📚'
  },
  
  // 练习次数成就
  PRACTICE_10: {
    id: 'practice_10',
    type: ACHIEVEMENT_TYPES.PRACTICE_COUNT,
    name: '勤学苦练',
    description: '完成10次练习',
    target: 10,
    reward: 50,
    icon: '💪'
  },
  
  // 掌握率成就
  MASTERY_50: {
    id: 'mastery_50',
    type: ACHIEVEMENT_TYPES.MASTERY_RATE,
    name: '初见成效',
    description: '错题掌握率达到50%',
    target: 50,
    reward: 100,
    icon: '🎯'
  },
  MASTERY_80: {
    id: 'mastery_80',
    type: ACHIEVEMENT_TYPES.MASTERY_RATE,
    name: '学霸初成',
    description: '错题掌握率达到80%',
    target: 80,
    reward: 200,
    icon: '🏆'
  }
};

// 复习间隔（天）
export const REVIEW_INTERVALS = [1, 3, 7, 15, 30, 60];

// 学习提醒时间选项
export const REMINDER_TIMES = [
  { value: '07:00', label: '早上 07:00' },
  { value: '08:00', label: '早上 08:00' },
  { value: '19:00', label: '晚上 19:00' },
  { value: '20:00', label: '晚上 20:00' },
  { value: '21:00', label: '晚上 21:00' }
];

// 课程时间段
export const CLASS_PERIODS = [
  { value: 1, label: '第一节 (08:00-08:40)', start: '08:00', end: '08:40' },
  { value: 2, label: '第二节 (08:50-09:30)', start: '08:50', end: '09:30' },
  { value: 3, label: '第三节 (09:40-10:20)', start: '09:40', end: '10:20' },
  { value: 4, label: '第四节 (10:30-11:10)', start: '10:30', end: '11:10' },
  { value: 5, label: '第五节 (11:20-12:00)', start: '11:20', end: '12:00' },
  { value: 6, label: '第六节 (14:00-14:40)', start: '14:00', end: '14:40' },
  { value: 7, label: '第七节 (14:50-15:30)', start: '14:50', end: '15:30' },
  { value: 8, label: '第八节 (15:40-16:20)', start: '15:40', end: '16:20' },
  { value: 9, label: '第九节 (16:30-17:10)', start: '16:30', end: '17:10' }
];

// 星期配置
export const WEEKDAYS = [
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
  { value: 0, label: '周日', short: '日' }
];

// API配置
export const API_CONFIG = {
  TIMEOUT: 10000,
  RETRY_COUNT: 3,
  BASE_URL: {
    DEVELOPMENT: 'https://dev-api.example.com',
    PRODUCTION: 'https://api.example.com'
  }
};

// 云开发配置
export const CLOUD_CONFIG = {
  ENV_ID: {
    DEVELOPMENT: 'cloud1-9gms5vr2451418c9',
    PRODUCTION: 'cloud1-9gms5vr2451418c9'  // 开发阶段可以先用同一个环境
  }
};

// 文件上传配置
export const UPLOAD_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  COMPRESS_QUALITY: 0.8
};

// 注意：OCR配置已整合到豆包AI配置中，请使用DOUBAO_CONFIG

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

// 缓存配置
export const CACHE_CONFIG = {
  USER_INFO: 'userInfo',
  SETTINGS: 'userSettings',
  SUBJECTS: 'selectedSubjects',
  THEME: 'theme'
};

// 错误码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_PARAMS: 'INVALID_PARAMS',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// 颜色主题
export const COLORS = {
  PRIMARY: '#4F46E5',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  INFO: '#3B82F6',
  GRAY: '#6B7280'
};

// 图标映射
export const ICONS = {
  SUBJECTS: {
    '数学': 'calculator',
    '语文': 'font',
    '英语': 'translate',
    '物理': 'experiment',
    '化学': 'flask',
    '生物': 'leaf',
    '历史': 'history',
    '地理': 'globe',
    '政治': 'balance'
  },
  DIFFICULTY: {
    [DIFFICULTY_LEVELS.VERY_EASY]: '⭐',
    [DIFFICULTY_LEVELS.EASY]: '⭐⭐',
    [DIFFICULTY_LEVELS.MEDIUM]: '⭐⭐⭐',
    [DIFFICULTY_LEVELS.HARD]: '⭐⭐⭐⭐',
    [DIFFICULTY_LEVELS.VERY_HARD]: '⭐⭐⭐⭐⭐'
  }
};

// 默认配置
export const DEFAULT_CONFIG = {
  USER: {
    grade: 1,
    subjects: ['数学', '语文', '英语'],
    reminderEnabled: true,
    autoReview: true,
    difficulty: DIFFICULTY_LEVELS.MEDIUM
  },
  PRACTICE: {
    questionCount: 10,
    timeLimit: 0,
    autoNext: true
  }
};

// 豆包AI前端配置 - 仅包含非敏感信息
// 注意：API密钥等敏感信息仅在云函数中配置
export const DOUBAO_CONFIG = {
  // API_KEY 在云函数中通过环境变量配置
  ENDPOINT: 'https://ark.cn-beijing.volces.com/api/v3',
  MODEL_ID: 'doubao-seed-1-6-250615',
  
  OCR: {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
    TIMEOUT: 30000,
    RETRY_COUNT: 3, // 增加重试次数
    CONFIDENCE_THRESHOLD: 0.7,
    
    // 优化的压缩配置
    COMPRESSION: {
      MAX_WIDTH: 1920,
      MAX_HEIGHT: 1920,
      QUALITY: 70,
      ENABLE_AUTO_COMPRESS: true,
      AGGRESSIVE_QUALITY: 40 // 降级时使用的质量
    },
    
    // 优化的传输配置
    TRANSMISSION: {
      BASE64_THRESHOLD: 800 * 1024, // 提升到800KB
      USE_CLOUD_STORAGE_ABOVE: 800 * 1024,
      RETRY_BASE_DELAY: 1000,
      RETRY_MAX_DELAY: 10000
    }
  },
  
  // 题目生成配置
  QUESTION_GENERATION: {
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.7,
    TOP_P: 0.9,
    TIMEOUT: 45000
  },
  
  // 错误码定义
  ERROR_CODES: {
    API_KEY_INVALID: 'API_KEY_INVALID',
    IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    CLOUD_STORAGE_ERROR: 'CLOUD_STORAGE_ERROR',
    COMPRESSION_FAILED: 'COMPRESSION_FAILED'
  }
};
