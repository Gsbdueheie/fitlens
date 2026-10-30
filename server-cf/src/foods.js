// 共享同一份营养数据库（与 server/data/foods.json 一致），避免两处维护。
// 每条记录含名称/别名/分类/品牌/款式/规格、每 100g(ml) 营养素、来源与可信度标记。
import foods from '../../server/data/foods.json';

export default foods;
