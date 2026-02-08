/**
 * ExecutionSkill - Handles trade execution on prediction markets
 * Supports Polymarket and Kalshi APIs
 */
export class ExecutionSkill {
  constructor(config = {}) {
    this.name = 'execution';
    this.config = {
      platform: config.platform || 'polymarket', // 'polymarket' | 'kalshi' | 'both'
      maxSlippage: config.maxSlippage || 0.02,
      retryAttempts: config.retryAttempts || 3,
      dryRun: config.dryRun || true, // Safety: default to dry run
      ...config
    };
    this.agent = null;
    this.clients = {};
  }

  attach(agent) {
    this.agent = agent;
  }

  async init() {
    console.log(`[Execution] Initialized for ${this.config.platform}`);
    
    // Initialize API clients
    if (this.config.platform === 'polymarket' || this.config.platform === 'both') {
      this.clients.polymarket = new PolymarketClient(this.config.polymarket);
    }
    if (this.config.platform === 'kalshi' || this.config.platform === 'both') {
      this.clients.kalshi = new KalshiClient(this.config.kalshi);
    }
  }

  /**
   * Execute a trade based on prediction
   */
  async execute(prediction) {
    const platform = this.selectPlatform(prediction);
    const client = this.clients[platform];

    if (!client) {
      throw new Error(`No client configured for ${platform}`);
    }

    const size = this.calculatePositionSize(prediction);
    
    if (this.config.dryRun) {
      console.log(`[Execution] DRY RUN: Would execute ${size} on ${platform}`);
      return this.createDryRunTrade(prediction, platform, size);
    }

    try {
      const trade = await client.placeOrder({
        marketId: prediction.marketId,
        outcome: prediction.outcome,
        size: size,
        maxPrice: prediction.maxPrice || 0.95,
        minPrice: prediction.minPrice || 0.05
      });

      console.log(`[Execution] Trade executed: ${trade.id}`);
      return {
        id: trade.id,
        platform,
        predictionId: prediction.id,
        marketId: prediction.marketId,
        outcome: prediction.outcome,
        size,
        price: trade.price,
        timestamp: new Date().toISOString(),
        status: 'executed'
      };
    } catch (err) {
      console.error(`[Execution] Trade failed:`, err);
      return {
        predictionId: prediction.id,
        platform,
        outcome: prediction.outcome,
        size,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: err.message
      };
    }
  }

  /**
   * Select best platform for a prediction
   */
  selectPlatform(prediction) {
    if (this.config.platform !== 'both') {
      return this.config.platform;
    }

    // Prefer Polymarket for crypto, Kalshi for regulated markets
    if (prediction.category === 'crypto') {
      return 'polymarket';
    }
    if (prediction.category === 'politics' || prediction.category === 'sports') {
      return 'kalshi';
    }

    // Default to Polymarket
    return 'polymarket';
  }

  /**
   * Calculate position size based on confidence and bankroll
   */
  calculatePositionSize(prediction) {
    const kellyFraction = 0.25; // Conservative Kelly criterion
    const bankroll = this.config.bankroll || 1000;
    
    // Kelly formula: f = (bp - q) / b
    // where b = odds, p = probability of win, q = probability of loss
    const p = prediction.confidence;
    const q = 1 - p;
    const b = (1 / (prediction.marketPrice || 0.5)) - 1;
    
    let kelly = (b * p - q) / b;
    kelly = Math.max(0, Math.min(kelly, 0.5)); // Cap at 50%

    const size = bankroll * kelly * kellyFraction;
    
    // Cap at max bet size
    return Math.min(size, this.agent?.config?.maxBetSize || 100);
  }

  /**
   * Get current positions
   */
  async getPositions() {
    const positions = {};
    
    for (const [platform, client] of Object.entries(this.clients)) {
      try {
        positions[platform] = await client.getPositions();
      } catch (err) {
        console.warn(`[Execution] Failed to get ${platform} positions:`, err.message);
        positions[platform] = [];
      }
    }

    return positions;
  }

  /**
   * Close a position
   */
  async closePosition(positionId, platform) {
    const client = this.clients[platform];
    if (!client) {
      throw new Error(`No client for ${platform}`);
    }

    if (this.config.dryRun) {
      console.log(`[Execution] DRY RUN: Would close position ${positionId}`);
      return { status: 'dry_run', positionId };
    }

    return await client.closePosition(positionId);
  }

  createDryRunTrade(prediction, platform, size) {
    return {
      id: `dry-${Date.now()}`,
      platform,
      predictionId: prediction.id,
      marketId: prediction.marketId,
      outcome: prediction.outcome,
      size,
      price: prediction.marketPrice || 0.5,
      timestamp: new Date().toISOString(),
      status: 'dry_run'
    };
  }
}

/**
 * Polymarket API Client
 */
class PolymarketClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.POLYMARKET_API_KEY;
    this.apiSecret = config.apiSecret || process.env.POLYMARKET_API_SECRET;
    this.baseUrl = config.baseUrl || 'https://api.polymarket.com';
    this.rpcUrl = config.rpcUrl || 'https://rpc.ankr.com/polygon';
  }

  async placeOrder(order) {
    // TODO: Implement actual Polymarket API integration
    // This requires ethers.js for Polygon interactions
    console.log('[Polymarket] Placing order:', order);
    
    // Mock response
    return {
      id: `poly-${Date.now()}`,
      price: order.maxPrice,
      status: 'filled'
    };
  }

  async getPositions() {
    // TODO: Implement
    return [];
  }

  async closePosition(positionId) {
    // TODO: Implement
    return { status: 'closed', positionId };
  }

  async getMarket(marketId) {
    const response = await fetch(`${this.baseUrl}/markets/${marketId}`);
    return await response.json();
  }

  async listMarkets(filter = {}) {
    const params = new URLSearchParams(filter);
    const response = await fetch(`${this.baseUrl}/markets?${params}`);
    return await response.json();
  }
}

/**
 * Kalshi API Client
 */
class KalshiClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.KALSHI_API_KEY;
    this.baseUrl = config.baseUrl || 'https://trading-api.kalshi.com/v1';
  }

  async placeOrder(order) {
    // TODO: Implement actual Kalshi API integration
    console.log('[Kalshi] Placing order:', order);

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        market_id: order.marketId,
        side: order.outcome === 'yes' ? 'buy' : 'sell',
        count: Math.floor(order.size),
        price: Math.floor(order.maxPrice * 100) // Kalshi uses cents
      })
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    return await response.json();
  }

  async getPositions() {
    const response = await fetch(`${this.baseUrl}/positions`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return await response.json();
  }

  async closePosition(positionId) {
    // Kalshi doesn't have direct position closing, need to place opposite order
    console.log('[Kalshi] Close position by placing opposite order:', positionId);
    return { status: 'closed', positionId };
  }

  async getMarket(marketId) {
    const response = await fetch(`${this.baseUrl}/markets/${marketId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return await response.json();
  }

  async listMarkets(filter = {}) {
    const params = new URLSearchParams(filter);
    const response = await fetch(`${this.baseUrl}/markets?${params}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return await response.json();
  }
}

export default ExecutionSkill;
