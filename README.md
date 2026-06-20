# TON Blockchain Withdrawal System - Telegram Mini App

A production-ready withdrawal system for TON blockchain integrated with Telegram Mini App. Users can connect their wallet via TON Connect and submit withdrawal requests that trigger real blockchain transactions.

## 🎯 Features

- **TON Connect Integration**: Connect wallets (Tonkeeper, Telegram Wallet, MetaMask)
- **Real Blockchain Transactions**: Actual TON transfers using WalletContractV4
- **Secure Wallet Management**: Master wallet using environment variables (seed phrase)
- **Validation & Error Handling**: Input validation and comprehensive error messages
- **Responsive UI**: Mobile-first design optimized for Telegram Mini App
- **Production Ready**: Full Express.js backend with proper error handling
- **API Endpoints**: RESTful API for withdrawals and wallet info

## 📋 Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **TON Wallet** with seed phrase (24 words)
- **TON Balance** for sending withdrawals

## 🚀 Installation & Setup

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Create `.env` File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
MASTER_WALLET_MNEMONIC=your 24 word seed phrase here
TON_RPC_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
PORT=3000
NODE_ENV=production
```

⚠️ **IMPORTANT**: Never commit `.env` file! Keep your seed phrase secret.

### 3. Update Domain in Files

Replace `https://vercel.app` with your actual domain in:
- `tonconnect-manifest.json` (url field)
- `index.html` (TonConnectUI manifestUrl)

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will run on `http://localhost:3000`

## 📡 API Endpoints

### POST /api/withdraw
Submit a withdrawal request and execute blockchain transaction.

**Request:**
```json
{
  "userWallet": "UQA...",
  "toAddress": "UQA...",
  "amount": "0.5",
  "publicKey": "hex_string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Withdrawal submitted successfully",
  "hash": "transaction_hash",
  "amount": 0.5,
  "recipient": "UQA...",
  "fee": 0.05,
  "timestamp": "2024-01-15T10:30:00Z",
  "seqno": 42
}
```

### GET /api/balance
Check master wallet balance.

**Response:**
```json
{
  "success": true,
  "balance": "5.2500",
  "balanceRaw": "5250000000",
  "address": "UQA..."
}
```

### GET /api/wallet-info
Get master wallet information.

**Response:**
```json
{
  "success": true,
  "address": "UQA...",
  "publicKey": "hex_string",
  "balance": "5.2500",
  "seqno": 42,
  "network": "https://toncenter.com/api/v2/jsonRPC"
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "ton": "initialized",
  "wallet": "initialized",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔧 Blockchain Transaction Flow

1. **User connects wallet** via TON Connect UI
2. **User enters recipient address** and amount
3. **Frontend validates** address format and amount range
4. **Backend receives request** and validates inputs
5. **Master wallet seqno retrieved** for transaction ordering
6. **WalletContractV4 creates transfer message** with proper formatting
7. **Transaction signed** with master wallet private key
8. **Transaction submitted** to TON blockchain via RPC
9. **Response returned** with transaction hash
10. **Frontend displays** confirmation with transaction details

## 🔐 Security Considerations

- **Seed Phrase Protection**: Store `MASTER_WALLET_MNEMONIC` in secure environment variables only
- **CORS**: Configured to allow requests from your domain
- **Input Validation**: All addresses and amounts validated before processing
- **Rate Limiting**: Consider adding rate limiting for production
- **HTTPS Only**: Always use HTTPS in production (Vercel provides this)
- **Environment Isolation**: Never expose master wallet data to frontend

## 📱 Telegram Mini App Integration

To use as a Telegram Mini App:

1. Create a Telegram Bot via @BotFather
2. Set Web App URL to your deployment domain
3. Deploy to Vercel or your hosting provider
4. Users open the app through Telegram

```javascript
// In Telegram Mini App context:
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();
```

## 🚀 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `MASTER_WALLET_MNEMONIC`
   - `TON_RPC_ENDPOINT` (optional)
   - `NODE_ENV=production`
4. Deploy

### Configuration for Vercel

The project works as-is on Vercel. No additional configuration needed for serverless.

## 📊 Withdrawal Limits

- **Minimum**: 0.1 TON (≈ 0.1 USDT)
- **Maximum**: 10,000 TON
- **Network Fee**: ~0.05 TON (deducted from withdrawal)

## 🐛 Troubleshooting

### Error: "MASTER_WALLET_MNEMONIC environment variable is not set"
- Add your seed phrase to `.env` file
- Restart the server

### Error: "Invalid recipient address format"
- Recipient address must be valid TON address (starts with UQ or EQ)
- Check address format

### Error: "Insufficient balance"
- Master wallet doesn't have enough TON
- Send TON to master wallet address

### Error: "Failed to get wallet sequence number"
- Master wallet not initialized or doesn't exist
- Deploy the master wallet first (send 1 TON to it)

## 📚 Dependencies

- **express**: Web framework
- **cors**: Cross-Origin Resource Sharing
- **dotenv**: Environment variable management
- **@ton/ton**: TON blockchain SDK
- **@ton/crypto**: Cryptographic functions
- **@ton/core**: Core blockchain types
- **tonconnect-sdk**: Wallet connection

## 📝 API Examples

### cURL Example - Withdraw 0.5 TON

```bash
curl -X POST http://localhost:3000/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "userWallet": "UQA...",
    "toAddress": "UQAB...",
    "amount": "0.5",
    "publicKey": "..."
  }'
```

### Check Balance

```bash
curl http://localhost:3000/api/balance
```

## 🔄 Real Blockchain Transactions

This system submits **actual transactions** to the TON blockchain. Key features:

- Uses real `WalletContractV4` contract (standard TON wallet)
- Implements proper seqno handling for transaction ordering
- Includes real network fee deduction
- Returns actual transaction hash
- Validates wallet state and balance before submission

## 📄 License

MIT

## 🤝 Support

For issues and questions, please check:
1. Error messages in console
2. Blockchain RPC endpoint status
3. Master wallet balance and status
4. Environment variables configuration

---

**Happy withdrawing! 🎉**
