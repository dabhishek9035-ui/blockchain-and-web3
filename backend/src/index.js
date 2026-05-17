import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { connectDatabase } from './config/db.js';
import { startMarketplaceListener } from './listeners/marketplaceListener.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'xirec-backend' });
});

async function start() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDatabase(process.env.MONGODB_URI);
      console.log('MongoDB connected');
    }
  } catch (error) {
    console.warn('MongoDB connection skipped:', error.message);
  }

  if (process.env.DISABLE_CHAIN_LISTENER === 'true') {
    console.log('Marketplace listener disabled by DISABLE_CHAIN_LISTENER');
  } else {
    const listener = startMarketplaceListener({
      rpcUrl: process.env.RPC_URL,
      marketplaceAddress: process.env.NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS || process.env.VOUCHER_ESCROW_ADDRESS,
      tokenAddress: process.env.NEXT_PUBLIC_XIREC_TOKEN_ADDRESS || process.env.XIREC_TOKEN_ADDRESS,
      reputationAddress: process.env.NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS || process.env.REPUTATION_MANAGER_ADDRESS,
      rewardDistributorAddress: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || process.env.REWARD_DISTRIBUTOR_ADDRESS
    });

    if (listener.started) {
      console.log('Marketplace listener started');
    } else {
      console.log(`Marketplace listener not started: ${listener.reason}`);
    }
  }

  app.listen(port, () => {
    console.log(`Xirec backend listening on http://localhost:${port}`);
  });
}

start();
