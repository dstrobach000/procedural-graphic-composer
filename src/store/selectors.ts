import { useProjectStore } from './useProjectStore';

type ProjectState = ReturnType<typeof useProjectStore.getState>;

export const selectProject = (state: ProjectState) => state.project;
export const selectLayers = (state: ProjectState) => state.project.layers;
export const selectEffects = (state: ProjectState) => state.project.effectChain;
export const selectSnapshots = (state: ProjectState) => state.project.snapshots;
export const selectSelectedLayerId = (state: ProjectState) => state.selectedLayerId;
export const selectNotifications = (state: ProjectState) => state.notifications;
export const selectCustomExportSize = (state: ProjectState) => state.customExportSize;
