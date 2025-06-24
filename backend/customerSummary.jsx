import React, { useEffect, useState } from "react";
import axios from "axios";

function CustomerSummary() {
  const [summary, setSummary] = useState({
    ventasHoy: 0,
    leadsPendientes: 0,
    clientes: 0,
    ventasMes: 0,
  });
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchSummary = async (from, to) => {
    // Cambia la URL por la de tu backend real
    const res = await axios.get("/api/crm/summary", {
      params: { from, to },
    });
    setSummary(res.data);
  };

  useEffect(() => {
    fetchSummary(dateRange.from, dateRange.to);
  }, [dateRange]);

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div>
        <label>Desde: <input type="date" name="from" onChange={handleDateChange} /></label>
        <label>Hasta: <input type="date" name="to" onChange={handleDateChange} /></label>
      </div>
      <div className="summary-cards">
        <div>Ventas Hoy<br /><span>{summary.ventasHoy}</span></div>
        <div>Leads Pendientes<br /><span>{summary.leadsPendientes}</span></div>
        <div>Clientes<br /><span>{summary.clientes}</span></div>
        <div>Ventas (mes)<br /><span>{summary.ventasMes}</span></div>
      </div>
    </div>
  );
}

export default CustomerSummary;