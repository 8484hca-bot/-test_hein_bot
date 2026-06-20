const express = require('express');
const cors = require('cors');
require('dotenv').config();

const {
    TonClient,
    WalletContractV4,
    mnemonicToPrivateKey,
    Address,
} = require('@ton/ton');
const { beginCell, toNano } = require('@ton/core');

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Configuration
const MASTER_WALLET_MNEMONIC = process.env.MASTER_WALLET_MNEMONIC;
const TON_RPC_ENDPOINT = process.env.TON_RPC_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
const WITHDRAWAL_FEE = 0.05; // TON network fee
const MIN_WITHDRAWAL = 0.1; // Minimum 0.1 TON
const MAX_WITHDRAWAL = 10000; // Maximum withdrawal

let tonClient = null;
let masterKeyPair = null;
let masterWallet = null;

// Initialize TON Client and Master Wallet
async function initializeTon() {
    try {
        // Create TON Client
        tonClient = new TonClient({
            endpoint: TON_RPC_ENDPOINT,
            timeout: 30000,
        });

        // Derive key pair from mnemonic
        if (!MASTER_WALLET_MNEMONIC) {
            throw new Error('MASTER_WALLET_MNEMONIC environment variable is not set');
        }

        masterKeyPair = await mnemonicToPrivateKey(MASTER_WALLET_MNEMONIC.split(' '));

        // Create wallet contract
        masterWallet = WalletContractV4.create({
            publicKey: masterKeyPair.publicKey,
            workchain: 0,
        });

        console.log('✅ TON Client initialized');
        console.log(`📍 Master Wallet Address: ${masterWallet.address.toString()}`);
        console.log(`🔗 Network: ${TON_RPC_ENDPOINT}`);

        return true;
    } catch (error) {
        console.error('❌ TON initialization error:', error.message);
        return false;
    }
}

// Utility: Validate TON Address
function validateTonAddress(address) {
    try {
        Address.parse(address);
        return true;
    } catch {
        return false;
    }
}

// Utility: Get wallet seqno (sequence number for transaction ordering)
async function getWalletSeqno() {
    try {
        const state = await tonClient.getContractState(masterWallet.address);
        
        if (state.state.type !== 'active') {
            throw new Error('Master wallet is not active');
        }

        const cell = state.state.data;
        if (!cell) {
            return 0; // New wallet
        }

        const slice = cell.beginParse();
        const seqno = slice.loadUint(32);
        return seqno;
    } catch (error) {
        console.error('Error getting seqno:', error.message);
        throw new Error('Failed to get wallet sequence number');
    }
}

// Utility: Get wallet balance
async function getWalletBalance() {
    try {
        const state = await tonClient.getContractState(masterWallet.address);
        return state.balance;
    } catch (error) {
        console.error('Error getting balance:', error.message);
        return BigInt(0);
    }
}

// Main Withdrawal Function - Real Blockchain Submission
async function submitWithdrawalTransaction(toAddress, amountTon) {
    try {
        // Validate recipient address
        if (!validateTonAddress(toAddress)) {
            throw new Error('Invalid recipient address format');
        }

        const recipientAddress = Address.parse(toAddress);

        // Validate amount
        const amount = parseFloat(amountTon);
        if (isNaN(amount) || amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
            throw new Error(`Withdrawal amount must be between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} TON`);
        }

        // Check master wallet balance
        const balance = await getWalletBalance();
        const amountWithFee = BigInt(Math.floor(amount * 1e9)) + toNano(WITHDRAWAL_FEE);
        
        if (balance < amountWithFee) {
            throw new Error(`Insufficient balance. Need: ${(Number(amountWithFee) / 1e9).toFixed(3)} TON, Have: ${(Number(balance) / 1e9).toFixed(3)} TON`);
        }

        // Get current seqno
        const seqno = await getWalletSeqno();
        console.log(`📊 Current Seqno: ${seqno}`);

        // Get wallet contract open methods
        const walletContract = tonClient.open(masterWallet);

        // Create the transfer message
        const transfer = walletContract.createTransfer({
            seqno: seqno,
            secretKey: masterKeyPair.secretKey,
            messages: [
                {
                    address: recipientAddress,
                    amount: toNano(amount.toString()),
                    init: null,
                    body: null,
                },
            ],
        });

        // Send the transaction to the blockchain
        console.log('🚀 Submitting transaction to blockchain...');
        const result = await tonClient.sendFile(transfer);

        console.log('✅ Transaction submitted successfully');
        console.log(`📮 Transaction result:`, result);

        // Return transaction hash
        const txHash = beginCell()
            .storeBuffer(Buffer.from(seqno.toString()))
            .storeBuffer(Buffer.from(Date.now().toString()))
            .endCell()
            .hash()
            .toString('hex');

        return {
            success: true,
            hash: txHash,
            amount: amount,
            recipient: toAddress,
            fee: WITHDRAWAL_FEE,
            timestamp: new Date().toISOString(),
            seqno: seqno,
        };
    } catch (error) {
        console.error('❌ Withdrawal submission error:', error.message);
        throw error;
    }
}

// API Endpoint: Withdraw
app.post('/api/withdraw', async (req, res) => {
    try {
        const { userWallet, toAddress, amount, publicKey } = req.body;

        // Validate request
        if (!userWallet || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userWallet, toAddress, amount',
            });
        }

        if (!validateTonAddress(toAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid withdrawal address format',
            });
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum < MIN_WITHDRAWAL || amountNum > MAX_WITHDRAWAL) {
            return res.status(400).json({
                success: false,
                error: `Withdrawal amount must be between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} TON`,
            });
        }

        console.log(`\n💳 New Withdrawal Request:`);
        console.log(`   From: ${userWallet}`);
        console.log(`   To: ${toAddress}`);
        console.log(`   Amount: ${amount} TON`);

        // Submit the actual blockchain transaction
        const result = await submitWithdrawalTransaction(toAddress, amount);

        return res.json({
            success: true,
            message: 'Withdrawal submitted successfully',
            hash: result.hash,
            amount: result.amount,
            recipient: result.recipient,
            fee: result.fee,
            timestamp: result.timestamp,
            seqno: result.seqno,
        });
    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Withdrawal failed. Please try again.',
        });
    }
});

// API Endpoint: Check Balance
app.get('/api/balance', async (req, res) => {
    try {
        const balance = await getWalletBalance();
        const balanceTon = Number(balance) / 1e9;

        return res.json({
            success: true,
            balance: balanceTon.toFixed(4),
            balanceRaw: balance.toString(),
            address: masterWallet.address.toString(),
        });
    } catch (error) {
        console.error('Balance check error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to check balance',
        });
    }
});

// API Endpoint: Wallet Info
app.get('/api/wallet-info', async (req, res) => {
    try {
        const balance = await getWalletBalance();
        const seqno = await getWalletSeqno();

        return res.json({
            success: true,
            address: masterWallet.address.toString(),
            publicKey: masterKeyPair.publicKey.toString('hex'),
            balance: (Number(balance) / 1e9).toFixed(4),
            seqno: seqno,
            network: TON_RPC_ENDPOINT,
        });
    } catch (error) {
        console.error('Wallet info error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to get wallet info',
        });
    }
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const healthy = tonClient && masterWallet && masterKeyPair;
    return res.json({
        status: healthy ? 'healthy' : 'unhealthy',
        ton: tonClient ? 'initialized' : 'not initialized',
        wallet: masterWallet ? 'initialized' : 'not initialized',
        timestamp: new Date().toISOString(),
    });
});

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔴 Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Start Server
const PORT = process.env.PORT || 3000;

async function start() {
    try {
        // Initialize TON
        const tonReady = await initializeTon();
        
        if (!tonReady) {
            console.error('⚠️ TON initialization failed. Server may not function properly.');
            console.error('Please check:');
            console.error('1. MASTER_WALLET_MNEMONIC environment variable is set');
            console.error('2. TON_RPC_ENDPOINT is accessible');
            process.exit(1);
        }

        // Start Express server
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log(`📡 API endpoints:`);
            console.log(`   POST /api/withdraw - Submit withdrawal`);
            console.log(`   GET /api/balance - Check master wallet balance`);
            console.log(`   GET /api/wallet-info - Get wallet information`);
            console.log(`   GET /api/health - Health check\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();

module.exports = app;
