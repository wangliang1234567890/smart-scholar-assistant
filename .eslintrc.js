module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    commonjs: true
  },
  extends: [
    'eslint:recommended'
  ],
  globals: {
    wx: 'readonly',
    App: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    Behavior: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      impliedStrict: true
    }
  },
  rules: {
    // 基础规则
    'no-console': 'off', // 允许console，小程序开发需要
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-duplicate-case': 'error',
    
    // 代码风格
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-before-blocks': ['error', 'always'],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', { words: true, nonwords: false }],
    
    // 函数相关
    'function-paren-newline': ['error', 'multiline-arguments'],
    'func-call-spacing': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
    'max-len': ['warn', { 
      code: 120, 
      tabWidth: 2,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
    
    // ES6+特性
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': ['error', { before: true, after: true }],
    'template-curly-spacing': ['error', 'never'],
    'object-shorthand': 'error',
    'prefer-template': 'error',
    
    // 最佳实践
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-throw-literal': 'error',
    'no-unused-expressions': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'radix': 'error',
    'yoda': 'error',
    
    // 错误处理
    'no-empty': ['error', { allowEmptyCatch: false }],
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-unreachable': 'error',
    'valid-typeof': 'error',
    
    // 异步相关
    'require-await': 'error',
    'no-async-promise-executor': 'error',
    'prefer-promise-reject-errors': 'error'
  },
  overrides: [
    {
      // 云函数特殊配置
      files: ['cloud/functions/**/*.js'],
      env: {
        node: true,
        browser: false
      },
      globals: {
        wx: 'off'
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      // 工具函数特殊配置
      files: ['utils/**/*.js'],
      rules: {
        'no-unused-vars': ['error', { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          args: 'after-used'
        }]
      }
    }
  ]
}; 