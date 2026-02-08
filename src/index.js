import { CryptoOracle, SportsBot, PoliticsAI, PopCulture } from './agents/index.js';
import fs from 'fs';
import path from 'path';

/**
 * OracleAI - Main orchestrator for prediction market agents
 * Manages multiple specialized agents across different domains
 */
export class OracleAI {
  constructor(config = {}) {
    this.agents = new Map();
    this.config = {
      autoRun: config.autoRun || false,
      runInterval: config.runInterval || 60 * 60 * 1000, // 1 hour
      logDir: config.logDir || './data/logs',
      ...config
    };
    this.running = false;
    this.timer = null;
  }

  /**
   * Register an agent
   */
  register(agent) {
    this.agents.set(agent.id, agent);
    console.log(`[OracleAI] Registered agent: ${agent.name}`);
    return this;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id) {
    return this.agents.get(id);
  }

  /**
   * Initialize all agents
   */
  async init() {
    console.log('[OracleAI] Initializing...');
    
    for (const [id, agent] of this.agents) {
      try {
        await agent.init();
      } catch (err) {
        console.error(`[OracleAI] Failed to initialize ${id}:`, err.message);
      }
    }

    this.ensureLogDir();
    console.log('[OracleAI] Ready');
  }

  /**
   * Run all agents once
   */
  async runAll() {
    console.log('[OracleAI] Running all agents...');
    const results = {};

    for (const [id, agent] of this.agents) {
      try {
        const opportunities = await agent.run();
        results[id] = {
          agent: agent.name,
          category: agent.category,
          opportunities: opportunities.length,
          predictions: opportunities
        };
        
        console.log(`[OracleAI] ${agent.name}: ${opportunities.length} opportunities`);
        
        // Log results
        this.logResults(id, opportunities);
      } catch (err) {
        console.error(`[OracleAI] ${id} failed:`, err.message);
        results[id] = { error: err.message };
      }
    }

    return results;
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const opportunities = await agent.run();
    this.logResults(agentId, opportunities);
    
    return {
      agent: agent.name,
      category: agent.category,
      opportunities: opportunities.length,
      predictions: opportunities
    };
  }

  /**
   * Start continuous monitoring
   */
  async start() {
    if (this.running) return;
    
    console.log('[OracleAI] Starting continuous monitoring...');
    this.running = true;

    // Run immediately
    await this.runAll();

    // Schedule future runs
    this.timer = setInterval(async () => {
      await this.runAll();
    }, this.config.runInterval);
  }

  /**
   * Stop continuous monitoring
   */
  async stop() {
    console.log('[OracleAI] Stopping...');
    this.running = false;
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const [id, agent] of this.agents) {
      try {
        await agent.shutdown();
      } catch (err) {
        console.error(`[OracleAI] Error shutting down ${id}:`, err.message);
      }
    }

    console.log('[OracleAI] Stopped');
  }

  /**
   * Get status of all agents
   */
  getStatus() {
    const status = {
      running: this.running,
      agents: {}
    };

    for (const [id, agent] of this.agents) {
      status.agents[id] = agent.getStatus();
    }

    return status;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      agents: {}
    };

    for (const [id, agent] of this.agents) {
      report.agents[id] = {
        name: agent.name,
        performance: agent.state.performance,
        totalPredictions: agent.state.predictions.length,
        totalTrades: agent.state.trades.length
      };
    }

    return report;
  }

  ensureLogDir() {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  logResults(agentId, opportunities) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agentId,
      opportunityCount: opportunities.length,
      opportunities
    };

    const logPath = path.join(this.config.logDir, `${agentId}.jsonl`);
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  }
}

// Factory function for easy setup
export function createOracleAI(config = {}) {
  const oracle = new OracleAI(config);
  
  // Register default agents
  oracle.register(new CryptoOracle(config.crypto));
  oracle.register(new SportsBot(config.sports));
  oracle.register(new PoliticsAI(config.politics));
  oracle.register(new PopCulture(config.popculture));
  
  return oracle;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const oracle = createOracleAI({
    crypto: { autoExecute: false },
    sports: { autoExecute: false },
    politics: { autoExecute: false },
    popculture: { autoExecute: false }
  });

  await oracle.init();

  switch (command) {
    case 'run':
      await oracle.runAll();
      break;
    case 'crypto':
      await oracle.runAgent('crypto-oracle');
      break;
    case 'sports':
      await oracle.runAgent('sports-bot');
      break;
    case 'politics':
      await oracle.runAgent('politics-ai');
      break;
    case 'popculture':
      await oracle.runAgent('pop-culture');
      break;
    case 'status':
      console.log(JSON.stringify(oracle.getStatus(), null, 2));
      break;
    case 'report':
      console.log(JSON.stringify(oracle.getPerformanceReport(), null, 2));
      break;
    case 'daemon':
      await oracle.start();
      // Keep running
      process.on('SIGINT', async () => {
        await oracle.stop();
        process.exit(0);
      });
      break;
    default:
      console.log(`Usage: node index.js [run|crypto|sports|politics|popculture|status|report|daemon]`);
  }

  if (command !== 'daemon') {
    await oracle.stop();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default OracleAI;
