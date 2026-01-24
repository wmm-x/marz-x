
// Auto server optimization scheduler
require('dotenv').config();
const prisma = require('./utils/prisma');
const { createMarzbanService } = require('./services/marzban.service');

async function runAutoOptimization() {
  try {
    // Get all configs
    const configs = await prisma.marzbanConfig.findMany();
    for (const config of configs) {
      try {
        const marzban = await createMarzbanService(config);
        const stats = await marzban.autoOptimizeServer();
        if (stats && stats.mem_total && stats.mem_used) {
          const percent = ((stats.mem_used / stats.mem_total) * 100).toFixed(2);
          console.log(`[AutoOptimize] RAM usage: ${stats.mem_used} / ${stats.mem_total} = ${percent}%`);
        }
        console.log(`[AutoOptimize] Config ${config.id}: Optimization completed.`);
      } catch (err) {
        console.error(`[AutoOptimize] Error for config ${config.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[AutoOptimize] Failed to fetch configs:', err.message);
  }
}

function startAutoOptimizationScheduler() {
  // Get interval from .env (in minutes), default to 10
  const intervalMinutes = parseInt(process.env.AUTO_OPTIMIZE_INTERVAL_MINUTES, 10) || 10;
  console.log(`[AutoOptimize] Scheduler interval: ${intervalMinutes} minute(s)`);
  setInterval(runAutoOptimization, intervalMinutes * 60 * 1000);
  // Optionally run once at startup
  runAutoOptimization();
}

module.exports = { startAutoOptimizationScheduler };
