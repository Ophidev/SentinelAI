import api from "./api";

// Triggering a scan runs synchronously on the backend (a few seconds), so
// this call simply resolves once the scan is done — no polling needed for v1.
export const triggerScan = (projectId) =>
  api.post(`/api/projects/${projectId}/scans`).then((res) => res.data);

export const listScans = (projectId) =>
  api.get(`/api/projects/${projectId}/scans`).then((res) => res.data);

export const getScan = (id) => api.get(`/api/scans/${id}`).then((res) => res.data);

// Code scans (SAST-lite + SCA against a GitHub repo) — same synchronous
// pattern as the website scan above, just a different backend route.
export const triggerCodeScan = (projectId) =>
  api.post(`/api/projects/${projectId}/codescans`).then((res) => res.data);

export const listCodeScans = (projectId) =>
  api.get(`/api/projects/${projectId}/codescans`).then((res) => res.data);
