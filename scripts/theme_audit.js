// scripts/theme_audit.js
// 扫描项目中遗留的硬编码颜色（hex / rgb / rgba）以及未被引用的图片资源
// 使用：node scripts/theme_audit.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const workspace = path.resolve(__dirname, '..');

// 1. 颜色扫描 -----------------------------------------------------------
function scanColors() {
  const wxssFiles = glob.sync('**/*.wxss', {
    cwd: workspace,
    ignore: ['miniprogram_npm/**', 'node_modules/**', 'dist/**', 'app.wxss']
  });
  const colorRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})|rgba?\([^)]*\)/g;
  const ignoreLineRegex = /var\(--/; // 已使用 CSS 变量的不算

  const colorMap = new Map();

  wxssFiles.forEach(file => {
    const abs = path.join(workspace, file);
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (ignoreLineRegex.test(line)) return;
      const matches = line.match(colorRegex);
      if (matches) {
        matches.forEach(color => {
          if (!colorMap.has(color)) colorMap.set(color, []);
          colorMap.get(color).push(`${file}:${idx + 1}`);
        });
      }
    });
  });

  return colorMap;
}

// 2. 图片引用扫描 -------------------------------------------------------
function scanImageUsage() {
  const imgExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];
  const imageFiles = glob.sync('images/**/*.*', {
    cwd: workspace,
    nodir: true
  });

  // 搜索引用
  const codeFiles = glob.sync('**/*.{wxml,wxss,js,json}', {
    cwd: workspace,
    ignore: ['miniprogram_npm/**', 'node_modules/**', 'dist/**']
  });
  const referenced = new Set();

  codeFiles.forEach(file => {
    const abs = path.join(workspace, file);
    const content = fs.readFileSync(abs, 'utf8');
    imageFiles.forEach(img => {
      if (referenced.has(img)) return;
      const short = img.replace(/\\/g, '/');
      if (content.includes(short)) {
        referenced.add(img);
      }
    });
  });

  const unused = imageFiles.filter(img => !referenced.has(img));
  return { total: imageFiles.length, unused };
}

function main() {
  console.log('开始主题审计...');
  console.log('1) 扫描硬编码颜色...');
  const colorMap = scanColors();
  if (colorMap.size === 0) {
    console.log('✅ 未发现硬编码颜色！');
  } else {
    console.log(`⚠️ 发现 ${colorMap.size} 种硬编码颜色：`);
    colorMap.forEach((locations, color) => {
      console.log(`  - ${color}  (${locations.length} 次)`);
      locations.slice(0, 5).forEach(loc => console.log(`      • ${loc}`));
      if (locations.length > 5) console.log('      ...');
    });
  }

  console.log('\n2) 扫描未使用的图片资源...');
  const imgResult = scanImageUsage();
  if (imgResult.unused.length === 0) {
    console.log('✅ 未发现未使用的图片！');
  } else {
    console.log(`⚠️ 共 ${imgResult.total} 张图片，有 ${imgResult.unused.length} 张未被引用：`);
    imgResult.unused.slice(0, 20).forEach(img => console.log(`  • ${img}`));
    if (imgResult.unused.length > 20) console.log('  ...');
  }

  console.log('\n审计完成');
}

main(); 