import BaseAgent from '../../core/BaseAgent.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from '../../skills/index.js';

/**
 * CryptoOracle - Specialized agent for crypto predictions
 * Handles: ETH price, DeFi protocols, NFT floors, airdrops
 */
export class CryptoOracle extends BaseAgent {
  constructor(config = {}) {
    super({
      id: config.id || 'crypto-oracle',
      name: config.name || 'CryptoOracle',
      category: 'crypto',
      minConfidence: config.minConfidence || 0.70,
      maxBetSize: config.maxBetSize || 500,
      ...config
    });

    this.specializations = [
      'eth_price', 'defi_tvl', 'nft_floors', 'airdrops', 
      'governance', 'liquidations', 'staking_yields'
    ];
  }

  async init() {
    // Register skills
    this.use(new SignalAggregationSkill({
      sources: ['news', 'social', 'onchain'],
      weights: { news: 0.25, social: 0.25, onchain: 0.5 }
    }));

    this.use(new ConfidenceScoringSkill({
      calibrationEnabled: true,
      historyWeight: 0.35
    }));

    this.use(new ExecutionSkill({
      platform: 'polymarket',
      dryRun: this.config.autoExecute !== true,
      bankroll: this.config.bankroll
    }));

    await super.init();
    console.log('[CryptoOracle] Specialized in:', this.specializations.join(', '));
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log('[CryptoOracle] Scanning crypto markets...');

    const markets = await this.scanMarkets();
    const opportunities = [];

    for (const market of markets) {
      try {
        const prediction = await this.predict(market);
        
        if (prediction.confidence >= this.config.minConfidence) {
          opportunities.push(prediction);
          
          if (this.config.autoExecute) {
            await this.execute(prediction);
          }
        }
      } catch (err) {
        console.error(`[CryptoOracle] Error analyzing ${market.id}:`, err.message);
      }
    }

    return opportunities;
  }

  /**
   * Scan for relevant crypto markets
   */
  async scanMarkets() {
    const execution = this.skill('execution');
    const client = execution.clients.polymarket;
    
    if (!client) return [];

    const allMarkets = await client.listMarkets({
      active: true,
      limit: 100
    });

    // Filter for crypto-related markets
    const cryptoKeywords = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
      'defi', 'nft', 'airdrop', 'uniswap', 'aave', 'lido',
      'layer', 'l2', 'arbitrum', 'optimism', 'base',
      'etf', 'spot', 'futures', 'liquidation'
    ];

    return allMarkets.filter(m => {
      const text = `${m.title} ${m.description}`.toLowerCase();
      return cryptoKeywords.some(kw => text.includes(kw));
    });
  }

  /**
   * Generate prediction for a crypto market
   */
  async predict(market) {
    // Determine market type
    const marketType = this.classifyMarket(market);
    
    // Aggregate signals
    const signals = await this.aggregateSignals({ ...market, type: marketType });
    
    // Generate raw prediction based on market type
    let rawPrediction;
    switch (marketType) {
      case 'eth_price':
        rawPrediction = await this.predictETHPrice(market, signals);
        break;
      case 'defi':
        rawPrediction = await this.predictDeFi(market, signals);
        break;
      case 'nft':
        rawPrediction = await this.predictNFT(market, signals);
        break;
      case 'airdrop':
        rawPrediction = await this.predictAirdrop(market, signals);
        break;
      default:
        rawPrediction = await this.predictGeneric(market, signals);
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(rawPrediction, signals);

    return {
      id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.id,
      marketId: market.id,
      marketTitle: market.title,
      category: 'crypto',
      type: marketType,
      outcome: rawPrediction.outcome,
      confidence,
      rawConfidence: rawPrediction.rawConfidence,
      signals: signals.signals.length,
      signalScore: signals.score,
      marketPrice: market.bestPrice || market.price,
      maxPrice: rawPrediction.maxPrice,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Classify a crypto market by type
   */
  classifyMarket(market) {
    const text = `${market.title} ${market.description}`.toLowerCase();
    
    if (text.includes('eth') || text.includes('ethereum') || text.includes('price')) {
      return 'eth_price';
    }
    if (text.includes('tvl') || text.includes('defi') || text.includes('protocol')) {
      return 'defi';
    }
    if (text.includes('nft') || text.includes('floor') || text.includes('collection')) {
      return 'nft';
    }
    if (text.includes('airdrop') || text.includes('token launch')) {
      return 'airdrop';
    }
    return 'generic';
  }

  /**
   * ETH price prediction using on-chain and market signals
   */
  async predictETHPrice(market, signals) {
    // Extract relevant on-chain metrics
    const onChainSignals = signals.signals.filter(s => s.type === 'onchain');
    
    let bullishScore = 0;
    let bearishScore = 0;

    for (const signal of onChainSignals) {
      if (signal.metric === 'wallet_activity') {
        if (signal.change24h > 10) bullishScore += 0.2;
        if (signal.change24h < -10) bearishScore += 0.2;
      }
      if (signal.metric === 'volume') {
        if (signal.change24h > 20) bullishScore += 0.15;
        if (signal.change24h < -20) bearishScore += 0.15;
      }
    }

    // News sentiment
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    const avgNewsSentiment = newsSignals.reduce((sum, s) => sum + (s.sentiment || 0), 0) / 
      (newsSignals.length || 1);
    
    if (avgNewsSentiment > 0.2) bullishScore += 0.25;
    if (avgNewsSentiment < -0.2) bearishScore += 0.25;

    const outcome = bullishScore > bearishScore ? 'yes' : 'no';
    const rawConfidence = 0.5 + Math.abs(bullishScore - bearishScore);

    return {
      outcome,
      rawConfidence: Math.min(rawConfidence, 0.9),
      model: 'onchain_sentiment',
      dataQuality: onChainSignals.length > 0 ? 0.8 : 0.5
    };
  }

  /**
   * DeFi protocol prediction
   */
  async predictDeFi(market, signals) {
    const onChainSignals = signals.signals.filter(s => s.type === 'onchain');
    
    let tvlChange = 0;
    for (const signal of onChainSignals) {
      if (signal.metric === 'tvl') {
        tvlChange = signal.change24h;
      }
    }

    const outcome = tvlChange > 0 ? 'yes' : 'no';
    const rawConfidence = 0.5 + Math.min(Math.abs(tvlChange) / 100, 0.4);

    return {
      outcome,
      rawConfidence,
      model: 'tvl_momentum',
      dataQuality: 0.75
    };
  }

  /**
   * NFT floor price prediction
   */
  async predictNFT(market, signals) {
    // NFT predictions rely heavily on social sentiment and volume
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    const volumeSignal = socialSignals.find(s => s.volume !== undefined);
    
    let score = 0.5;
    if (volumeSignal) {
      score += (volumeSignal.volume / 10000) * (volumeSignal.sentiment || 0);
    }

    const outcome = score > 0.5 ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: Math.min(Math.abs(score - 0.5) * 2 + 0.5, 0.85),
      model: 'social_volume',
      dataQuality: 0.6
    };
  }

  /**
   * Airdrop timing prediction
   */
  async predictAirdrop(market, signals) {
    // Airdrops are tricky - look for on-chain activity spikes
    const onChainSignals = signals.signals.filter(s => s.type === 'onchain');
    const activitySpike = onChainSignals.some(s => 
      s.metric === 'wallet_activity' && s.change24h > 50
    );

    const outcome = activitySpike ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: activitySpike ? 0.75 : 0.55,
      model: 'activity_spike',
      dataQuality: 0.5
    };
  }

  /**
   * Generic crypto prediction
   */
  async predictGeneric(market, signals) {
    const outcome = signals.score > 0.5 ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(signals.score - 0.5),
      model: 'signal_consensus',
      dataQuality: signals.signals.length > 3 ? 0.7 : 0.5
    };
  }
}

export default CryptoOracle;
