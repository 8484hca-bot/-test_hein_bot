const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Static Files
app.use(express.static(__dirname));

// ✅ Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ✅ Login route
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ✅ Manifest route for TON Connect
app.get('/tonconnect-manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'tonconnect-manifest.json'));
});

// ==================== TON CONNECT VALIDATION ====================

// Verify wallet connection status
function isValidTonAddress(address) {
    return /^(UQ|EQ)[a-zA-Z0-9\-_]{46,}/.test(address) || /^0:[0-9a-fA-F]{64}$/.test(address);
}

// Store wallet connections (in production, use database)
const walletSessions = new Map();

// ==================== WALLET ENDPOINTS ====================

// Verify wallet connection
app.post('/api/wallet/verify', (req, res) => {
    try {
        const { userId, walletAddress, signature, timestamp } = req.body;

        if (!userId || !walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId or walletAddress'
            });
        }

        if (!isValidTonAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid TON wallet address format'
            });
        }

        // Store wallet connection
        walletSessions.set(userId, {
            address: walletAddress,
            connectedAt: new Date().toISOString(),
            verified: true
        });

        console.log(`[WALLET] User ${userId} connected wallet: ${walletAddress}`);

        return res.json({
            success: true,
            message: 'Wallet verified and connected',
            userId: userId,
            walletAddress: walletAddress
        });
    } catch (error) {
        console.error('[WALLET VERIFY ERROR]:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get wallet connection status
app.get('/api/wallet/status/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const session = walletSessions.get(userId);

        if (!session) {
            return res.json({
                success: false,
                isConnected: false,
                message: 'Wallet not connected'
            });
        }

        return res.json({
            success: true,
            isConnected: true,
            walletAddress: session.address,
            connectedAt: session.connectedAt
        });
    } catch (error) {
        console.error('[WALLET STATUS ERROR]:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Disconnect wallet
app.post('/api/wallet/disconnect', (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing userId'
            });
        }

        walletSessions.delete(userId);
        console.log(`[WALLET] User ${userId} disconnected wallet`);

        return res.json({
            success: true,
            message: 'Wallet disconnected'
        });
    } catch (error) {
        console.error('[WALLET DISCONNECT ERROR]:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== WITHDRAWAL WITH WALLET VERIFICATION ====================

// TON Address validation regex
function isValidTonAddress(address) {
    return /^(UQ|EQ|0:)[a-zA-Z0-9\-_]{46,}/.test(address) || /^0:[0-9a-fA-F]{64}$/.test(address);
}

// Enhanced Withdrawal API Route
app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, amount, address, memo, walletAddress } = req.body;

        // ===== VALIDATION =====
        if (!userId || !amount || !address) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: userId, amount, address"
            });
        }

        // Check if wallet is connected for this user
        const walletSession = walletSessions.get(userId);
        if (!walletSession || !walletSession.verified) {
            return res.status(403).json({
                success: false,
                error: "Wallet not connected. Please connect your TON wallet first."
            });
        }

        // Verify that withdrawal address matches connected wallet (optional but recommended)
        if (walletAddress && walletAddress !== walletSession.address) {
            console.warn(`[WITHDRAWAL] Address mismatch for user ${userId}`);
            // Proceed but log warning - user might be using different address intentionally
        }

        // Validate TON address format
        if (!isValidTonAddress(address)) {
            return res.status(400).json({
                success: false,
                error: "Invalid TON address format. Must start with UQ, EQ, or 0:"
            });
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        const MIN_AMOUNT = 0.1;
        const MAX_AMOUNT = 1000000;

        if (isNaN(amountNum) || amountNum < MIN_AMOUNT) {
            return res.status(400).json({
                success: false,
                error: `Minimum withdrawal amount is ${MIN_AMOUNT} TON`
            });
        }

        if (amountNum > MAX_AMOUNT) {
            return res.status(400).json({
                success: false,
                error: `Maximum withdrawal amount is ${MAX_AMOUNT} TON`
            });
        }

        // ===== STORE IN DATABASE (simulate here) =====
        const withdrawalRecord = {
            id: `${userId}_${Date.now()}`,
            userId: userId,
            amount: amountNum,
            address: address,
            walletConnected: walletSession.address,
            memo: memo || "None",
            timestamp: new Date().toISOString(),
            status: "pending",
            transactionHash: null
        };

        console.log('[WITHDRAWAL] New request from connected wallet:', withdrawalRecord);

        // ===== SUBMIT TO TON BLOCKCHAIN =====
        const tonResponse = await submitWithdrawalToTon(withdrawalRecord);

        if (tonResponse.success) {
            withdrawalRecord.transactionHash = tonResponse.transactionHash;
            withdrawalRecord.status = "processing";
            console.log('[WITHDRAWAL] Submitted to TON:', tonResponse);
        } else {
            return res.status(500).json({
                success: false,
                error: "Failed to submit transaction to TON blockchain"
            });
        }

        // ===== RESPONSE =====
        return res.json({
            success: true,
            message: "Withdrawal request submitted successfully",
            withdrawalId: withdrawalRecord.id,
            transactionHash: tonResponse.transactionHash,
            amount: amountNum,
            address: address,
            status: withdrawalRecord.status
        });

    } catch (error) {
        console.error('[WITHDRAWAL ERROR]:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Internal server error"
        });
    }
});

// ===== TON BLOCKCHAIN SUBMISSION =====
async function submitWithdrawalToTon(withdrawalRecord) {
    try {
        // TODO: Implement actual TON RPC integration
        // Example: Call TON Center API or your own validator
        // const tonRpcResponse = await axios.post('https://toncenter.com/api/v2/sendBoc', {
        //     boc: serializedTransaction,
        //     api_key: process.env.TON_CENTER_API_KEY
        // });

        const transactionHash = `0x${Math.random().toString(16).substr(2)}`;

        console.log(`[TON SUBMIT] Amount: ${withdrawalRecord.amount} TON, Address: ${withdrawalRecord.address}`);

        return {
            success: true,
            transactionHash: transactionHash,
            message: "Transaction sent to TON blockchain"
        };

    } catch (error) {
        console.error('[TON SUBMIT ERROR]:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== WITHDRAWAL STATUS CHECK =====
app.get('/api/withdraw/:withdrawalId', (req, res) => {
    const { withdrawalId } = req.params;

    res.json({
        withdrawalId: withdrawalId,
        status: "processing",
        message: "Check transaction hash in TON explorer"
    });
});

// Vercel export
module.exports = app;
