import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDatasets, useAnalytics, useFileUpload, useLlmHypotheses } from './hooks/useFinSightQueries';
import DashboardLayout from './components/layout/DashboardLayout';

function App() {
  const [selectedDataset, setSelectedDataset] = useState("");
  const [uploadedData, setUploadedData] = useState(null);
  const queryClient = useQueryClient();

  const { data: datasets = [] } = useDatasets();

  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics
  } = useAnalytics(selectedDataset, {
    enabled: !uploadedData
  });

  const { mutateAsync: uploadFileMutation, isPending: uploading } = useFileUpload();
  const { mutateAsync: fetchLlmHypothesesMutation, data: llmHypotheses, isPending: llmLoading } = useLlmHypotheses();

  const data = uploadedData || analyticsData;
  const loading = isAnalyticsLoading && !uploadedData;
  const error = analyticsError ? (analyticsError.response?.data?.detail || "The analytics engine is taking longer than usual to warm up. Please wait a moment and try clicking 'Demo Data' again.") : null;

  const handleDatasetChange = (f) => {
    if (f !== undefined) {
      setSelectedDataset(f);
      setUploadedData(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const responseData = await uploadFileMutation(file);
      setUploadedData(responseData);
      setSelectedDataset("");
    } catch (err) {
      alert(err.response?.data?.detail || "Error processing file.");
    }
  };

  const fetchDemoData = () => {
    setSelectedDataset("");
    setUploadedData(null);
    // Invalidate the cache so React Query always hits the server fresh
    queryClient.invalidateQueries({ queryKey: ['analytics', ''] });
  };

  return (
    <DashboardLayout
      data={data}
      loading={loading}
      error={error}
      datasets={datasets}
      selectedDataset={selectedDataset}
      onDatasetChange={handleDatasetChange}
      onFileUpload={handleFileUpload}
      uploading={uploading}
      fetchDemoData={fetchDemoData}
      llmHypotheses={llmHypotheses}
      fetchLlmHypothesesMutation={fetchLlmHypothesesMutation}
      llmLoading={llmLoading}
    />
  );
}

export default App;
