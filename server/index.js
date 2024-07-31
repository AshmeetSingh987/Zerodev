const express=require('express');
const { useSessionKey }=require('./sessionKeyHandler');

const app=express();
app.use(express.json());

app.post('/api/use-session-key', async (req, res) => {
    try {
        const { serializedSessionKey, sessionPrivateKey }=req.body;
        const result=await useSessionKey(serializedSessionKey, sessionPrivateKey);
        res.json(result);
    } catch (error) {
        console.error('Error in /api/use-session-key:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(5173, () => {
    console.log('Server listening on port 5173');
});