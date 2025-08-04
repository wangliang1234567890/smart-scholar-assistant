/**
 * 云函数测试工具
 * 用于诊断和测试云函数的调用和返回
 */

class CloudFunctionTester {
  /**
   * 测试AI题目生成云函数
   */
  static async testAIQuestionGenerator() {
    console.log('🧪 开始测试AI题目生成云函数...');
    
    try {
      // 模拟错题数据
      const mockMistakes = [
        {
          question: '计算：2 + 3 = ?',
          answer: '5',
          subject: 'math',
          difficulty: 2,
          userAnswer: '4'
        },
        {
          question: '下列哪个是正确的拼音？',
          answer: 'A. zhōng guó',
          subject: 'chinese',
          difficulty: 3,
          userAnswer: 'B. zhong guo'
        }
      ];
      
      // 测试参数
      const testParams = {
        sourceErrors: mockMistakes.map(mistake => ({
          content: mistake.question,
          subject: mistake.subject,
          difficulty: mistake.difficulty,
          correctAnswer: mistake.answer,
          wrongAnswer: mistake.userAnswer
        })),
        generateCount: 3,
        questionTypes: ['single_choice', 'fill_blank'],
        difficulty: 'medium',
        requestId: `test_${Date.now()}`,
        useDoubao: true
      };
      
      console.log('📤 发送测试参数:', JSON.stringify(testParams, null, 2));
      
      // 调用云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-question-generator',
        data: testParams
      });
      
      console.log('📥 云函数返回结果:', JSON.stringify(result, null, 2));
      
      // 验证结果
      if (result.result && result.result.success) {
        console.log('✅ 云函数调用成功');
        if (result.result.questions && result.result.questions.length > 0) {
          console.log(`✅ 成功生成 ${result.result.questions.length} 道题目`);
          console.log('📋 题目预览:', result.result.questions[0]);
        } else {
          console.warn('⚠️ 云函数返回成功但没有题目');
        }
      } else {
        console.error('❌ 云函数调用失败:', result.result);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ 测试云函数时发生错误:', error);
      throw error;
    }
  }
  
  /**
   * 在页面中显示测试结果
   */
  static showTestResult(result) {
    const summary = this.generateTestSummary(result);
    
    wx.showModal({
      title: '云函数测试结果',
      content: summary,
      showCancel: false,
      confirmText: '确定'
    });
  }
  
  /**
   * 生成测试结果摘要
   */
  static generateTestSummary(result) {
    if (!result || !result.result) {
      return '测试失败：无返回结果';
    }
    
    const { result: cloudResult } = result;
    
    if (cloudResult.success) {
      const questionCount = cloudResult.questions ? cloudResult.questions.length : 0;
      const provider = cloudResult.provider || '未知';
      const isMock = cloudResult.questions && cloudResult.questions[0] && cloudResult.questions[0].isMock;
      
      return `✅ 测试成功
📊 生成题目：${questionCount} 道
🏭 数据来源：${provider}
🎭 模拟数据：${isMock ? '是' : '否'}
⏱️ 处理时间：${cloudResult.metadata?.processingTime || 0}ms`;
    } else {
      return `❌ 测试失败
📋 错误信息：${cloudResult.error || '未知错误'}`;
    }
  }
}

module.exports = CloudFunctionTester; 