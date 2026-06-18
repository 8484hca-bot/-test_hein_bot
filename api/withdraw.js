export default async function handler(req, res) {
    // CORS header ထည့်ပါ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end(); // preflight အတွက်
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    try {
        const { userId, amount, address, memo } = req.body;
        // ဒီနေရာမှာ သင့်ရဲ့ withdraw logic (TON လွှဲတာ စသည်) ရေးပါ
        // နမူနာအနေနဲ့ success ပြန်ပေးထားပါတယ်
        res.status(200).json({ success: true, message: `Withdrawal ${amount} TON to ${address} requested` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
