import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (API_URL && !API_URL.startsWith('http')) {
  API_URL = `https://${API_URL}`;
}

export const useDatasets = () => {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/list-datasets`);
      return data.datasets || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
};

export const useAnalytics = (datasetName, options = {}) => {
  return useQuery({
    queryKey: ['analytics', datasetName],
    queryFn: async () => {
      if (datasetName) {
        const { data } = await axios.get(`${API_URL}/analyze-local?filename=${encodeURIComponent(datasetName)}`);
        return data;
      } else {
        const { data } = await axios.get(`${API_URL}/demo-data`);
        return data;
      }
    },
    staleTime: Infinity, // Analytics data is pretty static per dataset
    retry: (failureCount, error) => {
      // Retry demo data fetch twice
      if (!datasetName && failureCount < 2) return true;
      return false;
    },
    ...options
  });
};

export const useLlmHypotheses = (options) => {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.get(`${API_URL}/llm-hypotheses`);
      return data;
    },
    ...options
  });
};

export const useFileUpload = (options) => {
  return useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API_URL}/analyze`, fd);
      return data;
    },
    ...options
  });
};
