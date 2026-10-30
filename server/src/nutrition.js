import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 内置食物营养数据库（每 100g / 100ml 的 kcal / 蛋白质 / 碳水 / 脂肪，近似值）。
 * 每条记录含来源与可信度标记（quality）：
 *   reference = 可追溯的通用营养参考值（近似）
 *   official  = 品牌官方公布值（当前种子数据尚未收录，避免编造）
 *   estimated = 标准配方估算值（待核实）
 * 覆盖不足或查不到时，前端会标注「未查到营养数据」并允许用户编辑。
 * 生产环境可替换为更权威、覆盖更全的营养数据库。
 */

const foods = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'foods.json'), 'utf8'),
);

/** 规范化：去括号说明、常见量词/修饰词与空白标点。 */
function normalize(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/(约|大约|一小份|一份|半份|小份|中份|大份|一掌心|一个|一碗|一盘|半碗|半个|一整)/g, '')
    .replace(/[\s·.、,，_-]+/g, '');
}

/** 匹配打分：精确名 > 别名 > 名称包含 > 别名包含。分数越高越匹配。 */
function scoreFood(f, qn) {
  const name = normalize(f.name);
  if (name === qn) return 1000;
  const aliases = (f.aliases || []).map(normalize);
  if (aliases.includes(qn)) return 900;
  if (name.includes(qn)) return 800 - name.length;
  if (qn.includes(name) && name.length >= 2) return 700 - name.length;
  for (const a of aliases) {
    if (a.includes(qn)) return 600 - a.length;
    if (qn.includes(a) && a.length >= 2) return 500 - a.length;
  }
  return 0;
}

/** 搜索食物：按名称/别名匹配，返回匹配度排序后的食物条目。 */
export function searchFoods(query, limit = 20) {
  const qn = normalize(query);
  if (!qn) return [];
  return foods
    .map((food) => ({ food, score: scoreFood(food, qn) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.food);
}

/** 名称匹配（单一最佳结果，用于识别后查库）。返回 null 表示未查到。 */
export function lookupFood(name) {
  return searchFoods(name, 1)[0] ?? null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * 按「确认后的食物名 + 份量」计算营养（每 100g/ml 等比换算）。
 * 返回 null 表示未查到；否则返回含来源与可信度的营养结果。
 */
export function calcNutrition(foodName, amount) {
  const f = lookupFood(foodName);
  if (!f) return null;
  const k = Math.max(0, Number(amount) || 0) / 100;
  return {
    source: f.source,
    sourceLink: f.sourceLink,
    quality: f.quality,
    matchedName: f.name,
    per100Unit: f.per100Unit,
    calories: Math.round(f.per100.calories * k),
    protein: round1(f.per100.protein * k),
    carbs: round1(f.per100.carbs * k),
    fat: round1(f.per100.fat * k),
  };
}
