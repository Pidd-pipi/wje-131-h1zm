import { create } from 'zustand';
import { materialApi } from '../api/material';
import { materialRequisitionApi } from '../api/materialRequisition';
import { materialUsageApi } from '../api/materialUsage';
import { Material, MaterialRequisition, MaterialUsage } from '../types';

interface MaterialState {
  materials: Material[];
  usages: MaterialUsage[];
  requisitions: MaterialRequisition[];
  loadMaterials: () => Promise<void>;
  loadUsages: (projectId?: number, phaseId?: number) => Promise<void>;
  loadRequisitions: (projectId?: number, phaseId?: number) => Promise<void>;
}

export const useMaterialStore = create<MaterialState>((set) => ({
  materials: [],
  usages: [],
  requisitions: [],
  loadMaterials: async () => {
    const materials = await materialApi.list();
    set({ materials });
  },
  loadUsages: async (projectId, phaseId) => {
    const usages = await materialUsageApi.list(projectId, phaseId);
    set({ usages });
  },
  loadRequisitions: async (projectId, phaseId) => {
    const requisitions = await materialRequisitionApi.list(projectId, phaseId);
    set({ requisitions });
  }
}));
