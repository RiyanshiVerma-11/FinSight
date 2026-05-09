import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

export default function FormulaTooltip({ formula, title = "Calculation Logic", children, color = "#6366f1" }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '12px',
              zIndex: 100,
              width: '240px',
              background: '#ffffff',
              border: `1px solid ${color}30`,
              borderRadius: '12px',
              padding: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              pointerEvents: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Info size={12} color={color} />
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.4 }}>
              {formula}
            </div>
            
            {/* Arrow */}
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #ffffff'
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
