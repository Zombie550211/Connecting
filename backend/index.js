const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('../db');

const app = express();
app.use(cors());
app.use(express.json());

// Conectar a MongoDB Atlas
connectDB();

// Rutas de prueba
app.get('/', (req, res) => {
  res.send('API CRM funcionando');
});

// Aquí pondremos las rutas de leads, costumer y gráficas...

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('Servidor backend escuchando en puerto', PORT);
});