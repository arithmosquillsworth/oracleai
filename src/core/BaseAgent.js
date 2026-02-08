import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BaseAgent - Foundation for all OracleAI prediction agents
 * Implements OpenClaw skills pattern for modular capabilities
 */
export class BaseAgent {
  constructor(config = {}) {
    this.id = config.id || `${this.constructor.name}-${Date.now()}`;
    this.name = config.name || this.constructor.name;
    this.category = config.category || 'general';
    this.skills = new Map();
    this.state = {
      status: 'initializing',
      predictions: [],
      trades: [],
      performance: {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnl: 0
      },
      lastUpdate: null
    };
    this.config = {
      minConfidence: config.minConfidence || 0.65,
      maxBetSize: config.maxBetSize || 100,
      riskLevel: config.riskLevel || 'moderate',
      autoExecute: config.autoExecute || false,
      ...config
    };
    this.dataDir = path.join(__dirname, '../../data');
    this.ensureDataDir();
  }

  ensureDataDir() {
    const agentDir = path.join(this.dataDir, this.category);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
  }

  /**
   * Register a skill with this agent
   * Skills are modular capabilities following OpenClaw pattern
   */
  use(skill) {
    if (!skill.name) {
      throw new Error('Skill must have a name');
    }
    this.skills.set(skill.name, skill);
    skill.attach?.(this);
    console.log(`[${this.name}] Skill registered: ${skill.name}`);
    return this;
  }

  /**
   * Get a registered skill
   */
  skill(name) {
    return this.skills.get(name);
  }

  /**
   * Initialize the agent
   */
  async init() {
    console.log(`[${this.name}] Initializing ${this.category} agent...`);
    
    for (const [name, skill] of this.skills) {
      if (skill.init) {
        await skill.init();
      }
    }
    
    await this.loadState();
    this.state.status = 'active';
    console.log(`[${this.name}] Agent active`);
    return this;
  }

  /**
   * Main execution loop - override in subclasses
   */
  async run() {
    throw new Error('Subclasses must implement run()');
  }

  /**
   * Generate a prediction with confidence score
   */
  async predict(market) {
    throw new Error('Subclasses must implement predict()');
  }

  /**
   * Execute a trade based on prediction
   */
  async execute(prediction) {
    if (prediction.confidence < this.config.minConfidence) {
      console.log(`[${this.name}] Confidence too low (${prediction.confidence}), skipping execution`);
      return null;
    }

    const executionSkill = this.skills.get('execution');
    if (!executionSkill) {
      throw new Error('No execution skill registered');
    }

    const trade = await executionSkill.execute(prediction);
    if (trade) {
      this.state.trades.push(trade);
      await this.saveState();
    }
    return trade;
  }

  /**
   * Aggregate signals from multiple sources
   */
  async aggregateSignals(market) {
    const aggregationSkill = this.skills.get('aggregation');
    if (!aggregationSkill) {
      return { signals: [], score: 0.5 };
    }
    return await aggregationSkill.aggregate(market, this.category);
  }

  /**
   * Calculate confidence score for a prediction
   */
  calculateConfidence(prediction, signals) {
    const scoringSkill = this.skills.get('scoring');
    if (!scoringSkill) {
      return Math.min(prediction.rawConfidence || 0.5, 0.99);
    }
    return scoringSkill.calculate(prediction, signals, this.state.performance);
  }

  /**
   * Log prediction and outcome for learning
   */
  async logOutcome(prediction, actualOutcome) {
    const outcome = {
      predictionId: prediction.id,
      marketId: prediction.marketId,
      predicted: prediction.outcome,
      actual: actualOutcome,
      correct: prediction.outcome === actualOutcome,
      confidence: prediction.confidence,
      timestamp: new Date().toISOString()
    };

    this.state.performance.total++;
    if (outcome.correct) {
      this.state.performance.wins++;
    } else {
      this.state.performance.losses++;
    }
    this.state.performance.winRate = this.state.performance.wins / this.state.performance.total;

    const logPath = path.join(this.dataDir, this.category, 'outcomes.jsonl');
    fs.appendFileSync(logPath, JSON.stringify(outcome) + '\n');
    
    await this.saveState();
    return outcome;
  }

  /**
   * Save agent state to disk
   */
  async saveState() {
    const statePath = path.join(this.dataDir, this.category, 'state.json');
    this.state.lastUpdate = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Load agent state from disk
   */
  async loadState() {
    const statePath = path.join(this.dataDir, this.category, 'state.json');
    if (fs.existsSync(statePath)) {
      const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      this.state = { ...this.state, ...saved };
    }
  }

  /**
   * Get agent status report
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      status: this.state.status,
      skills: Array.from(this.skills.keys()),
      performance: this.state.performance,
      config: this.config,
      lastUpdate: this.state.lastUpdate
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log(`[${this.name}] Shutting down...`);
    this.state.status = 'inactive';
    await this.saveState();
    
    for (const [name, skill] of this.skills) {
      if (skill.destroy) {
        await skill.destroy();
      }
    }
  }
}

export default BaseAgent;
