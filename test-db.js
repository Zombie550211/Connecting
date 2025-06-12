require('dotenv').config();
const mongoose = require('mongoose');

const Lead = require('./models/lead');
const Costumer = require('./models/costumer');

async function test() {
  try {
    console.log('Intentando conectar a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado a MongoDB correctamente.');

    const leadTest = new Lead({
      fecha: new Date(),
      equipo: 'Equipo Test',
      agente: 'Agente Test',
      telefono: '1234567890',
      producto: 'Producto Test',
      puntaje: 10,
      cuenta: 'Cuenta Test',
      direccion: 'Direccion Test',
      zip: '00000',
    });

    const leadSaved = await leadTest.save();
    console.log('Lead guardado con éxito:', leadSaved);

    const costumerTest = new Costumer({
      fecha: new Date(),
      equipo: 'Equipo Test',
      agente: 'Agente Test',
      telefono: '0987654321',
      producto: 'Producto Test',
      puntaje: 20,
      cuenta: 'Cuenta Test',
      direccion: 'Direccion Test',
      zip: '11111',
    });

    const costumerSaved = await costumerTest.save();
    console.log('Costumer guardado con éxito:', costumerSaved);

    const leads = await Lead.find().sort({ fecha: -1 }).limit(5);
    console.log('Últimos 5 Leads:', leads);

    const costumers = await Costumer.find().sort({ fecha: -1 }).limit(5);
    console.log('Últimos 5 Costumers:', costumers);

  } catch (error) {
    console.error('Error en la prueba:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión cerrada.');
  }
}

test();
