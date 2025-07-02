// utils/local-db.js
// 简易本地持久化封装（使用 wx.setStorageSync）

const KEY_MISTAKES = 'mistakes';
const KEY_COURSES = 'courses';
const KEY_PRACTICE = 'practice_records';

function getList(key) {
  try {
    return wx.getStorageSync(key) || [];
  } catch (e) {
    return [];
  }
}

function setList(key, list) {
  wx.setStorageSync(key, list);
}

export default {
  // ----- 错题 -----
  getMistakes() {
    return getList(KEY_MISTAKES);
  },
  saveMistake(mistake) {
    const list = getList(KEY_MISTAKES);
    list.unshift(mistake);
    setList(KEY_MISTAKES, list);
  },
  updateMistake(id, data) {
    const list = getList(KEY_MISTAKES).map(m => (m._id === id ? { ...m, ...data } : m));
    setList(KEY_MISTAKES, list);
  },
  deleteMistake(id) {
    const list = getList(KEY_MISTAKES).filter(m => m._id !== id);
    setList(KEY_MISTAKES, list);
  },
  // ----- 课程表 -----
  getCourses() {
    return getList(KEY_COURSES);
  },
  saveCourse(course) {
    const list = getList(KEY_COURSES);
    list.unshift(course);
    setList(KEY_COURSES, list);
  },
  // ----- 练习记录 -----
  getPracticeRecords() {
    return getList(KEY_PRACTICE);
  },
  savePracticeRecord(record) {
    const list = getList(KEY_PRACTICE);
    list.unshift(record);
    setList(KEY_PRACTICE, list);
  }
}; 