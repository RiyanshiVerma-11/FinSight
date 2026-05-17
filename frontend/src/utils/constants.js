export const COLORS = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#f43f5e', '#8b5cf6'];

export const SEGMENT_COLORS = {
  'Champions': '#10b981',    // Emerald
  'Loyalists': '#6366f1',    // Indigo
  'Promising': '#06b6d4',    // Cyan
  'At Risk': '#f43f5e',      // Rose (Red for Danger)
  'Hibernating': '#94a3b8',  // Slate (Dull for Lapsed)
  'Needs Attention': '#f59e0b', // Amber/Yellow
  'New': '#8b5cf6',          // Violet
};

export const CHART_COLORS = ['#6366f1', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

export const PERSONA_DEFINITIONS = {
  'Champions': {
    label: 'The Loyal Giant',
    description: 'Power users with the highest frequency and spend.',
    color: '#10b981'
  },
  'Loyalists': {
    label: 'The Steady Pillar',
    description: 'Consistent, regular users who are the backbone of your revenue.',
    color: '#6366f1'
  },
  'Promising': {
    label: 'The Rising Star',
    description: 'New or growing users showing strong signals of becoming loyalists.',
    color: '#06b6d4'
  },
  'At Risk': {
    label: 'The Fading Star',
    description: 'Previously loyal users whose activity has recently dropped. High churn risk.',
    color: '#f43f5e'
  },
  'Hibernating': {
    label: 'The Lost Soul',
    description: 'Inactive users with very low activity. Requires major re-engagement.',
    color: '#94a3b8'
  },
  'Needs Attention': {
    label: 'The Drifting User',
    description: 'Users with irregular usage patterns and inconsistent engagement.',
    color: '#f59e0b'
  },
  'New': {
    label: 'Onboarding',
    description: 'Brand new users.',
    color: '#8b5cf6'
  }
};
