import React, { useState, useEffect, useRef } from 'react';
import { Radio, Zap, AlertTriangle, LogIn, LogOut, CreditCard, HeadphonesIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (API_URL && !API_URL.startsWith('http')) {
  API_URL = `https://${API_URL}`;
}
const WS_URL = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');

const EVENT_ICONS = {
  transaction: CreditCard,
  login: LogIn,
  logout: LogOut,
  transaction_fail: AlertTriangle,
  support_ticket: HeadphonesIcon,
  plan_downgrade: AlertTriangle,
};
const EVENT_COLORS = {
  transaction: '#10b981',
  login: '#6366f1',
  logout: '#94a3b8',
  transaction_fail: '#f43f5e',
  support_ticket: '#f59e0b',
  plan_downgrade: '#f43f5e',
};

export default function LiveTicker() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(false);
  const wsRef = useRef(null);

  const connect = () => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${WS_URL}/stream`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        setEvents(prev => [ev, ...prev].slice(0, 20));
      } catch {}
    };
    wsRef.current = ws;
    setActive(true);
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
    setActive(false);
    setConnected(false);
  };

  useEffect(() => () => { if (wsRef.current) wsRef.current.close(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>
          <Radio size={20} style={{ color: connected ? '#10b981' : '#94a3b8' }} /> Live Event Stream
          {connected && <span className="live-dot" />}
        </h2>
        <button className={active ? 'btn-outline' : 'btn-primary'} onClick={active ? disconnect : connect}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
          <Zap size={14} />{active ? 'Stop' : 'Start Stream'}
        </button>
      </div>

      {!active && events.length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Click "Start Stream" to simulate real-time fintech events
        </p>
      )}

      <div className="ticker-list">
        <AnimatePresence>
          {events.map((ev, i) => {
            const Icon = EVENT_ICONS[ev.event_type] || Zap;
            const color = EVENT_COLORS[ev.event_type] || '#94a3b8';
            return (
              <motion.div key={ev.event_id + i} className="ticker-item"
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}>
                <div className="ticker-icon" style={{ background: `${color}15`, color }}>
                  <Icon size={14} />
                </div>
                <div className="ticker-body">
                  <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>{ev.user_id}</span>
                  <span className="badge" style={{ background: `${color}12`, color, border: `1px solid ${color}25`, fontSize: '0.68rem' }}>
                    {ev.event_type.replace('_', ' ')}
                  </span>
                  {ev.amount && <span style={{ color: '#64748b', fontSize: '0.78rem' }}>₹{ev.amount.toFixed(2)}</span>}
                </div>
                {ev.churn_delta !== 0 && ev.churn_delta != null && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ev.churn_delta > 0 ? '#f43f5e' : '#10b981' }}>
                    {ev.churn_delta > 0 ? '↑' : '↓'}{Math.abs(ev.churn_delta * 100).toFixed(1)}%
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
