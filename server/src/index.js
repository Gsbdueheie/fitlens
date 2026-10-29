import app from './app.js';
import config from './config.js';

app.listen(config.port, () => {
  console.log(`[FitLens] 后端已启动：http://localhost:${config.port}`);
  console.log(
    `[FitLens] AI 识别：${
      config.aiConfigured() ? '已配置（DEEPSEEK_API_KEY 存在）' : '未配置（需在 server/.env 设置 DEEPSEEK_API_KEY）'
    }`,
  );
});
