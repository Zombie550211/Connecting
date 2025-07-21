const http = require('http');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', (error) => {
      reject(error);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testAPI() {
  try {
    console.log('🧪 Probando API /api/costumer...\n');
    
    // Test 1: Sin parámetros
    console.log('1️⃣ Test sin parámetros:');
    try {
      const response1 = await makeRequest('http://localhost:3000/api/costumer');
      console.log('   Status:', response1.status);
      console.log('   Data:', JSON.stringify(response1.data, null, 2));
    } catch (error) {
      console.log('   Error:', error.message);
    }
    
    // Test 2: Con mes y año actual
    console.log('\n2️⃣ Test con mes=7 y año=2025:');
    try {
      const response2 = await makeRequest('http://localhost:3000/api/costumer?mes=7&anio=2025');
      console.log('   Status:', response2.status);
      console.log('   Data:', JSON.stringify(response2.data, null, 2));
    } catch (error) {
      console.log('   Error:', error.message);
    }
    
    // Test 3: Con rango de fechas específico
    console.log('\n3️⃣ Test con rango de fechas (2025-07-01 a 2025-07-31):');
    try {
      const response3 = await makeRequest('http://localhost:3000/api/costumer?fechaDesde=2025-07-01&fechaHasta=2025-07-31');
      console.log('   Status:', response3.status);
      console.log('   Data:', JSON.stringify(response3.data, null, 2));
    } catch (error) {
      console.log('   Error:', error.message);
    }
    
    // Test 4: Con fecha específica que sabemos que existe
    console.log('\n4️⃣ Test con fecha específica (2025-07-19):');
    try {
      const response4 = await makeRequest('http://localhost:3000/api/costumer?fecha=2025-07-19');
      console.log('   Status:', response4.status);
      console.log('   Data:', JSON.stringify(response4.data, null, 2));
    } catch (error) {
      console.log('   Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testAPI();
