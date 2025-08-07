const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/crm', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Define Costumer Schema based on routes and frontend code
const costumerSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    equipo: { type: String, required: true },
    agente: { type: String, required: true },
    producto: { type: String, required: true },
    fecha_instalacion: { type: Date },
    estado: { type: String, enum: ['Pending', 'Complete', 'Cancelled'], default: 'Pending' },
    puntaje: { type: Number, default: 0 },
    cuenta: { type: String },
    telefono: { type: String },
    direccion: { type: String },
    zip: { type: String },
    created_at: { type: Date, default: Date.now }
});

const Costumer = mongoose.model('Costumer', costumerSchema);

// Sample test data for Costumer collection
const testData = [
    {
        fecha: new Date(2025, 7, 1),
        equipo: 'Team A',
        agente: 'Juan Perez',
        producto: 'Internet 100Mbps',
        fecha_instalacion: new Date(2025, 7, 5),
        estado: 'Complete',
        puntaje: 95,
        cuenta: 'ACC12345',
        telefono: '555-123-4567',
        direccion: 'Calle Falsa 123',
        zip: '01010'
    },
    {
        fecha: new Date(2025, 7, 2),
        equipo: 'Team B',
        agente: 'Maria Lopez',
        producto: 'TV por Cable',
        fecha_instalacion: new Date(2025, 7, 6),
        estado: 'Complete',
        puntaje: 88,
        cuenta: 'ACC12346',
        telefono: '555-234-5678',
        direccion: 'Avenida Siempreviva 456',
        zip: '02020'
    },
    {
        fecha: new Date(2025, 7, 3),
        equipo: 'Team A',
        agente: 'Carlos Sanchez',
        producto: 'Telefonía IP',
        fecha_instalacion: new Date(2025, 7, 7),
        estado: 'Pending',
        puntaje: 0,
        cuenta: 'ACC12347',
        telefono: '555-345-6789',
        direccion: 'Boulevard de los Sueños 789',
        zip: '03030'
    },
    {
        fecha: new Date(2025, 7, 4),
        equipo: 'Team C',
        agente: 'Ana Martinez',
        producto: 'Internet 500Mbps',
        fecha_instalacion: new Date(2025, 7, 8),
        estado: 'Complete',
        puntaje: 92,
        cuenta: 'ACC12348',
        telefono: '555-456-7890',
        direccion: 'Calle de la Rosa 101',
        zip: '04040'
    },
    {
        fecha: new Date(2025, 7, 5),
        equipo: 'Team B',
        agente: 'Luis Gomez',
        producto: 'Paquete Completo',
        fecha_instalacion: new Date(2025, 7, 9),
        estado: 'Cancelled',
        puntaje: 0,
        cuenta: 'ACC12349',
        telefono: '555-567-8901',
        direccion: 'Avenida del Parque 202',
        zip: '05050'
    }
];

// Insert test data
async function insertTestData() {
    try {
        // Clear existing data
        await Costumer.deleteMany({});
        console.log('✅ Existing Costumer data cleared');

        // Insert test data
        const result = await Costumer.insertMany(testData);
        console.log(`✅ Successfully inserted ${result.length} test documents into Costumer collection`);
        
        // Exit the process
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inserting test data:', error);
        process.exit(1);
    }
}

// Run the script
insertTestData();
