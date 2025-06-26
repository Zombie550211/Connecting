const Costumer = require('./models/costumer');
const { app, protegerRuta, COSTUMER_HEADER, nombreFinalAgente } = require('./server');

app.get("/api/costumer", protegerRuta, async (req, res) => {
  try {
    const { fecha } = req.query;
    const query = {};
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      query.fecha = fecha;
    }
    let costumers = await Costumer.find(query).sort({ _id: -1 }).lean();
    costumers = costumers.map(c => {
      let obj = {};
      COSTUMER_HEADER.forEach(k => obj[k] = c[k] || "");
      obj.agente = nombreFinalAgente(obj.agente);
      obj._id = c._id; // Para edición
      return obj;
    });
    res.json({ costumers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
