const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const base64 = require('base-64');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'htmonial';
const REPO = 'digitalcolors';
const FILE_PATH = 'data/colors.json'; // sti i repo
const BRANCH = 'main';

const GITHUB_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

// Hent farver fra GitHub
app.get('/colors', async (req, res) => {
  try {
    // Hent filindhold & SHA
    const resp = await fetch(GITHUB_API + `?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'node.js'
      }
    });
    if (!resp.ok) throw new Error('Fejl ved hent af GitHub fil: ' + resp.status);
    const data = await resp.json();
    const content = base64.decode(data.content);
    const colors = JSON.parse(content);
    res.json(colors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kunne ikke hente farver fra GitHub' });
  }
});

// Tilføj farve og opdater GitHub-fil
app.post('/colors', async (req, res) => {
  const { color } = req.body;
  if (!/^#([0-9A-Fa-f]{6})$/.test(color)) {
    return res.status(400).json({ error: 'Invalid hex color' });
  }

  try {
    // Først hent nuværende fil for at få content og SHA
    const getResp = await fetch(GITHUB_API + `?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'node.js'
      }
    });
    if (!getResp.ok) throw new Error('Kunne ikke få fil fra GitHub: ' + getResp.status);
    const getData = await getResp.json();
    const sha = getData.sha;
    const currentContentBase64 = getData.content;
    const currentContent = base64.decode(currentContentBase64);
    const colors = JSON.parse(currentContent);

    // Tilføj ny farve
   colors.push(color);

    // Encode ny content
    const newContentString = JSON.stringify(colors, null, 2);
    const newContentBase64 = base64.encode(newContentString);

    // Lav commit via GitHub API
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

    const putData = await putResp.json();
    console.log('Commit lavet:', putData.commit.sha);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kunne ikke gemme farve til GitHub' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));

