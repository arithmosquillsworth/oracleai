/**
 * Example: Running OracleAI agents
 * 
 * This example shows how to use OracleAI programmatically
 */
import { createOracleAI, OracleAI } from './src/index.js';
import { CryptoOracle, SportsBot, PoliticsAI, PopCulture } from './src/agents/index.js';

// Example 1: Using the factory function (easiest)
async function example1() {
  console.log('=== Example 1: Factory Function ===\n');
  
  const oracle = createOracleAI({
    crypto: { 
      autoExecute: false,
      minConfidence: 0.70 
    },
    sports: { 
      leagues: ['NBA', 'NFL'],
      autoExecute: false 
    },
    politics: { autoExecute: false },
    popculture: { autoExecute: false }
  });

  await oracle.init();
  
  // Get status
  console.log('Agent Status:', JSON.stringify(oracle.getStatus(), null, 2));
  
  // Run all agents
  // const results = await oracle.runAll();
  // console.log('Results:', JSON.stringify(results, null, 2));
  
  await oracle.stop();
}

// Example 2: Manual agent registration
async function example2() {
  console.log('\n=== Example 2: Manual Registration ===\n');
  
  const oracle = new OracleAI();
  
  // Create and configure agents individually
  const cryptoOracle = new CryptoOracle({
    id: 'my-crypto-agent',
    name: 'My Crypto Oracle',
    minConfidence: 0.75,
    maxBetSize: 1000
  });
  
  const sportsBot = new SportsBot({
    leagues: ['NBA', 'NFL', 'MLB'],
    minConfidence: 0.65
  });
  
  // Register agents
  oracle.register(cryptoOracle);
  oracle.register(sportsBot);
  
  await oracle.init();
  
  console.log('Registered agents:', Array.from(oracle.agents.keys()));
  
  await oracle.stop();
}

// Example 3: Single agent usage
async function example3() {
  console.log('\n=== Example 3: Single Agent ===\n');
  
  const agent = new CryptoOracle({
    autoExecute: false,
    minConfidence: 0.70
  });
  
  // Initialize (registers default skills)
  await agent.init();
  
  console.log('Agent status:', agent.getStatus());
  
  // Mock prediction example
  const mockMarket = {
    id: 'mock-1',
    title: 'Will ETH price exceed $5000 by end of month?',
    description: 'Market resolves Yes if ETH \u003e $5000',
    price: 0.45
  };
  
  // In real usage, would scan and predict actual markets
  // const prediction = await agent.predict(mockMarket);
  // console.log('Prediction:', prediction);
  
  await agent.shutdown();
}

// Example 4: Custom prediction flow
async function example4() {
  console.log('\n=== Example 4: Custom Flow ===\n');
  
  const agent = new PoliticsAI({
    autoExecute: false,
    minConfidence: 0.75
  });
  
  await agent.init();
  
  // Manually aggregate signals
  const signals = await agent.aggregateSignals({
    id: 'election-2024',
    title: 'Will Candidate X win?',
    type: 'election'
  });
  
  console.log('Aggregated signals:', {
    signalCount: signals.signals.length,
    score: signals.score
  });
  
  await agent.shutdown();
}

// Run examples
async function main() {
  try {
    await example1();
    await example2();
    await example3();
    await example4();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
