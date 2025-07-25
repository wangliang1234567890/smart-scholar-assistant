/**
 * 性能测试工具
 * 用于验证图片压缩、缓存管理和并发处理功能
 */

import ImageProcessor from './image-processor';
import CacheManager from './cache-manager';
import ConcurrentProcessor from './concurrent-processor';
import AIService from './ai-service';

class PerformanceTest {
  constructor() {
    this.testResults = [];
  }

  /**
   * 运行所有性能测试
   * @returns {Promise<Object>} 测试结果
   */
  async runAllTests() {
    console.log('🚀 开始性能测试...');
    
    const results = {
      imageCompression: await this.testImageCompression(),
      cacheManager: await this.testCacheManager(),
      concurrentProcessor: await this.testConcurrentProcessor(),
      aiServiceIntegration: await this.testAIServiceIntegration(),
      summary: {}
    };

    // 生成总结
    results.summary = this.generateSummary(results);
    
    console.log('✅ 性能测试完成');
    return results;
  }

  /**
   * 测试图片压缩功能
   * @returns {Promise<Object>} 测试结果
   */
  async testImageCompression() {
    console.log('📸 测试图片压缩功能...');
    
    const tests = [];
    
    try {
      // 测试1: 模拟大图片压缩
      const mockLargeImage = this.createMockImagePath('large', 2048, 1536);
      const compressionResult = await ImageProcessor.compressImage(mockLargeImage, {
        maxWidth: 1200,
        maxHeight: 1600,
        quality: 0.8
      });
      
      tests.push({
        name: '大图片压缩',
        success: compressionResult.success,
        details: compressionResult
      });

      // 测试2: 批量压缩
      const mockImages = [
        this.createMockImagePath('batch1', 1200, 900),
        this.createMockImagePath('batch2', 800, 600),
        this.createMockImagePath('batch3', 1600, 1200)
      ];
      
      const startTime = Date.now();
      const batchResult = await ImageProcessor.compressImages(mockImages, {
        concurrent: 2,
        maxWidth: 800,
        maxHeight: 600
      });
      const duration = Date.now() - startTime;
      
      tests.push({
        name: '批量压缩',
        success: batchResult.every(r => r.success),
        details: { batchResult, duration },
        performance: `${duration}ms for ${mockImages.length} images`
      });

      // 测试3: 图片质量分析
      const qualityAnalysis = await ImageProcessor.analyzeImageQuality(mockLargeImage);
      
      tests.push({
        name: '图片质量分析',
        success: qualityAnalysis.quality !== 'unknown',
        details: qualityAnalysis
      });

    } catch (error) {
      tests.push({
        name: '图片压缩错误处理',
        success: false,
        error: error.message
      });
    }

    return {
      module: 'ImageProcessor',
      tests,
      passed: tests.filter(t => t.success).length,
      total: tests.length
    };
  }

  /**
   * 测试缓存管理功能
   * @returns {Promise<Object>} 测试结果
   */
  async testCacheManager() {
    console.log('💾 测试缓存管理功能...');
    
    const tests = [];
    
    try {
      // 测试1: 基本缓存操作
      const testKey = 'test_cache_key';
      const testValue = { data: 'test_data', timestamp: Date.now() };
      
      const setResult = await CacheManager.set(testKey, testValue);
      const getValue = await CacheManager.get(testKey);
      
      tests.push({
        name: '基本缓存操作',
        success: setResult && JSON.stringify(getValue) === JSON.stringify(testValue),
        details: { setResult, getValue }
      });

      // 测试2: 缓存过期
      const expireKey = 'expire_test';
      await CacheManager.set(expireKey, 'expire_data', { ttl: 100 }); // 100ms过期
      
      await this.delay(150);
      const expiredValue = await CacheManager.get(expireKey);
      
      tests.push({
        name: '缓存过期',
        success: expiredValue === null,
        details: { expiredValue }
      });

      // 测试3: 内存和存储缓存
      const memoryKey = 'memory_test';
      const storageKey = 'storage_test';
      const smallData = 'small_data';
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB数据
      
      await CacheManager.set(memoryKey, smallData);
      await CacheManager.set(storageKey, largeData, { forceStorage: true });
      
      const memoryValue = await CacheManager.get(memoryKey);
      const storageValue = await CacheManager.get(storageKey);
      
      tests.push({
        name: '内存和存储缓存',
        success: memoryValue === smallData && storageValue === largeData,
        details: { memoryValue: memoryValue?.length, storageValue: storageValue?.length }
      });

      // 测试4: 缓存统计
      const stats = await CacheManager.getStats();
      
      tests.push({
        name: '缓存统计',
        success: stats && stats.memory && stats.storage,
        details: stats
      });

    } catch (error) {
      tests.push({
        name: '缓存管理错误处理',
        success: false,
        error: error.message
      });
    }

    return {
      module: 'CacheManager',
      tests,
      passed: tests.filter(t => t.success).length,
      total: tests.length
    };
  }

  /**
   * 测试并发处理功能
   * @returns {Promise<Object>} 测试结果
   */
  async testConcurrentProcessor() {
    console.log('⚡ 测试并发处理功能...');
    
    const tests = [];
    
    try {
      // 测试1: 基本任务队列
      const tasks = [];
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        tasks.push(
          ConcurrentProcessor.addTask('test', async () => {
            await this.delay(100);
            return `task_${i}_result`;
          })
        );
      }
      
      const results = await Promise.all(tasks);
      const duration = Date.now() - startTime;
      
      tests.push({
        name: '基本任务队列',
        success: results.length === 5 && results.every(r => r.includes('result')),
        details: { results, duration },
        performance: `${duration}ms for 5 tasks`
      });

      // 测试2: 批量处理
      const batchTasks = Array.from({ length: 10 }, (_, i) => 
        async () => {
          await this.delay(50);
          return `batch_${i}`;
        }
      );
      
      const batchStartTime = Date.now();
      const batchResult = await ConcurrentProcessor.batchProcess(batchTasks, {
        batchSize: 3,
        delay: 50
      });
      const batchDuration = Date.now() - batchStartTime;
      
      tests.push({
        name: '批量处理',
        success: batchResult.successCount === 10,
        details: batchResult,
        performance: `${batchDuration}ms for 10 batch tasks`
      });

      // 测试3: 限流器
      const throttledFunc = ConcurrentProcessor.throttle(
        async (value) => value * 2,
        3, // 最多3次调用
        1000 // 1秒内
      );
      
      const throttleStartTime = Date.now();
      const throttlePromises = Array.from({ length: 5 }, (_, i) => throttledFunc(i));
      const throttleResults = await Promise.all(throttlePromises);
      const throttleDuration = Date.now() - throttleStartTime;
      
      tests.push({
        name: '限流器',
        success: throttleResults.length === 5 && throttleDuration >= 1000,
        details: { throttleResults, throttleDuration },
        performance: `${throttleDuration}ms (should be >= 1000ms)`
      });

      // 测试4: 队列状态
      const queueStatus = ConcurrentProcessor.getAllQueueStatus();
      
      tests.push({
        name: '队列状态',
        success: queueStatus && queueStatus.globalStats,
        details: queueStatus
      });

    } catch (error) {
      tests.push({
        name: '并发处理错误处理',
        success: false,
        error: error.message
      });
    }

    return {
      module: 'ConcurrentProcessor',
      tests,
      passed: tests.filter(t => t.success).length,
      total: tests.length
    };
  }

  /**
   * 测试AI服务集成
   * @returns {Promise<Object>} 测试结果
   */
  async testAIServiceIntegration() {
    console.log('🤖 测试AI服务集成...');
    
    const tests = [];
    
    try {
      // 测试1: 性能配置
      const initialConfig = AIService.getServiceStatus();
      
      AIService.setPerformanceConfig({
        enableCaching: false,
        enableImageCompression: false,
        enableConcurrency: false
      });
      
      const updatedConfig = AIService.getServiceStatus();
      
      tests.push({
        name: '性能配置更新',
        success: !updatedConfig.performanceConfig.enableCaching,
        details: { initialConfig, updatedConfig }
      });

      // 测试2: 缓存键生成
      const mockImagePath = this.createMockImagePath('cache_test', 800, 600);
      const cacheKey = await AIService.generateImageCacheKey(mockImagePath, { test: true });
      
      tests.push({
        name: '缓存键生成',
        success: typeof cacheKey === 'string' && cacheKey.startsWith('ocr_'),
        details: { cacheKey }
      });

      // 测试3: 性能统计
      const perfStats = await AIService.getPerformanceStats();
      
      tests.push({
        name: '性能统计获取',
        success: perfStats && perfStats.cache && perfStats.concurrency,
        details: perfStats
      });

      // 测试4: 图片分析（模拟模式）
      const analysisStartTime = Date.now();
      const analysisResult = await AIService.analyzeQuestionFromImage(mockImagePath);
      const analysisDuration = Date.now() - analysisStartTime;
      
      tests.push({
        name: '图片分析（模拟）',
        success: analysisResult && analysisResult.success,
        details: analysisResult,
        performance: `${analysisDuration}ms`
      });

      // 测试5: 向后兼容性检查
      const compatibilityStartTime = Date.now();
      const compatibilityResult = await AIService.recognizeText(mockImagePath);
      const compatibilityDuration = Date.now() - compatibilityStartTime;
      
      tests.push({
        name: '向后兼容接口',
        success: compatibilityResult && compatibilityResult.success,
        details: compatibilityResult,
        performance: `${compatibilityDuration}ms`
      });

      // 重置配置
      AIService.setPerformanceConfig({
        enableCaching: true,
        enableImageCompression: true,
        enableConcurrency: true
      });

    } catch (error) {
      tests.push({
        name: 'AI服务集成错误处理',
        success: false,
        error: error.message
      });
    }

    return {
      module: 'AIService',
      tests,
      passed: tests.filter(t => t.success).length,
      total: tests.length
    };
  }

  /**
   * 生成测试总结
   * @param {Object} results - 测试结果
   * @returns {Object} 总结信息
   */
  generateSummary(results) {
    const modules = Object.keys(results).filter(key => key !== 'summary');
    let totalTests = 0;
    let totalPassed = 0;
    
    const moduleResults = modules.map(module => {
      const moduleData = results[module];
      totalTests += moduleData.total;
      totalPassed += moduleData.passed;
      
      return {
        module: moduleData.module,
        passed: moduleData.passed,
        total: moduleData.total,
        passRate: ((moduleData.passed / moduleData.total) * 100).toFixed(1) + '%'
      };
    });

    return {
      modules: moduleResults,
      overall: {
        totalTests,
        totalPassed,
        passRate: ((totalPassed / totalTests) * 100).toFixed(1) + '%',
        status: totalPassed === totalTests ? 'ALL_PASSED' : 'SOME_FAILED'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建模拟图片路径
   * @param {string} name - 图片名称
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {string} 模拟路径
   */
  createMockImagePath(name, width, height) {
    return `mock://image/${name}_${width}x${height}.jpg`;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} Promise对象
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 运行性能基准测试
   * @returns {Promise<Object>} 基准测试结果
   */
  async runBenchmarks() {
    console.log('📊 运行性能基准测试...');
    
    const benchmarks = {
      cachePerformance: await this.benchmarkCache(),
      concurrencyPerformance: await this.benchmarkConcurrency(),
      imageProcessingPerformance: await this.benchmarkImageProcessing()
    };

    return benchmarks;
  }

  /**
   * 缓存性能基准测试
   * @returns {Promise<Object>} 缓存基准结果
   */
  async benchmarkCache() {
    const operations = 1000;
    const testData = { test: 'data', number: 12345 };
    
    // 内存缓存基准
    const memoryStart = Date.now();
    for (let i = 0; i < operations; i++) {
      await CacheManager.set(`memory_${i}`, testData);
      await CacheManager.get(`memory_${i}`);
    }
    const memoryDuration = Date.now() - memoryStart;
    
    // 存储缓存基准
    const storageStart = Date.now();
    for (let i = 0; i < 100; i++) { // 较少操作，因为存储更慢
      await CacheManager.set(`storage_${i}`, testData, { forceStorage: true });
      await CacheManager.get(`storage_${i}`);
    }
    const storageDuration = Date.now() - storageStart;
    
    return {
      memory: {
        operations,
        duration: memoryDuration,
        opsPerSecond: Math.round((operations * 1000) / memoryDuration)
      },
      storage: {
        operations: 100,
        duration: storageDuration,
        opsPerSecond: Math.round((100 * 1000) / storageDuration)
      }
    };
  }

  /**
   * 并发性能基准测试
   * @returns {Promise<Object>} 并发基准结果
   */
  async benchmarkConcurrency() {
    const taskCount = 50;
    const taskDuration = 100;
    
    // 串行执行基准
    const serialStart = Date.now();
    for (let i = 0; i < taskCount; i++) {
      await this.delay(taskDuration);
    }
    const serialDuration = Date.now() - serialStart;
    
    // 并发执行基准
    const concurrentStart = Date.now();
    const concurrentTasks = Array.from({ length: taskCount }, () => 
      ConcurrentProcessor.addTask('benchmark', () => this.delay(taskDuration))
    );
    await Promise.all(concurrentTasks);
    const concurrentDuration = Date.now() - concurrentStart;
    
    return {
      serial: {
        tasks: taskCount,
        duration: serialDuration,
        throughput: Math.round((taskCount * 1000) / serialDuration)
      },
      concurrent: {
        tasks: taskCount,
        duration: concurrentDuration,
        throughput: Math.round((taskCount * 1000) / concurrentDuration),
        speedup: (serialDuration / concurrentDuration).toFixed(2) + 'x'
      }
    };
  }

  /**
   * 图片处理性能基准测试
   * @returns {Promise<Object>} 图片处理基准结果
   */
  async benchmarkImageProcessing() {
    const imageCount = 10;
    const images = Array.from({ length: imageCount }, (_, i) => 
      this.createMockImagePath(`benchmark_${i}`, 1200, 900)
    );
    
    // 串行处理基准
    const serialStart = Date.now();
    const serialResults = [];
    for (const image of images) {
      try {
        const result = await ImageProcessor.compressImage(image);
        serialResults.push(result);
      } catch (error) {
        // 模拟图片，可能会失败
        serialResults.push({ success: false });
      }
    }
    const serialDuration = Date.now() - serialStart;
    
    // 并发处理基准  
    const concurrentStart = Date.now();
    const concurrentResults = await ImageProcessor.compressImages(images, { concurrent: 3 });
    const concurrentDuration = Date.now() - concurrentStart;
    
    return {
      serial: {
        images: imageCount,
        duration: serialDuration,
        successCount: serialResults.filter(r => r.success).length
      },
      concurrent: {
        images: imageCount,
        duration: concurrentDuration,
        successCount: concurrentResults.filter(r => r.success).length,
        speedup: serialDuration > 0 ? (serialDuration / concurrentDuration).toFixed(2) + 'x' : 'N/A'
      }
    };
  }
}

export default new PerformanceTest(); 