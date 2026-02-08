
require('dotenv').config();
const prisma = require('./utils/prisma');
const { createMarzbanService } = require('./services/marzban.service');
const { getOptimizationThreshold } = require('./utils/optimizationThresholds');

async function runAutoOptimization() {
  try {
    const configs = await prisma.marzbanConfig.findMany();
    
    for (const config of configs) {
      try {
        const marzban = await createMarzbanService(config);
        
        let stats = null;
        if (marzban.getSystemStats) {
           stats = await marzban.getSystemStats();
        } else {

           console.warn(`[AutoOptimize] Config ${config.id}: .getSystemStats() method missing in service.`);
        }

        if (stats && stats.mem_total && stats.mem_used) {
          const currentUsagePercent = ((stats.mem_used / stats.mem_total) * 100).toFixed(2);
          
          const limitPercent = getOptimizationThreshold(stats.mem_total);
          
          if (parseFloat(currentUsagePercent) >= limitPercent) {
            console.warn(`[AutoOptimize] RAM High (${currentUsagePercent}% >= ${limitPercent}%). Triggering optimization...`);
            
            // Optimization: Pass already fetched stats to avoid redundant API call
            const optimizeResult = await marzban.autoOptimizeServer(stats);
            console.log(`[AutoOptimize] Config ${config.id}: Optimization completed.`);
          } else {
            console.log(`[AutoOptimize] Config ${config.id}: Healthy (${currentUsagePercent}%). Limit is ${limitPercent}%. Skipping.`);
          }
        } else {
    
            console.warn(`[AutoOptimize] Config ${config.id}: Could not read RAM stats. Skipping.`);
        }

      } catch (err) {
        console.error(`[AutoOptimize] Error for config ${config.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[AutoOptimize] Failed to fetch configs:', err.message);
  }
}

function startAutoOptimizationScheduler() {
  const intervalMinutes = parseInt(process.env.AUTO_OPTIMIZE_INTERVAL_MINUTES, 10) || 10;
  console.log(`[AutoOptimize] Scheduler started. Interval: ${intervalMinutes} min.`);
  
  setInterval(runAutoOptimization, intervalMinutes * 60 * 1000);
  runAutoOptimization();
}

module.exports = { startAutoOptimizationScheduler };