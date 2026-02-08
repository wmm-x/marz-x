
/**
 * Calculates the RAM usage percentage threshold for triggering optimization (restarting Xray),
 * based on the total system memory.
 *
 * @param {number} totalMemBytes - Total system memory in bytes.
 * @returns {number} The threshold percentage (e.g., 30 for 30%).
 */
function getOptimizationThreshold(totalMemBytes) {
  const totalGB = totalMemBytes / (1024 * 1024 * 1024);

  if (totalGB > 16) {
    return 30;
  } else if (totalGB > 7.7) {
    return 15;
  } else if (totalGB >= 3.8) {
    return 20;
  } else if (totalGB >= 2) {
    return 40;
  } else {
    return 60;
  }
}

module.exports = { getOptimizationThreshold };
