/**
 * 打印服务 - 支持试卷打印
 */
class PrintService {
  constructor() {
    this.printers = [];
    this.currentPrinter = null;
  }

  /**
   * 搜索可用打印机
   */
  async searchPrinters() {
    try {
      // 微信小程序打印机搜索
      const result = await wx.startBluetoothDevicesDiscovery({
        services: ['18F0'], // 打印机服务UUID
        allowDuplicatesKey: false
      });
      
      return new Promise((resolve) => {
        const devices = [];
        
        wx.onBluetoothDeviceFound((res) => {
          res.devices.forEach(device => {
            if (device.name && device.name.includes('Printer')) {
              devices.push({
                deviceId: device.deviceId,
                name: device.name,
                RSSI: device.RSSI
              });
            }
          });
        });
        
        setTimeout(() => {
          wx.stopBluetoothDevicesDiscovery();
          this.printers = devices;
          resolve({ success: true, printers: devices });
        }, 5000);
      });
      
    } catch (error) {
      console.error('搜索打印机失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 连接打印机
   */
  async connectPrinter(deviceId) {
    try {
      await wx.createBLEConnection({ deviceId });
      this.currentPrinter = deviceId;
      return { success: true };
    } catch (error) {
      console.error('连接打印机失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 打印试卷
   */
  async printExamPaper(printData, options = {}) {
    if (!this.currentPrinter) {
      throw new Error('请先连接打印机');
    }
    
    try {
      const printCommands = this.generatePrintCommands(printData, options);
      
      for (const command of printCommands) {
        await this.sendPrintCommand(command);
        await this.delay(100); // 避免发送过快
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('打印失败:', error);
      throw error;
    }
  }

  /**
   * 生成打印指令
   */
  generatePrintCommands(printData, options) {
    const commands = [];
    
    // 打印头部
    commands.push(this.formatHeader(printData.header));
    
    // 打印说明
    if (printData.instructions) {
      commands.push(this.formatInstructions(printData.instructions));
    }
    
    // 打印题目
    printData.sections.forEach((section, sectionIndex) => {
      commands.push(this.formatSectionTitle(section.title));
      
      section.questions.forEach((question, questionIndex) => {
        commands.push(this.formatQuestion(question, questionIndex + 1));
      });
    });
    
    // 打印页脚
    commands.push(this.formatFooter(printData.footer));
    
    return commands;
  }

  formatHeader(header) {
    return [
      '\x1B\x40', // 初始化
      '\x1B\x61\x01', // 居中对齐
      '\x1D\x21\x11', // 字体放大
      header.title + '\n',
      '\x1D\x21\x00', // 恢复字体
      header.subtitle + '\n',
      header.info.join('  ') + '\n',
      '\x1B\x61\x00', // 左对齐
      '=' * 32 + '\n'
    ].join('');
  }

  formatInstructions(instructions) {
    return [
      '考试说明：\n',
      ...instructions.map(inst => `${inst}\n`),
      '=' * 32 + '\n'
    ].join('');
  }

  formatSectionTitle(title) {
    return `\n${title}\n${'=' * 20}\n`;
  }

  formatQuestion(question, number) {
    let formatted = `${number}. ${question.content}\n`;
    
    if (question.options && question.options.length > 0) {
      question.options.forEach((option, index) => {
        const label = String.fromCharCode(65 + index);
        formatted += `${label}. ${option}\n`;
      });
    }
    
    formatted += `${question.answerSpace}\n`;
    formatted += `(${question.score}分)\n\n`;
    
    return formatted;
  }

  formatFooter(footer) {
    return [
      '\n' + '=' * 32 + '\n',
      `生成时间：${new Date(footer.generatedAt).toLocaleString()}\n`,
      `来源：${footer.source}\n`
    ].join('');
  }

  async sendPrintCommand(command) {
    // 实际的蓝牙打印指令发送
    const buffer = this.stringToArrayBuffer(command);
    return wx.writeBLECharacteristicValue({
      deviceId: this.currentPrinter,
      serviceId: '18F0',
      characteristicId: '2AF1',
      value: buffer
    });
  }

  stringToArrayBuffer(str) {
    const buffer = new ArrayBuffer(str.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buffer;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 断开打印机连接
   */
  async disconnect() {
    if (this.currentPrinter) {
      try {
        await wx.closeBLEConnection({ deviceId: this.currentPrinter });
        this.currentPrinter = null;
      } catch (error) {
        console.error('断开打印机连接失败:', error);
      }
    }
  }
}

export default new PrintService();