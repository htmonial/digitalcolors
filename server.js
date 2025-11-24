const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const base64 = require('base-64');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'htmonial';
const REPO = 'digitalcolors';
const FILE_PATH = 'data/colors.json';
const BRANCH = 'main';

const GITHUB_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

// GET /colors - hent farver fra GitHub
app.get('/colors', async (req, res) => {
  try {
    const resp = await fetch(GITHUB_API + `?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'node.js'
      }
    });
    if (!resp.ok) throw new Error('Fejl ved hent af GitHub fil: ' + resp.status);

    const data = await resp.json();
    const content = base64.decode(data.content);
    let colors = JSON.parse(content);

    // Normaliser: strings til objekter
    colors = colors.map(c => typeof c === 'string' ? { color: c, timestamp: null } : c);

    res.json(colors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kunne ikke hente farver fra GitHub' });
  }
});

// POST /colors - tilføj ny farve med timestamp
app.post('/colors', async (req, res) => {
  const { color } = req.body;
  if (!/^#([0-9A-Fa-f]{6})$/.test(color)) {
    return res.status(400).json({ error: 'Invalid hex color' });
  }

  try {
    const getResp = await fetch(GITHUB_API + `?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'node.js'
      }
    });
    if (!getResp.ok) throw new Error('Kunne ikke få fil fra GitHub: ' + getResp.status);

    const getData = await getResp.json();
    const sha = getData.sha;
    let colors = JSON.parse(base64.decode(getData.content));

    // Normaliser eksisterende farver
    colors = colors.map(c => typeof c === 'string' ? { color: c, timestamp: null } : c);

    // Tilføj ny farve
    colors.push({ color, timestamp: new Date().toISOString() });

    const newContentBase64 = base64.encode(JSON.stringify(colors, null, 2));

    const putResp = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'node.js',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add color ${color}`,
        content: newContentBase64,
        sha: sha,
        branch: BRANCH
      })
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      throw new Error('Fejl ved opdatering af GitHub fil: ' + errText);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kunne ikke gemme farve til GitHub' });
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));
