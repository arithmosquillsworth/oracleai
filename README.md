# OracleAI 🔮

Specialized prediction market agents by category. Domain experts that never sleep.

## The Vision

One agent can't know everything. OracleAI creates specialized oracles for specific domains, each with deep expertise in their category.

## Architecture

```
OracleAI/
├── src/
│   ├── core/
│   │   └── BaseAgent.js           # Foundation agent class
│   ├── skills/
│   │   ├── SignalAggregationSkill.js  # Multi-source data aggregation
│   │   ├── ConfidenceScoringSkill.js  # Prediction confidence calculation
│   │   └── ExecutionSkill.js          # Polymarket/Kalshi integration
│   ├── agents/
│   │   ├── crypto-oracle/         # ETH, DeFi, NFT predictions
│   │   ├── sports-bot/            # Game outcomes, player props
│   │   ├── politics-ai/           # Elections, policy outcomes
│   │   └── pop-culture/           # Awards, trending topics
│   └── index.js                   # Main orchestrator
├── data/                          # Agent state and logs
└── config/                        # Configuration files
```

## Specialized Agents

### CryptoOracle 🪙
- **Domain:** ETH price movements, DeFi protocol outcomes, NFT floor predictions, airdrop timing
- **Data Sources:** On-chain metrics (The Graph), news feeds, social sentiment
- **Signal Weights:** News 25%, Social 25%, On-chain 50%
- **Min Confidence:** 70%

### SportsBot 🏈
- **Domain:** Game outcomes, player props, tournament brackets, injury impact
- **Data Sources:** Sports news, injury reports, social buzz
- **Signal Weights:** News 60%, Social 40%
- **Min Confidence:** 65%

### PoliticsAI 🏛️
- **Domain:** Election outcomes, policy decisions, regulatory actions
- **Data Sources:** Political news, polling data, social sentiment
- **Signal Weights:** News 70%, Social 30%
- **Min Confidence:** 75%

### PopCulture 🎬
- **Domain:** Oscar winners, Grammy outcomes, trending topics, viral predictions
- **Data Sources:** Social media (heavy weight), entertainment news
- **Signal Weights:** News 30%, Social 70%
- **Min Confidence:** 60%

## Features

### Signal Aggregation
Each agent aggregates signals from multiple sources:
- **News:** RSS feeds, news APIs, press releases
- **Social:** Twitter/X sentiment, trending topics, volume
- **On-chain:** Wallet activity, TVL, transaction volume (CryptoOracle only)

### Confidence Scoring
Multi-factor confidence calculation:
- **Base Confidence:** Model quality, data availability
- **Signal Confidence:** Consensus across sources, diversity
- **Historical Performance:** Agent's track record, calibration

Formula:
```
Confidence = (base × 0.3) + (signal × 0.4) + (history × 0.3)
```

### Automated Execution
- **Polymarket:** Crypto markets, international events
- **Kalshi:** Sports, politics, regulated US markets
- **Risk Management:** Kelly criterion position sizing, max bet limits

## Quick Start

```bash
# Clone and install
git clone https://github.com/arithmosquillsworth/oracleai.git
cd oracleai
npm install

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run single agent
npm run crypto
npm run sports
npm run politics
npm run popculture

# Run all agents
npm start

# Start monitoring daemon
node src/index.js daemon
```

## API Usage

```javascript
import { createOracleAI } from './src/index.js';

const oracle = createOracleAI({
  crypto: { autoExecute: false, minConfidence: 0.75 },
  sports: { leagues: ['NBA', 'NFL'] },
  politics: { autoExecute: false },
  popculture: { autoExecute: false }
});

await oracle.init();

// Run all agents
const results = await oracle.runAll();

// Run specific agent
const cryptoResults = await oracle.runAgent('crypto-oracle');

// Get status
console.log(oracle.getStatus());

// Get performance report
console.log(oracle.getPerformanceReport());
```

## Individual Agent Usage

```javascript
import { CryptoOracle } from './src/agents/index.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from './src/skills/index.js';

const agent = new CryptoOracle({
  autoExecute: false,
  minConfidence: 0.70
});

// Register skills
agent.use(new SignalAggregationSkill());
agent.use(new ConfidenceScoringSkill());
agent.use(new ExecutionSkill({ platform: 'polymarket' }));

await agent.init();

// Run once
const opportunities = await agent.run();

// Log outcome for learning
await agent.logOutcome(prediction, actualOutcome);
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POLYMARKET_API_KEY` | Polymarket API key | - |
| `KALSHI_API_KEY` | Kalshi API key | - |
| `DRY_RUN` | Run without executing trades | `true` |
| `MAX_BET_SIZE_USD` | Maximum bet per trade | `100` |
| `BANKROLL_USD` | Total trading bankroll | `1000` |
| `RUN_INTERVAL_MINUTES` | Daemon check interval | `60` |

### Agent Config

Each agent accepts configuration:

```javascript
{
  minConfidence: 0.70,    // Minimum confidence to trade
  maxBetSize: 500,        // Max position size in USD
  riskLevel: 'moderate',  // conservative | moderate | aggressive
  autoExecute: false,     // Execute trades automatically
  bankroll: 10000         // Trading bankroll
}
```

## Data Storage

Agent state and logs stored in `data/`:

```
data/
├── crypto/
│   ├── state.json        # Agent state
│   └── outcomes.jsonl    # Historical outcomes
├── sports/
├── politics/
├── popculture/
└── logs/
    ├── crypto-oracle.jsonl
    ├── sports-bot.jsonl
    └── ...
```

## Extending OracleAI

### Create a New Agent

```javascript
import BaseAgent from '../core/BaseAgent.js';

export class MyAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'my-agent',
      name: 'MyAgent',
      category: 'custom',
      ...config
    });
  }

  async predict(market) {
    // Your prediction logic
    return {
      id: '...',
      outcome: 'yes',
      confidence: 0.75
    };
  }

  async run() {
    // Scan markets and predict
    const markets = await this.scanMarkets();
    // ...
  }
}
```

### Create a New Skill

```javascript
export class MySkill {
  constructor(config) {
    this.name = 'my-skill';
    this.config = config;
  }

  attach(agent) {
    this.agent = agent;
  }

  async init() {
    // Initialize
  }

  async myMethod() {
    // Skill logic
  }
}
```

## Monitoring

### Status Check
```bash
node src/index.js status
```

### Performance Report
```bash
node src/index.js report
```

### Logs
```bash
# View agent logs
tail -f data/logs/crypto-oracle.jsonl

# View outcomes
tail -f data/crypto/outcomes.jsonl
```

## Safety Features

- **Dry Run Mode:** Default - no real trades executed
- **Confidence Thresholds:** Each agent has minimum confidence requirements
- **Position Sizing:** Kelly criterion with conservative fraction (25%)
- **Max Bet Limits:** Hard caps per agent and global
- **API Key Security:** Keys in `.env`, never committed

## Roadmap

- [x] Base agent architecture
- [x] Four specialized agents
- [x] Signal aggregation system
- [x] Confidence scoring algorithm
- [x] Polymarket/Kalshi integration
- [ ] LLM integration for reasoning
- [ ] Advanced on-chain analytics
- [ ] Social media streaming
- [ ] Web dashboard
- [ ] Performance analytics UI

## License

MIT
