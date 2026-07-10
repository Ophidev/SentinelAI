import api from "./api";

export const listProjects = () => api.get("/api/projects").then((res) => res.data);

export const createProject = (name, url) =>
  api.post("/api/projects", { name, url }).then((res) => res.data);

export const getProject = (id) => api.get(`/api/projects/${id}`).then((res) => res.data);

export const deleteProject = (id) => api.delete(`/api/projects/${id}`).then((res) => res.data);
