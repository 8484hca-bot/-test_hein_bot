const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// စမ်းသပ်ရန်အတွက် ယာယီ Database (တကယ်လုပ်လျှင် MySQL သို့မဟုတ် MongoDB သုံးရပါမည်)
let userDatabase = {}; 

app.post('/add-reward', (req, requireResponse) => {
    const { user_id, points } = req.body;

    if (!user_id) {
        return requireResponse.status(400).json({ success: false, message: "Missing User ID" });
    }

    // လက်ရှိရမှတ်ထဲမှာ ပေါင်းထည့်ခြင်း
    if (!userDatabase[user_id]) {
        userDatabase[user_id] = 0;
    }
    userDatabase[user_id] += points;

    console.log(`User ${user_id} ရမှတ် ${points} မှတ် ရရှိသွားပါပြီ။ စုစုပေါင်း: ${userDatabase[user_id]}`);

    return requireResponse.json({ success: true, current_points: userDatabase[user_id] });
});

app.listen(3000, () => console.log('Backend Server running on port 3000'));
