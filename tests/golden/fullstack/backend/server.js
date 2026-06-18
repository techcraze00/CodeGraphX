// Express backend. Routes bind to named handlers in this file.
const express = require('express');
const app = express();

function listUsers(req, res) {
  res.json([]);
}

function addUser(req, res) {
  res.status(201).json(req.body);
}

app.get('/api/users', listUsers);
app.post('/api/users', addUser);

module.exports = app;
