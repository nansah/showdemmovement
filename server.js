require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

/* Wire all API handlers (same files that Vercel deploys as serverless functions) */
const handlers = ['login', 'content', 'upload', 'backup', 'restore', 'applications'];
handlers.forEach(name => {
  const fn = require('./api/' + name);
  app.all('/api/' + name, fn);
});

/* Clean URLs */
app.get('/admin',            (_, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/membership-guide', (_, res) => res.sendFile(path.join(__dirname, 'membership-guide.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Showdem running → http://localhost:${PORT}`));

module.exports = app;
