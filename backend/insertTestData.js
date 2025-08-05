const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/crm', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Define CrmAgente Schema
const crmAgenteSchema = new mongoose.Schema({
    fecha_venta: { type: Date, required: true },
    team: { type: String, required: true },
    agente: { type: String, required: true },
    producto: { type: String, required: true },
    fecha_instalacion: { type: Date },
    estado: { type: String, enum: ['Pendiente', 'Completado', 'Cancelado'], default: 'Pendiente' },
    puntaje: { type: Number, default: 0 },
    cuenta: { type: String },
    telefono: { type: String },
    direccion: { type: String },
    zip: { type: String },
    created_at: { type: Date, default: Date.now }
});

const CrmAgente = mongoose.model('CrmAgente', crmAgenteSchema);

// Sample test data
const testData = [
    {
        fecha_venta: new Date(2025, 6, 15),
        team: 'Team A',
        agente: 'Juan Perez',
        producto: 'Internet 100Mbps',
        fecha_instalacion: new Date(2025, 6, 20),
        estado: 'Pendiente',
        puntaje: 0,
        cuenta: 'CL12345',
        telefono: '555-123-4567',
        direccion: 'Calle Falsa 123',
        zip: '01010'
    },
    {
        fecha_venta: new Date(2025, 6, 16),
        team: 'Team B',
        agente: 'Maria Lopez',
        producto: 'TV por Cable',
        fecha_instalacion: new Date(2025, 6, 22),
        estado: 'Pendiente',
        puntaje: 0,
        cuenta: 'CL12346',
        telefono: '555-234-5678',
        direccion: 'Avenida Siempreviva 456',
        zip: '02020'
    },
    {
        fecha_venta: new Date(2025, 6, 17),
        team: 'Team A',
        agente: 'Carlos Sanchez',
        producto: 'Telefonía IP',
        fecha_instalacion: new Date(2025, 6, 23),
        estado: 'Pendiente',
        puntaje: 0,
        cuenta: 'CL12347',
        telefono: '555-345-6789',
        direccion: 'Boulevard de los Sueños 789',
        zip: '03030'
    },
    {
        fecha_venta: new Date(2025, 6, 18),
        team: 'Team C',
        agente: 'Ana Martinez',
        producto: 'Internet 500Mbps',
        fecha_instalacion: new Date(2025, 6, 24),
        estado: 'Pendiente',
        puntaje: 0,
        cuenta: 'CL12348',
        telefono: '555-456-7890',
        direccion: 'Calle de la Rosa 101',
        zip: '04040'
    },
    {
        fecha_venta: new Date(2025, 6, 19),
        team: 'Team B',
        agente: 'Luis Gomez',
        producto: 'Paque Completo',
        fecha_instalacion: new Date(2025, 6, 25),
        estado: 'Pendiente',
        puntaje: 0,
        cuenta: 'CL12349',
        telefono: '555-567-8901',
        direccion: 'Avenida del Parque 202',
        zip: '05050'
    }
];

// Insert test data
async function insertTestData() {
    try {
        // Clear existing data
        await CrmAgente.deleteMany({});
        console.log('Existing data cleared');
        
        // Insert test data
        const result = await CrmAgente.insertMany(testData);
        console.log(`${result.length} test records inserted successfully`);
        
        // Close the connection
        mongoose.connection.close();
    } catch (error) {
        console.error('Error inserting test data:', error);
        process.exit(1);
    }
}

// Run the script
insertTestData();
