import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Video, CreditCard, CheckCircle2 } from 'lucide-react';
import api from '../api/client';

const MOCK_DOCTORS = [
  { id: 'doc-101', name: 'Dr. Sarah Jenkins', spec: 'Cardiologist', status: 'Available' },
  { id: 'doc-102', name: 'Dr. Michael Chen', spec: 'Neurologist', status: 'Available' },
  { id: 'doc-103', name: 'Dr. Emily Watson', spec: 'General Physician', status: 'Busy' }
];

export default function Dashboard() {
  const [bookingStatus, setBookingStatus] = useState(null); // 'booking', 'success', 'error'
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleBookAppointment = async (doctor) => {
    if (doctor.status === 'Busy') {
      showToast('Doctor is currently busy.');
      return;
    }

    setBookingStatus('booking');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    try {
      // Trigger the SAGA flow inside appointment-service through API Gateway
      const res = await api.post(`/doctors/${doctor.id}/appointments`, {
        companyId: "health-center-1",
        doctorId: doctor.id,
        doctorData: { name: doctor.name, specialty: doctor.spec },
        userId: user.id || "user-uuid-123",
        userData: { name: user.firstName || "Patient" },
        startTime: new Date().toISOString(),
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
        amount: 150.00 // SAGA triggers payment with this
      });
      
      const payloadObj = JSON.parse(res.data.payload);
      setActiveAppointment(payloadObj);
      setBookingStatus('success');
      showToast(`Successfully booked ${doctor.name}`);
    } catch (err) {
      console.error(err);
      setBookingStatus('error');
      showToast('Booking failed. SAGA transaction rolled back.');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-dark)', minHeight: '100vh', paddingTop: '80px' }}>
      <div className="dashboard-container">
        
        {/* Active SAGA Results Display */}
        <AnimatePresence mode="popLayout">
          {bookingStatus === 'success' && activeAppointment && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card" 
              style={{ maxWidth: '100%', marginBottom: '40px', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <CheckCircle2 color="var(--success)" size={32} />
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--success)' }}>Appointment Confirmed</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Payment processed and notification sent via SAGA workflow.</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>{activeAppointment.status || 'CONFIRMED'}</p>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Telemedicine Link</p>
                  <a href={activeAppointment.telemedicine_url || "#"} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Video size={18} /> Join Meeting
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px' }}>Available Doctors</h2>
        <div className="doctors-grid">
          {MOCK_DOCTORS.map((doc, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={doc.id} 
              className="doctor-card"
            >
              <div className="doctor-header">
                <div className="doctor-avatar">
                  {doc.name.charAt(4)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{doc.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{doc.spec}</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                <span className="status-badge" style={doc.status === 'Busy' ? { color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)' } : {}}>
                  <span className="status-dot"></span> {doc.status}
                </span>
                <button 
                  className="btn-primary" 
                  style={{ padding: '8px 16px', width: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}
                  onClick={() => handleBookAppointment(doc)}
                  disabled={bookingStatus === 'booking' || doc.status === 'Busy'}
                >
                  <Calendar size={16} /> Book
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className={`toast ${bookingStatus === 'error' ? 'error' : 'success'}`}>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure AnimatePresence is available for popup animations
import { AnimatePresence } from 'framer-motion';
