// Auto server optimization scheduler
require('dotenv').config();
const prisma = require('./utils/prisma');
const { createMarzbanService } = require('./services/marzban.service');


function getOptimizationThreshold(totalMemBytes) {
  // Convert bytes to GB for easier comparison
  const totalGB = totalMemBytes / (1024 * 1024 * 1024);

  if (totalGB > 16) {
    return 30;
  } else if (totalGB > 4) { 
    // Covers 4GB+ to 8GB (and fills gap up to 16GB)
    return 20; 
  } else if (totalGB >= 3.8) {
    // 3.8GB - 4GB
    return 30;
  } else if (totalGB >= 2) {
    // 2GB - 3.8GB
    return 40;
  } else {
    // < 2GB
    return 50;
  }
}

async function runAutoOptimization() {
  try {
    const configs = await prisma.marzbanConfig.findMany();
    
    for (const config of configs) {
      try {
        const marzban = await createMarzbanService(config);
        
        // 1. Fetch stats first (Make sure your service has .getSystemStats())
        let stats = null;
        if (marzban.getSystemStats) {
           stats = await marzban.getSystemStats();
        } else {
           // Fallback if method doesn't exist yet, to prevent crash
           console.warn(`[AutoOptimize] Config ${config.id}: .getSystemStats() method missing in service.`);
        }

        if (stats && stats.mem_total && stats.mem_used) {
          // Calculate current usage %
          const currentUsagePercent = ((stats.mem_used / stats.mem_total) * 100).toFixed(2);
          
          // Calculate the specific limit for this server size
          const limitPercent = getOptimizationThreshold(stats.mem_total);
          
          // 2. Compare Usage vs Limit
          if (parseFloat(currentUsagePercent) >= limitPercent) {
            console.warn(`[AutoOptimize] RAM High (${currentUsagePercent}% >= ${limitPercent}%). Triggering optimization...`);
            
            const optimizeResult = await marzban.autoOptimizeServer();
            console.log(`[AutoOptimize] Config ${config.id}: Optimization completed.`);
          } else {
            console.log(`[AutoOptimize] Config ${config.id}: Healthy (${currentUsagePercent}%). Limit is ${limitPercent}%. Skipping.`);
          }
        } else {
            // If we can't read stats, we skip optimization to be safe, 
            // or you can force it if you prefer.
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
  // Default interval 10 minutes
  const intervalMinutes = parseInt(process.env.AUTO_OPTIMIZE_INTERVAL_MINUTES, 10) || 10;
  console.log(`[AutoOptimize] Scheduler started. Interval: ${intervalMinutes} min.`);
  
  setInterval(runAutoOptimization, intervalMinutes * 60 * 1000);
  runAutoOptimization();
}

module.exports = { startAutoOptimizationScheduler };