// backend/server.js

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

app.post('/api/auth/twitch', async (req, res) => {
  const { code } = req.body;
  const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI;

  if (!code) {
    return res.status(400).json({ error: 'Code d\'autorisation manquant' });
  }

  try {
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: TWITCH_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Erreur de l\'API Twitch:', tokenData);
      return res.status(tokenResponse.status).json({ error: 'Échec de l\'échange de code avec Twitch' });
    }

    res.json(tokenData);
  } catch (error) {
    console.error('Erreur lors du processus d\'authentification:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});