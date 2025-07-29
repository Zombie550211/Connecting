const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  nombre:     { type: String, required: true },
  apellido:   { type: String, required: true },
  correo:     { type: String, required: true, unique: true },
  usuario:    { type: String, required: true, unique: true },
  password:   { type: String, required: true }
});
module.exports = mongoose.model('User', userSchema);